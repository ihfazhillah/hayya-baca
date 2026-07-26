"""Serializers for Ruang Cerita diary (Spec 060)."""
from rest_framework import serializers

from .models import Post, PostType
from .prosemirror import InvalidDocument, validate_prosemirror


class PostTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostType
        fields = ["slug", "label", "emoji", "kind", "order"]


class PostSerializer(serializers.ModelSerializer):
    type = serializers.SlugRelatedField(
        slug_field="slug", queryset=PostType.objects.all()
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "type",
            "title",
            "body",
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "published_at", "created_at", "updated_at"]

    def validate_body(self, value):
        if value is None:
            return value
        try:
            validate_prosemirror(value)
        except InvalidDocument as exc:
            raise serializers.ValidationError(str(exc))
        return value
