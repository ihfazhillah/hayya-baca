"""Tahsin Tracker API (Spec 072)."""
import logging
from datetime import date

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import LoginLockout  # noqa: F401 (kept for parity)
from rest_framework.authtoken.models import Token

from .models import Santri, TahsinItem, TahsinRecord
from .serializers import ItemSerializer, RecordSerializer, SantriSerializer
from .services import (
    RoleDenied,
    ensure_pengampu_account,
    regenerate_login_code,
    resolve_role,
    revoke_pengampu_account,
)
from .summary import build_summary

logger = logging.getLogger(__name__)

DEFAULT_ITEMS = [
    {"name": "Nun sukun / tanwin", "code": "ns/t"},
    {"name": "Mad thobi'i", "code": "mt"},
]


class TahsinRoleMixin:
    """Resolve (role, owner, santri) once per request; deny child accounts."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        try:
            self.role, self.owner, self.me_santri = resolve_role(request.user)
        except RoleDenied as exc:
            self.permission_denied(request, message=str(exc))

    def allowed_santri_ids(self):
        """IDs the caller may attach records to."""
        if self.role == "pengampu":
            return set(
                Santri.objects.filter(
                    owner=self.owner, pengampu=self.me_santri, is_active=True
                ).values_list("id", flat=True)
            )
        return set(
            Santri.objects.filter(owner=self.owner).values_list("id", flat=True)
        )


class MeView(TahsinRoleMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = ItemSerializer(
            TahsinItem.objects.filter(owner=self.owner, is_active=True), many=True
        ).data
        if self.role == "pengampu":
            santri = Santri.objects.filter(
                owner=self.owner, pengampu=self.me_santri, is_active=True
            )
            display = self.me_santri.name
        else:
            santri = Santri.objects.filter(owner=self.owner, is_active=True)
            display = request.user.username
        return Response(
            {
                "role": self.role,
                "display_name": display,
                "santri_id": self.me_santri.id if self.me_santri else None,
                "items": items,
                "santri": SantriSerializer(santri, many=True).data,
            }
        )


class GuardianOnlyMixin(TahsinRoleMixin):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.role != "guardian":
            self.permission_denied(request, message="Hanya untuk ustadz")


class ItemViewSet(GuardianOnlyMixin, viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TahsinItem.objects.filter(owner=self.owner)

    def perform_create(self, serializer):
        last = (
            TahsinItem.objects.filter(owner=self.owner)
            .order_by("-order")
            .first()
        )
        serializer.save(owner=self.owner, order=(last.order + 1 if last else 0))

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=False, methods=["post"])
    def seed(self, request):
        """Create the default aspects if none exist yet (idempotent)."""
        created = []
        existing_codes = set(
            TahsinItem.objects.filter(owner=self.owner).values_list("code", flat=True)
        )
        order = TahsinItem.objects.filter(owner=self.owner).count()
        for spec in DEFAULT_ITEMS:
            if spec["code"] in existing_codes:
                continue
            created.append(
                TahsinItem.objects.create(
                    owner=self.owner, order=order, **spec
                )
            )
            order += 1
        return Response(
            ItemSerializer(created, many=True).data, status=status.HTTP_201_CREATED
        )


class SantriViewSet(GuardianOnlyMixin, viewsets.ModelViewSet):
    serializer_class = SantriSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Santri.objects.filter(owner=self.owner)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["owner"] = self.owner
        return ctx

    def _sync_pengampu(self, santri, was_pengampu):
        if santri.is_pengampu:
            ensure_pengampu_account(santri)
        elif was_pengampu:
            revoke_pengampu_account(santri)
            # Orphan the students this pengampu used to grade.
            Santri.objects.filter(pengampu=santri).update(pengampu=None)

    def perform_create(self, serializer):
        santri = serializer.save(owner=self.owner)
        self._sync_pengampu(santri, was_pengampu=False)

    def perform_update(self, serializer):
        was_pengampu = serializer.instance.is_pengampu
        santri = serializer.save()
        self._sync_pengampu(santri, was_pengampu)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        santri = self.get_object()
        pengampu_id = request.data.get("pengampu")
        if pengampu_id in (None, "", "null"):
            santri.pengampu = None
        else:
            target = Santri.objects.filter(
                owner=self.owner, id=pengampu_id, is_pengampu=True
            ).first()
            if target is None:
                return Response(
                    {"detail": "Pengampu tidak valid"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            santri.pengampu = target
        santri.save(update_fields=["pengampu"])
        return Response(SantriSerializer(santri).data)

    @action(detail=True, methods=["get"], url_path="login-code")
    def login_code(self, request, pk=None):
        santri = self.get_object()
        if not santri.is_pengampu:
            return Response(
                {"detail": "Santri ini bukan pengampu"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ensure_pengampu_account(santri)
        return Response({"code": santri.login_code, "url": self._code_url(santri)})

    @action(detail=True, methods=["post"], url_path="login-code/regenerate")
    def login_code_regenerate(self, request, pk=None):
        santri = self.get_object()
        if not santri.is_pengampu:
            return Response(
                {"detail": "Santri ini bukan pengampu"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ensure_pengampu_account(santri)
        regenerate_login_code(santri)
        return Response({"code": santri.login_code, "url": self._code_url(santri)})

    @staticmethod
    def _code_url(santri):
        return f"https://tahsin.ihfazh.com/login?code={santri.login_code}"


class RecordViewSet(TahsinRoleMixin, viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TahsinRecord.objects.filter(owner=self.owner).prefetch_related("scores")
        if self.role == "pengampu":
            qs = qs.filter(santri__pengampu=self.me_santri)
        p = self.request.query_params
        if p.get("santri"):
            qs = qs.filter(santri_id=p["santri"])
        if p.get("pengampu"):
            qs = qs.filter(santri__pengampu_id=p["pengampu"])
        if p.get("from"):
            qs = qs.filter(date__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(date__lte=p["to"])
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["owner"] = self.owner
        ctx["allowed_santri_ids"] = self.allowed_santri_ids()
        ctx["valid_item_ids"] = set(
            TahsinItem.objects.filter(owner=self.owner, is_active=True).values_list(
                "id", flat=True
            )
        )
        return ctx

    def _can_mutate(self, record):
        return self.role == "guardian" or record.created_by_id == self.request.user.id

    def update(self, request, *args, **kwargs):
        if not self._can_mutate(self.get_object()):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_mutate(self.get_object()):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """Create many records atomically; errors reported per index."""
        payload = request.data
        if not isinstance(payload, list):
            return Response(
                {"detail": "Body harus berupa array"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        context = self.get_serializer_context()
        serializers_ = [
            RecordSerializer(data=item, context=context) for item in payload
        ]
        errors = {}
        for idx, ser in enumerate(serializers_):
            if not ser.is_valid():
                errors[idx] = ser.errors
        if errors:
            return Response(
                {"errors": errors}, status=status.HTTP_400_BAD_REQUEST
            )
        with transaction.atomic():
            created = [ser.save() for ser in serializers_]
        return Response(
            RecordSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class SummaryView(TahsinRoleMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get("period", "week")
        if period not in ("week", "month"):
            period = "week"
        start_raw = request.query_params.get("start")
        try:
            start = date.fromisoformat(start_raw) if start_raw else date.today()
        except ValueError:
            return Response(
                {"detail": "start tidak valid (YYYY-MM-DD)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pengampu_id = request.query_params.get("pengampu") or None
        santri_id = request.query_params.get("santri") or None
        if self.role == "pengampu":
            # Force scope to this pengampu's students.
            pengampu_id = self.me_santri.id
        return Response(
            build_summary(self.owner, period, start, pengampu_id, santri_id)
        )


class LoginCodeView(APIView):
    """Anon: redeem a pengampu's permanent login code for a DRF token.

    No rate limit (Spec 072 §6.4): all santri share one IP; security rests on
    the 31**8 code entropy. Failures are logged.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        code = (request.data.get("code") or "").strip().upper()
        santri = Santri.objects.filter(
            login_code=code, is_pengampu=True, is_active=True
        ).select_related("user").first()
        if santri is None or santri.user is None:
            logger.warning("Tahsin login-code miss: %r", code[:12])
            return Response(
                {"detail": "Kode tidak valid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token, _ = Token.objects.get_or_create(user=santri.user)
        return Response({"token": token.key, "name": santri.name, "role": "pengampu"})
