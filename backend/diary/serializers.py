"""Serializers for Ruang Cerita diary (Spec 060)."""
from rest_framework import serializers

from .models import ComicPanel, Post, PostType
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


class ComicPanelSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ComicPanel
        fields = ["id", "order", "caption", "image_url"]

    def get_image_url(self, obj):
        from .media import signed_panel_url

        return signed_panel_url(obj, self.context.get("request"))
