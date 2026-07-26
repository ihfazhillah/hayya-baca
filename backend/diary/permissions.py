"""Permissions for Ruang Cerita diary (Spec 060)."""
from rest_framework.permissions import BasePermission

from accounts.models import ChildAccess, is_child_account


def is_guardian_of(user, child_id):
    return ChildAccess.objects.filter(
        user=user, child_id=child_id, role=ChildAccess.Role.PARENT
    ).exists()


def resolve_accessible_post(user, post_id):
    """Return a post `user` may interact with, else None (→ 404).

    Child owner: any of their own (non-deleted) posts.
    Guardian (parent): only published, non-deleted posts of their children.
    Everyone else, and drafts for guardians: None.
    """
    from .models import Post

    post = Post.objects.filter(pk=post_id).first()  # excludes soft-deleted
    if post is None:
        return None

    if is_child_account(user):
        return post if post.child_id == user.child_profile.id else None

    if post.status != Post.Status.PUBLISHED:
        return None
    return post if is_guardian_of(user, post.child_id) else None


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
