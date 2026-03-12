from rest_framework import serializers

from .models import Game, GameSession


class GameListSerializer(serializers.ModelSerializer):
    bundle_url = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = [
            "slug", "title", "description", "icon", "category", "difficulty",
            "coin_cost", "session_minutes", "min_age",
            "bundle_version", "bundle_url",
        ]

    def get_bundle_url(self, obj):
        if not obj.bundle:
            return None
        request = self.context.get("request")
        # Serve extracted folder, not the zip
        url = f"/media/games/{obj.slug}/"
        if request:
            return request.build_absolute_uri(url)
        return url


class PlayGameSerializer(serializers.Serializer):
    child_id = serializers.IntegerField()


class GameSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameSession
        fields = ["id", "child", "game", "coins_spent", "started_at", "expires_at", "score", "ended_at"]
