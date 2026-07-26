"""Permissions for Ruang Cerita diary (Spec 060)."""
from rest_framework.permissions import BasePermission

from accounts.models import ChildAccess, is_child_account


class IsChildAccount(BasePermission):
    """Authenticated child diary account."""

    message = "Hanya untuk akun anak"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_child_account(user))


class IsGuardianOfPost(BasePermission):
    """Guardian (parent role) of the post's child."""

    def has_object_permission(self, request, view, obj):
        return ChildAccess.objects.filter(
            user=request.user,
            child_id=obj.child_id,
            role=ChildAccess.Role.PARENT,
        ).exists()
