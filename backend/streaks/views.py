from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess
from .models import Badge, Streak
from .serializers import (
    StreakCheckSerializer,
    StreakStatusSerializer,
    StreakSyncSerializer,
)


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

            # Already read for this reading_date?
            if streak.last_reading_date == reading_date:
                return Response(
                    {"detail": "Already recorded a reading today."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Grace period check
            if streak.last_reading_date and _check_grace_period(streak, today):
                streak.current_streak = 0
                streak.grace_period_end_date = None

            # Advance streak
            streak.current_streak += 1
            streak.last_reading_date = reading_date
            streak.grace_period_end_date = today + timezone.timedelta(days=3)

            # Update longest streak
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak

            streak.save(update_fields=[
                "current_streak", "longest_streak", "last_reading_date",
                "grace_period_end_date",
            ])
            _advance_badge(streak)

        return Response(
            StreakStatusSerializer(streak).data,
            status=status.HTTP_200_OK,
        )


class StreakStatusView(APIView):
    """Return current streak, badge level, grace period status."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=StreakStatusSerializer)
    def get(self, request, child_pk):
        if not ChildAccess.objects.filter(user=request.user, child_id=child_pk).exists():
            raise PermissionDenied("No access to this child")

        child = Child.objects.get(id=child_pk)
        streak = _get_or_create_streak(child)

        # Check if grace expired
        if _check_grace_period(streak):
            streak.current_streak = 0
            streak.grace_period_end_date = None
            streak.save(update_fields=["current_streak", "grace_period_end_date"])
            _advance_badge(streak)

        return Response(StreakStatusSerializer(streak).data)


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
        already_read = streak.last_reading_date == today

        return Response({
            "child_id": child.pk,
            "quiz_passed": passed,
            "can_advance_streak": passed and not already_read,
            "already_read_today": already_read,
            "current_streak": streak.current_streak,
            "longest_streak": streak.longest_streak,
        })
