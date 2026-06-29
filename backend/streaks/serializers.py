from rest_framework import serializers

from .models import Badge, Streak


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ["id", "level", "name", "icon_reference", "day_threshold"]


class StreakStatusSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)
    grace_period_active = serializers.SerializerMethodField()
    grace_days_remaining = serializers.SerializerMethodField()
    # Aliases for frontend compatibility
    grace_active = serializers.SerializerMethodField()
    badge_level = serializers.SerializerMethodField()

    class Meta:
        model = Streak
        fields = [
            "id",
            "child",
            "current_streak",
            "longest_streak",
            "last_reading_date",
            "grace_period_end_date",
            "badge",
            "grace_period_active",
            "grace_days_remaining",
            "grace_active",
            "badge_level",
        ]

    def get_grace_period_active(self, obj):
        if obj.grace_period_end_date is None:
            return False
        from django.utils import timezone
        return timezone.now().date() <= obj.grace_period_end_date

    def get_grace_days_remaining(self, obj):
        if obj.grace_period_end_date is None:
            return None
        from django.utils import timezone
        delta = obj.grace_period_end_date - timezone.now().date()
        return max(delta.days, 0)

    def get_grace_active(self, obj):
        return self.get_grace_period_active(obj)

    def get_badge_level(self, obj):
        return obj.badge.level if obj.badge else None


class StreakSyncSerializer(serializers.Serializer):
    reading_date = serializers.DateField()
    content_type = serializers.ChoiceField(choices=["book", "article"])
    content_id = serializers.CharField(max_length=255)
    quiz_passed = serializers.BooleanField()
    device_id = serializers.CharField(max_length=255, required=False, default="")


class StreakCheckSerializer(serializers.Serializer):
    content_type = serializers.ChoiceField(choices=["book", "article"])
    content_id = serializers.CharField(max_length=255)
    quiz_score = serializers.IntegerField(min_value=0)
    quiz_total = serializers.IntegerField(min_value=1)
