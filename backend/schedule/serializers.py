from rest_framework import serializers

from accounts.models import is_child_account

from .models import ScheduleTask


class ScheduleTaskSerializer(serializers.ModelSerializer):
    from_guardian = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleTask
        fields = [
            "id",
            "title",
            "part_of_day",
            "kind",
            "repeat_days",
            "date",
            "emoji",
            "order",
            "archived",
            "from_guardian",
            "created_at",
        ]
        read_only_fields = ["id", "from_guardian", "created_at"]

    def get_from_guardian(self, obj):
        return bool(obj.created_by_id and not is_child_account(obj.created_by))

    def _field(self, data, name):
        if name in data:
            return data[name]
        return getattr(self.instance, name, None)

    def validate(self, data):
        kind = self._field(data, "kind")
        if kind == ScheduleTask.Kind.ROUTINE:
            days = self._field(data, "repeat_days")
            if not days or not all(
                isinstance(x, int) and 0 <= x <= 6 for x in days
            ):
                raise serializers.ValidationError(
                    {"repeat_days": "Pilih minimal satu hari (0–6)"}
                )
            data["date"] = None
        elif kind == ScheduleTask.Kind.ONCE:
            if not self._field(data, "date"):
                raise serializers.ValidationError(
                    {"date": "Tanggal wajib untuk tugas sekali"}
                )
            data["repeat_days"] = []
        return data
