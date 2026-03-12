from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import ChildAccess


class HasChildAccess(BasePermission):
    """User must have any ChildAccess to the child."""

    def _get_child_id(self, view, obj=None):
        if obj and hasattr(obj, "child_id"):
            return obj.child_id
        if obj and hasattr(obj, "id") and obj.__class__.__name__ == "Child":
            return obj.id
        return view.kwargs.get("child_pk") or view.kwargs.get("pk")

    def has_object_permission(self, request, view, obj):
        child_id = self._get_child_id(view, obj)
        return ChildAccess.objects.filter(
            user=request.user, child_id=child_id
        ).exists()


class IsParentOfChild(HasChildAccess):
    """User must be a parent of the child."""

    def has_object_permission(self, request, view, obj):
        child_id = self._get_child_id(view, obj)
        return ChildAccess.objects.filter(
            user=request.user, child_id=child_id, role=ChildAccess.Role.PARENT
        ).exists()


class IsParentOrReadOnlyTeacher(HasChildAccess):
    """Parent: full access. Teacher: read-only."""

    def has_object_permission(self, request, view, obj):
        child_id = self._get_child_id(view, obj)
        access = ChildAccess.objects.filter(
            user=request.user, child_id=child_id
        ).first()
        if not access:
            return False
        if access.role == ChildAccess.Role.PARENT:
            return True
        return request.method in SAFE_METHODS
