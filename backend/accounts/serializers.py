import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import Child, ChildAccess, ShareInvite

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username sudah dipakai")
        return value

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Password tidak cocok"})
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ChildSerializer(serializers.ModelSerializer):
    class Meta:
        model = Child
        fields = ["id", "name", "age", "avatar_color", "coins", "stars", "created_at"]
        read_only_fields = ["id", "coins", "stars", "created_at"]


class ChildAccessSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ChildAccess
        fields = ["id", "username", "role", "created_at"]
        read_only_fields = ["id", "created_at"]


class ShareInviteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShareInvite
        fields = ["id", "child", "code", "role", "expires_at"]
        read_only_fields = ["id", "code", "expires_at"]

    def create(self, validated_data):
        validated_data["code"] = secrets.token_hex(4)[:8].upper()
        validated_data["expires_at"] = timezone.now() + timedelta(hours=48)
        validated_data["invited_by"] = self.context["request"].user
        return super().create(validated_data)


class RedeemInviteSerializer(serializers.Serializer):
    code = serializers.CharField()

    def validate_code(self, value):
        try:
            invite = ShareInvite.objects.get(code=value.upper(), used=False)
        except ShareInvite.DoesNotExist:
            raise serializers.ValidationError("Kode tidak valid")
        if invite.expires_at < timezone.now():
            raise serializers.ValidationError("Kode sudah kedaluwarsa")
        self._invite = invite
        return value

    def create(self, validated_data):
        invite = self._invite
        user = self.context["request"].user

        if ChildAccess.objects.filter(user=user, child=invite.child).exists():
            raise serializers.ValidationError("Anda sudah punya akses ke anak ini")

        access = ChildAccess.objects.create(
            user=user, child=invite.child, role=invite.role
        )
        invite.used = True
        invite.save(update_fields=["used"])
        return access
