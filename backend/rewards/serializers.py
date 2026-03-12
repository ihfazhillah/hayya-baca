from rest_framework import serializers

from .models import RewardHistory


class RewardHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RewardHistory
        fields = ["id", "child", "type", "count", "description", "created_at", "synced"]
        read_only_fields = ["id", "created_at"]


class RewardSyncItemSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=RewardHistory.Type.choices)
    count = serializers.IntegerField()
    description = serializers.CharField(required=False, default="")
    created_at = serializers.DateTimeField(required=False)


class BulkRewardSyncSerializer(serializers.Serializer):
    rewards = RewardSyncItemSerializer(many=True)

    def create(self, validated_data):
        child = self.context["child"]
        created = []
        total_coins = 0
        total_stars = 0

        for entry in validated_data["rewards"]:
            reward = RewardHistory.objects.create(
                child=child,
                type=entry["type"],
                count=entry["count"],
                description=entry.get("description", ""),
                synced=True,
            )
            created.append(reward)
            if entry["type"] == RewardHistory.Type.COIN:
                total_coins += entry["count"]
            else:
                total_stars += entry["count"]

        if total_coins:
            child.coins += total_coins
        if total_stars:
            child.stars += total_stars
        if total_coins or total_stars:
            child.save(update_fields=["coins", "stars"])

        return created
