"""Tahsin serializers (Spec 072)."""
from django.db import transaction
from rest_framework import serializers

from .models import Santri, TahsinItem, TahsinRecord, TahsinScore


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TahsinItem
        fields = ["id", "name", "code", "order", "is_active"]
        read_only_fields = ["id"]


class SantriSerializer(serializers.ModelSerializer):
    has_login = serializers.SerializerMethodField()

    class Meta:
        model = Santri
        fields = [
            "id",
            "name",
            "is_pengampu",
            "pengampu",
            "is_active",
            "notes",
            "has_login",
        ]
        read_only_fields = ["id", "has_login"]

    def get_has_login(self, obj):
        return bool(obj.login_code)

    def validate_pengampu(self, value):
        if value is None:
            return value
        owner = self.context["owner"]
        if value.owner_id != owner.id:
            raise serializers.ValidationError("Pengampu bukan milik Anda")
        if not value.is_pengampu:
            raise serializers.ValidationError("Santri tujuan bukan pengampu")
        return value


class ScoreInSerializer(serializers.Serializer):
    item = serializers.IntegerField()
    value = serializers.IntegerField(min_value=0, max_value=5)


class ScoreOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = TahsinScore
        fields = ["item", "value"]


class RecordSerializer(serializers.ModelSerializer):
    scores = ScoreInSerializer(many=True, write_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TahsinRecord
        fields = [
            "id",
            "santri",
            "date",
            "page",
            "page_detail",
            "notes",
            "scores",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by_name", "created_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by_id else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["scores"] = ScoreOutSerializer(instance.scores.all(), many=True).data
        return data

    def validate_santri(self, value):
        allowed = self.context["allowed_santri_ids"]
        if value.id not in allowed:
            raise serializers.ValidationError("Santri tidak diizinkan")
        return value

    def validate_scores(self, scores):
        valid_items = self.context["valid_item_ids"]
        seen = set()
        for s in scores:
            if s["item"] not in valid_items:
                raise serializers.ValidationError(
                    f"Aspek {s['item']} tidak valid"
                )
            if s["item"] in seen:
                raise serializers.ValidationError("Aspek duplikat dalam satu catatan")
            seen.add(s["item"])
        return scores

    def _write_scores(self, record, scores):
        TahsinScore.objects.bulk_create(
            [
                TahsinScore(record=record, item_id=s["item"], value=s["value"])
                for s in scores
            ]
        )

    @transaction.atomic
    def create(self, validated):
        scores = validated.pop("scores", [])
        record = TahsinRecord.objects.create(
            owner=self.context["owner"],
            created_by=self.context["request"].user,
            **validated,
        )
        self._write_scores(record, scores)
        return record

    @transaction.atomic
    def update(self, instance, validated):
        scores = validated.pop("scores", None)
        for attr, val in validated.items():
            setattr(instance, attr, val)
        instance.save()
        if scores is not None:
            instance.scores.all().delete()
            self._write_scores(instance, scores)
        return instance
