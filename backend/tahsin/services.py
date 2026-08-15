"""Role resolution + pengampu-account lifecycle (Spec 072)."""
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from accounts.models import is_child_account

from .models import Santri, generate_login_code, make_pengampu_username

User = get_user_model()


class RoleDenied(Exception):
    """The authenticated user may not use the Tahsin app at all."""


def resolve_role(user):
    """Return (role, owner, santri).

    - pengampu: a Santri(user=me, is_pengampu, active) exists → owner is that
      santri's owner (the guardian), santri is the pengampu row.
    - guardian: any other non-child account → owner is the user itself.
    - child diary account with no pengampu profile → RoleDenied.
    """
    santri = (
        Santri.objects.filter(user=user, is_pengampu=True, is_active=True)
        .select_related("owner")
        .first()
    )
    if santri is not None:
        return "pengampu", santri.owner, santri
    if is_child_account(user):
        raise RoleDenied("Akun ini tidak punya akses Tahsin")
    return "guardian", user, None


def ensure_pengampu_account(santri):
    """Give a pengampu santri a login User + login_code (idempotent)."""
    changed = []
    if santri.user is None:
        santri.user = User.objects.create(
            username=make_pengampu_username(santri.owner, santri.name)
        )
        santri.user.set_unusable_password()
        santri.user.save()
        changed.append("user")
    if not santri.login_code:
        santri.login_code = generate_login_code()
        changed.append("login_code")
    if changed:
        santri.save(update_fields=changed)
    return santri


def revoke_pengampu_account(santri):
    """Drop login_code + auth token when a santri is no longer a pengampu.

    The User row is kept (records reference it as created_by).
    """
    if santri.user_id:
        Token.objects.filter(user_id=santri.user_id).delete()
    if santri.login_code:
        santri.login_code = None
        santri.save(update_fields=["login_code"])


def regenerate_login_code(santri):
    """New permanent code; old code + existing session token are killed."""
    if santri.user_id:
        Token.objects.filter(user_id=santri.user_id).delete()
    santri.login_code = generate_login_code()
    santri.save(update_fields=["login_code"])
    return santri.login_code
