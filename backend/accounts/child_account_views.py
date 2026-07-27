"""Views for child diary accounts (Spec 060 — Ruang Cerita, Fase 1)."""
import secrets

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChildAccess, LoginLockout, PasswordSetupToken, is_child_account
from .serializers import ChildSerializer
from .validators import validate_child_password

User = get_user_model()


def setup_url_for(code):
    return f"{settings.DIARY_WEB_BASE_URL.rstrip('/')}/setup?code={code}"


def _is_parent_of(user, child_id):
    return ChildAccess.objects.filter(
        user=user, child_id=child_id, role=ChildAccess.Role.PARENT
    ).exists()


def _get_parent_child(user, child_id):
    """Return the Child if `user` is a parent of it, else None."""
    from .models import Child

    if not _is_parent_of(user, child_id):
        return None
    return Child.objects.filter(id=child_id).first()


def username_suggestions(base, count=3):
    """Free username candidates: base + 2 random digits."""
    suggestions = []
    attempts = 0
    while len(suggestions) < count and attempts < 50:
        attempts += 1
        candidate = f"{base}{secrets.randbelow(90) + 10}"
        if candidate in suggestions:
            continue
        if not User.objects.filter(username=candidate).exists():
            suggestions.append(candidate)
    return suggestions


class DiaryAccountView(APIView):
    """POST create the diary login account for a child (parent only)."""

    def post(self, request, child_pk):
        child = _get_parent_child(request.user, child_pk)
        if child is None:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if child.user_id is not None:
            return Response(
                {"detail": "Anak ini sudah punya akun"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = (request.data.get("username") or "").strip().lower()
        if not username:
            return Response(
                {"detail": "Username wajib diisi"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if any(c.isspace() for c in username):
            return Response(
                {"detail": "Username tidak boleh mengandung spasi"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {
                    "detail": "Username sudah dipakai",
                    "suggestions": username_suggestions(username),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # No password yet — the child sets it via a setup token.
        user = User.objects.create_user(username=username)
        user.set_unusable_password()
        user.save(update_fields=["password"])
        child.user = user
        child.save(update_fields=["user"])

        return Response(
            {"username": user.username, "child_id": child.id},
            status=status.HTTP_201_CREATED,
        )


class SetupTokenView(APIView):
    """POST generate a one-time password-setup token (parent only)."""

    def post(self, request, child_pk):
        child = _get_parent_child(request.user, child_pk)
        if child is None:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if child.user_id is None:
            return Response(
                {"detail": "Buat akun anak dulu"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = PasswordSetupToken.generate(child=child, created_by=request.user)
        return Response(
            {
                "code": token.code,
                "setup_url": setup_url_for(token.code),
                "expires_at": token.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class ChildSetupView(APIView):
    """POST anon: child sets own password using a one-time code (setup/reset)."""

    permission_classes = [AllowAny]

    def post(self, request):
        code = (request.data.get("code") or "").strip().upper()
        password = request.data.get("password") or ""

        token = PasswordSetupToken.objects.filter(code=code).first()
        if token is None or not token.is_valid():
            return Response(
                {"detail": "Kode tidak valid atau sudah kedaluwarsa"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_child_password(password)
        except DjangoValidationError as exc:
            return Response(
                {"detail": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        child = token.child
        user = child.user
        if user is None:
            return Response(
                {"detail": "Akun anak tidak ditemukan"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save(update_fields=["password"])
        token.mark_used()

        auth_token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": auth_token.key, "child": ChildSerializer(child).data},
            status=status.HTTP_200_OK,
        )


class ChildLoginView(APIView):
    """POST anon: child login with username+password, progressive lockout."""

    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        if LoginLockout.is_locked(username):
            return Response(
                {"detail": "Terlalu banyak percobaan. Coba lagi nanti."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = authenticate(username=username, password=password)

        if user is not None and not is_child_account(user):
            # A guardian account must use the regular login endpoint.
            return Response(
                {"detail": "Akun ini bukan akun anak"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user is None:
            LoginLockout.record_failure(username)
            return Response(
                {"detail": "Username atau password salah"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        LoginLockout.reset(username)
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "child": ChildSerializer(user.child_profile).data}
        )
