"""Serializers for Ruang Cerita diary (Spec 060)."""
from rest_framework import serializers

from accounts.models import is_child_account

from .models import ComicPanel, Comment, Post, PostType
from .prosemirror import InvalidDocument, validate_prosemirror


def validate_prosemirror_body(value):
    try:
        validate_prosemirror(value)
    except InvalidDocument as exc:
        raise serializers.ValidationError(str(exc))
    return value


def author_label(user):
    """Display name: the child's name for a child account, else username."""
    if is_child_account(user):
        return user.child_profile.name
    return user.username


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


class CommentSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(source="author.id", read_only=True)
    author_label = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "body",
            "author_id",
            "author_label",
            "author_role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_author_label(self, obj):
        return author_label(obj.author)

    def get_author_role(self, obj):
        return "child" if is_child_account(obj.author) else "guardian"

    def validate_body(self, value):
        return validate_prosemirror_body(value)
