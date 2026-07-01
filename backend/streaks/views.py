from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess
from .models import Badge, Streak, StreakIdempotencyKey
from .serializers import (
    StreakCheckSerializer,
    StreakStatusSerializer,
    StreakSyncSerializer,
    StreakSyncBulkSerializer,
)


def _process_streak_entry(streak, child, entry, today):
    """Process a single streak entry. Returns dict with status info."""
    reading_date = entry["reading_date"]
    idempotency_key = entry.get("idempotency_key")
    skipped = False

    # Idempotency check
    if idempotency_key:
        if StreakIdempotencyKey.objects.filter(
            key=idempotency_key, child=child, reading_date=reading_date
        ).exists():
            return {"reading_date": reading_date, "status": "duplicate_key", "skipped": True}

    # Already read for this date?
    if streak.last_reading_date == reading_date:
        if idempotency_key:
            StreakIdempotencyKey.objects.get_or_create(
                key=idempotency_key,
                defaults={"child": child, "reading_date": reading_date},
            )
        return {"reading_date": reading_date, "status": "already_read", "skipped": True}

    # Grace period check
    if streak.last_reading_date and _check_grace_period(streak, today):
        streak.current_streak = 0
        streak.grace_period_end_date = None

    # Advance streak
    streak.current_streak += 1
    streak.last_reading_date = reading_date
    streak.grace_period_end_date = today + timezone.timedelta(days=3)

    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    streak.save(update_fields=[
        "current_streak", "longest_streak", "last_reading_date",
        "grace_period_end_date",
    ])
    _advance_badge(streak)

    if idempotency_key:
        StreakIdempotencyKey.objects.get_or_create(
            key=idempotency_key,
            defaults={"child": child, "reading_date": reading_date},
        )

    return {"reading_date": reading_date, "status": "processed", "skipped": False}


def _get_or_create_streak(child):
    return Streak.objects.get_or_create(child=child)[0]


def _advance_badge(streak):
    """Update badge based on current_streak."""
    badge = Badge.objects.filter(day_threshold__lte=streak.current_streak).order_by("-day_threshold").first()
    if badge and streak.badge != badge:
        streak.badge = badge
        streak.save(update_fields=["badge"])


def _check_grace_period(streak, today=None):
    """Return True if grace period has expired (streak should reset)."""
    if today is None:
        today = timezone.now().date()
    if streak.grace_period_end_date and today > streak.grace_period_end_date:
        return True
    return False


def _compute_effective_streak(streak, today=None):
    """Return the effective current_streak without writing to DB.

    If grace period has expired, return 0. Otherwise return stored value.
    This avoids "lazy reset" — DB is only updated during sync.
    """
    if _check_grace_period(streak, today):
        return 0
    return streak.current_streak


class StreakSyncView(APIView):
    """Accept offline streak data from device, validate and update server records."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=StreakSyncSerializer, responses={200: StreakStatusSerializer})
    def post(self, request, child_pk):
        # Access check
        if not ChildAccess.objects.filter(user=request.user, child_id=child_pk).exists():
            raise PermissionDenied("No access to this child")

        child = Child.objects.get(id=child_pk)
        serializer = StreakSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        reading_date = data["reading_date"]

        # Quiz must be passed for streak credit
        if not data["quiz_passed"]:
            return Response(
                {"detail": "Quiz not passed — no streak credit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().date()

        # Accept reading_date within ±1 day of today to handle timezone
        # differences between device (WIB/UTC+7) and server (UTC).
        if abs((reading_date - today).days) > 1:
            return Response(
                {"detail": f"reading_date must be within 1 day of today ({today})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            streak = Streak.objects.select_for_update().get_or_create(
                child=child
            )[0]

            result = _process_streak_entry(streak, child, data, today)

        return Response(
            StreakStatusSerializer(streak).data,
            status=status.HTTP_200_OK,
        )


class StreakSyncBulkView(APIView):
    """Accept a batch of offline streak entries from device, process in date order."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=StreakSyncBulkSerializer, responses={200: dict})
    def post(self, request, child_pk):
        # Access check
        if not ChildAccess.objects.filter(user=request.user, child_id=child_pk).exists():
            raise PermissionDenied("No access to this child")

        child = Child.objects.get(id=child_pk)
        serializer = StreakSyncBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        today = timezone.now().date()
        entries = serializer.validated_data["entries"]

        # Validate all entries
        for entry in entries:
            if not entry["quiz_passed"]:
                return Response(
                    {"detail": "All entries must have quiz_passed=true."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            reading_date = entry["reading_date"]
            if abs((reading_date - today).days) > 1:
                return Response(
                    {"detail": f"reading_date must be within 1 day of today ({today})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Sort by reading_date ascending — streak logic depends on order
        entries.sort(key=lambda e: e["reading_date"])

        results = []
        with transaction.atomic():
            streak = Streak.objects.select_for_update().get_or_create(
                child=child
            )[0]

            for entry in entries:
                result = _process_streak_entry(streak, child, entry, today)
                results.append(result)

        return Response({
            "results": results,
            "processed": sum(1 for r in results if r["status"] == "processed"),
            "skipped": sum(1 for r in results if r["skipped"]),
            "streak": StreakStatusSerializer(streak).data,
        }, status=status.HTTP_200_OK)


class StreakStatusView(APIView):
    """Return current streak, badge level, grace period status."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=StreakStatusSerializer)
    def get(self, request, child_pk):
        if not ChildAccess.objects.filter(user=request.user, child_id=child_pk).exists():
            raise PermissionDenied("No access to this child")

        child = Child.objects.get(id=child_pk)
        streak = _get_or_create_streak(child)

        # Compute effective streak on-the-fly — do NOT mutate DB
        effective_streak = _compute_effective_streak(streak)

        # Build response data: override current_streak with computed value
        serializer_data = StreakStatusSerializer(streak).data
        serializer_data["current_streak"] = effective_streak

        return Response(serializer_data)


class StreakCheckView(APIView):
    """Check if daily requirement met (1 book/article + quiz completed)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=StreakCheckSerializer, responses={200: dict})
    def post(self, request, child_pk):
        if not ChildAccess.objects.filter(user=request.user, child_id=child_pk).exists():
            raise PermissionDenied("No access to this child")

        child = Child.objects.get(id=child_pk)
        serializer = StreakCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        score = data["quiz_score"]
        total = data["quiz_total"]
        passed = (score / total) >= 0.5 if total > 0 else False

        streak = _get_or_create_streak(child)
        today = timezone.now().date()
        # ±1-day tolerance to handle WIB/UTC offset
        already_read = (
            streak.last_reading_date is not None
            and abs((streak.last_reading_date - today).days) <= 1
        )

        return Response({
            "child_id": child.pk,
            "quiz_passed": passed,
            "can_advance_streak": passed and not already_read,
            "already_read_today": already_read,
            "current_streak": _compute_effective_streak(streak, today),
            "longest_streak": streak.longest_streak,
        })
