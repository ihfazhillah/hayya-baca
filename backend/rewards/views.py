from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess
from accounts.permissions import IsParentOrReadOnlyTeacher
from sync.models import SyncLog, DeviceTelemetry
from .models import RewardHistory
from .serializers import BulkRewardSyncSerializer, RewardHistorySerializer


class RewardHistoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = RewardHistorySerializer
    permission_classes = [IsAuthenticated, IsParentOrReadOnlyTeacher]

    def get_queryset(self):
        return RewardHistory.objects.filter(child_id=self.kwargs["child_pk"])


class BulkRewardSyncView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=BulkRewardSyncSerializer, responses={201: None})
    def post(self, request, child_pk):
        # BC-2: enforce ChildAccess so a leaked/guessed child_pk from
        # another user cannot be used to inject ghost rewards.
        # IsParentOrReadOnlyTeacher only fires via has_object_permission,
        # which APIView.post() never invokes — check explicitly.
        if not ChildAccess.objects.filter(
            user=request.user, child_id=child_pk
        ).exists():
            raise PermissionDenied("No access to this child")
        child = Child.objects.get(id=child_pk)
        serializer = BulkRewardSyncSerializer(
            data=request.data, context={"child": child, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()

        # Log sync event
        device_id = request.META.get("HTTP_X_DEVICE_ID", "")
        device_name = request.META.get("HTTP_X_DEVICE_NAME", "")
        skipped = getattr(serializer, "_skipped", 0)
        details = f"created={len(created)}, skipped={skipped}" if skipped else ""
        SyncLog.objects.create(
            user=request.user,
            device_id=device_id,
            device_name=device_name,
            child=child,
            action=SyncLog.Action.PUSH_REWARDS,
            item_count=len(created),
            details=details,
        )

        telemetry = serializer.validated_data.get("telemetry") or {}
        telemetry_device_id = telemetry.get("device_id") or device_id
        if telemetry_device_id:
            DeviceTelemetry.objects.update_or_create(
                user=request.user,
                device_id=telemetry_device_id,
                defaults={
                    "device_name": device_name,
                    "app_version": telemetry.get("app_version", "") or "",
                    "queue_depth_rewards": telemetry.get("queue_depth_rewards", 0) or 0,
                    "queue_depth_progress": telemetry.get("queue_depth_progress", 0) or 0,
                    "last_successful_sync_at": telemetry.get("last_successful_sync_at"),
                    "last_sync_error": telemetry.get("last_sync_error") or "",
                },
            )

        # Surface skipped count so clients can detect idempotency-key
        # collisions (ID-1). Without this, a second device pushing under
        # a duplicated device id would silently lose writes: the server
        # dedupes on the global idempotency_key, returns 201, and the
        # client marks its rewards synced even though they never
        # landed.
        return Response(
            {
                "detail": "Synced",
                "created": len(created),
                "skipped": skipped,
            },
            status=status.HTTP_201_CREATED,
        )


class BalanceView(APIView):
    """Current coin/star balance with recent transactions."""
    permission_classes = [AllowAny]

    def get(self, request, child_pk):
        child = Child.objects.get(id=child_pk)

        limit = int(request.query_params.get("limit", 10))
        recent = RewardHistory.objects.filter(child=child).order_by("-created_at")[:limit]

        return Response({
            "coins": child.coins,
            "stars": child.stars,
            "recent_transactions": [
                {
                    "type": rh.type,
                    "count": rh.count,
                    "description": rh.description,
                    "created_at": rh.created_at,
                }
                for rh in recent
            ],
        })
