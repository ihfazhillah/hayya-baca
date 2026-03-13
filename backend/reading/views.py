from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child
from accounts.permissions import IsParentOrReadOnlyTeacher
from games.models import GameSession
from rewards.models import RewardHistory
from .models import QuizAttempt, ReadingProgress
from .serializers import QuizAttemptSerializer, ReadingProgressSerializer


class ReadingProgressViewSet(viewsets.ModelViewSet):
    serializer_class = ReadingProgressSerializer
    permission_classes = [IsAuthenticated, IsParentOrReadOnlyTeacher]

    def get_queryset(self):
        return ReadingProgress.objects.filter(child_id=self.kwargs["child_pk"])

    def perform_create(self, serializer):
        serializer.save(child_id=self.kwargs["child_pk"])


class QuizAttemptViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    serializer_class = QuizAttemptSerializer
    permission_classes = [IsAuthenticated, IsParentOrReadOnlyTeacher]

    def get_queryset(self):
        return QuizAttempt.objects.filter(child_id=self.kwargs["child_pk"])

    def perform_create(self, serializer):
        serializer.save(child_id=self.kwargs["child_pk"])


class ActivityTimelineView(APIView):
    """Combined activity timeline for a child's parent dashboard."""
    permission_classes = [AllowAny]

    def get(self, request, child_pk):
        child = Child.objects.get(id=child_pk)

        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        # Gather activities from all sources
        entries = []

        # Reading progress
        for rp in ReadingProgress.objects.filter(child=child).select_related("book"):
            entries.append({
                "type": "read",
                "timestamp": rp.updated_at,
                "description": f"Membaca: {rp.book.title}",
                "details": {
                    "book_title": rp.book.title,
                    "book_slug": rp.book.slug,
                    "last_page": rp.last_page,
                    "completed": rp.completed,
                },
            })

        # Quiz attempts
        for qa in QuizAttempt.objects.filter(child=child).select_related("book"):
            entries.append({
                "type": "quiz",
                "timestamp": qa.created_at,
                "description": f"Kuis: {qa.book.title}",
                "details": {
                    "book_title": qa.book.title,
                    "book_slug": qa.book.slug,
                    "score": qa.score,
                    "total": qa.total,
                    "stars_earned": qa.stars_earned,
                },
            })

        # Reward history
        for rh in RewardHistory.objects.filter(child=child):
            entries.append({
                "type": "reward",
                "timestamp": rh.created_at,
                "description": rh.description or f"Dapat {rh.count} {rh.type}",
                "details": {
                    "reward_type": rh.type,
                    "count": rh.count,
                },
            })

        # Game sessions
        for gs in GameSession.objects.filter(child=child).select_related("game"):
            duration = None
            if gs.ended_at and gs.started_at:
                duration = int((gs.ended_at - gs.started_at).total_seconds() / 60)
            entries.append({
                "type": "game",
                "timestamp": gs.started_at,
                "description": f"Bermain: {gs.game.title}",
                "details": {
                    "game_title": gs.game.title,
                    "game_slug": gs.game.slug,
                    "coins_spent": gs.coins_spent,
                    "duration_minutes": duration,
                    "score": gs.score,
                },
            })

        # Sort by timestamp descending
        entries.sort(key=lambda e: e["timestamp"], reverse=True)

        total_count = len(entries)
        page = entries[offset:offset + limit]

        # Build next link
        next_offset = offset + limit
        next_link = None
        if next_offset < total_count:
            next_link = f"?limit={limit}&offset={next_offset}"

        return Response({
            "results": page,
            "count": total_count,
            "next": next_link,
        })
