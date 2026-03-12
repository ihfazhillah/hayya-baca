from datetime import timedelta

from django.db import models
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import Child
from .models import Game, GameSession
from .serializers import GameListSerializer, GameSessionSerializer, PlayGameSerializer


class GameViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = GameListSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Game.objects.filter(is_published=True)

    @extend_schema(request=PlayGameSerializer, responses={201: GameSessionSerializer})
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def play(self, request, slug=None):
        """Start a game session — deduct coins, return session with expiry."""
        game = self.get_object()
        child_id = request.data.get("child_id")

        try:
            child = Child.objects.get(id=child_id, access__user=request.user)
        except Child.DoesNotExist:
            return Response({"detail": "Anak tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

        if child.coins < game.coin_cost:
            return Response(
                {"detail": "Koin tidak cukup", "required": game.coin_cost, "current": child.coins},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        # Deduct coins
        child.coins -= game.coin_cost
        child.save(update_fields=["coins"])

        # Create session
        session = GameSession.objects.create(
            child=child,
            game=game,
            coins_spent=game.coin_cost,
            expires_at=timezone.now() + timedelta(minutes=game.session_minutes),
        )

        # Increment play count
        Game.objects.filter(pk=game.pk).update(play_count=models.F("play_count") + 1)

        return Response(GameSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=PlayGameSerializer, responses={200: GameSessionSerializer})
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def extend(self, request, slug=None):
        """Extend active session — deduct coins again, extend expiry."""
        game = self.get_object()
        child_id = request.data.get("child_id")

        try:
            child = Child.objects.get(id=child_id, access__user=request.user)
        except Child.DoesNotExist:
            return Response({"detail": "Anak tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

        session = GameSession.objects.filter(
            child=child, game=game, ended_at__isnull=True
        ).order_by("-started_at").first()

        if not session:
            return Response({"detail": "Tidak ada sesi aktif"}, status=status.HTTP_404_NOT_FOUND)

        if child.coins < game.coin_cost:
            return Response(
                {"detail": "Koin tidak cukup", "required": game.coin_cost, "current": child.coins},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        child.coins -= game.coin_cost
        child.save(update_fields=["coins"])

        session.coins_spent += game.coin_cost
        session.expires_at += timedelta(minutes=game.session_minutes)
        session.save(update_fields=["coins_spent", "expires_at"])

        return Response(GameSessionSerializer(session).data)


class GameSessionEndView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: GameSessionSerializer})
    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        """End a game session, optionally report score."""
        try:
            session = GameSession.objects.get(pk=pk, child__access__user=request.user)
        except GameSession.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        session.ended_at = timezone.now()
        score = request.data.get("score")
        if score is not None:
            session.score = score
        session.save(update_fields=["ended_at", "score"])

        return Response(GameSessionSerializer(session).data)
