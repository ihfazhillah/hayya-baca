from accounts.models import ChildAccess


def is_parent_of(user, child_id):
    """True if `user` is a parent (ChildAccess role=parent) of the child."""
    return ChildAccess.objects.filter(
        user=user, child_id=child_id, role=ChildAccess.Role.PARENT
    ).exists()
