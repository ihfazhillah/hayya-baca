from rest_framework import serializers

from .models import RewardHistory


class RewardHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RewardHistory
        fields = [
            "id", "child", "type", "count", "description", "created_at",
            "synced", "source_device", "voided", "idempotency_key",
        ]
        read_only_fields = ["id", "created_at"]


class RewardSyncItemSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=RewardHistory.Type.choices)
    count = serializers.IntegerField()
    description = serializers.CharField(required=False, default="")
    created_at = serializers.DateTimeField(required=False)
    idempotency_key = serializers.CharField(required=False, default=None, allow_null=True)


class DeviceTelemetrySerializer(serializers.Serializer):
    device_id = serializers.CharField(required=False, allow_blank=True, default="")
    app_version = serializers.CharField(required=False, allow_blank=True, default="")
    queue_depth_rewards = serializers.IntegerField(required=False, default=0, min_value=0)
    queue_depth_progress = serializers.IntegerField(required=False, default=0, min_value=0)
    last_successful_sync_at = serializers.DateTimeField(required=False, allow_null=True, default=None)
    last_sync_error = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")


class BulkRewardSyncSerializer(serializers.Serializer):
    rewards = RewardSyncItemSerializer(many=True)
    telemetry = DeviceTelemetrySerializer(required=False)

    def create(self, validated_data):
        child = self.context["child"]
        request = self.context.get("request")
        device_id = ""
        if request:
            device_id = request.META.get("HTTP_X_DEVICE_ID", "")

        created = []
        skipped = 0
        total_coins = 0
        total_stars = 0

        for entry in validated_data["rewards"]:
            idem_key = entry.get("idempotency_key")

            # Skip duplicates by idempotency key
            if idem_key and RewardHistory.objects.filter(idempotency_key=idem_key).exists():
                skipped += 1
                continue

            reward = RewardHistory.objects.create(
                child=child,
                type=entry["type"],
                count=entry["count"],
                description=entry.get("description", ""),
                synced=True,
                source_device=device_id,
                idempotency_key=idem_key,
            )
            created.append(reward)
            if entry["type"] in (
                RewardHistory.Type.COIN,
                RewardHistory.Type.COIN_ADJ,
                RewardHistory.Type.COIN_SPEND,
            ):
                total_coins += entry["count"]
            elif entry["type"] in (RewardHistory.Type.STAR, RewardHistory.Type.STAR_ADJ):
                total_stars += entry["count"]

        if total_coins:
            child.coins += total_coins
        if total_stars:
            child.stars += total_stars
        if total_coins or total_stars:
            child.save(update_fields=["coins", "stars"])

        # Store skipped count for view to log
        self._skipped = skipped
        self._device_id = device_id

        return created
