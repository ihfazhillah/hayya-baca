from django.db.models import F
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

    def validate(self, attrs):
        # KB-3: reject any push whose coin_spend rows would drive child.coins
        # below zero. Mobile already guards in UI, but a stale/desynced local
        # balance can still submit an over-spend. Without this check the row
        # lands and the child is left with negative coins that propagates to
        # every device on the next pull.
        #
        # Only NEW rows count: duplicates filtered by idempotency_key can't
        # move the balance, so pre-count them out to avoid false rejects on
        # retry after a mid-flight response loss (OL-1 path).
        child = self.context["child"]
        incoming = attrs["rewards"]
        new_coin_delta = 0
        for entry in incoming:
            idem_key = entry.get("idempotency_key")
            if idem_key and RewardHistory.objects.filter(idempotency_key=idem_key).exists():
                continue
            if entry["type"] in (
                RewardHistory.Type.COIN,
                RewardHistory.Type.COIN_ADJ,
                RewardHistory.Type.COIN_SPEND,
            ):
                new_coin_delta += entry["count"]
        if new_coin_delta < 0 and (child.coins + new_coin_delta) < 0:
            raise serializers.ValidationError({
                "rewards": (
                    f"Insufficient balance: saldo {child.coins} koin, "
                    f"butuh {-new_coin_delta} koin."
                )
            })
        return attrs

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

        # Atomic delta via F() — two devices pushing in parallel both
        # load child.coins=0 before either saves, so the naive
        # "child.coins += total; child.save()" pattern loses the earlier
        # write. F() issues `UPDATE ... SET coins = coins + delta` at
        # the DB level (MD-1).
        updates = {}
        if total_coins:
            updates["coins"] = F("coins") + total_coins
        if total_stars:
            updates["stars"] = F("stars") + total_stars
        if updates:
            type(child).objects.filter(pk=child.pk).update(**updates)
            child.refresh_from_db(fields=list(updates.keys()))

        # Store skipped count for view to log
        self._skipped = skipped
        self._device_id = device_id

        return created
