"""Views for child diary accounts (Spec 060 — Ruang Cerita, Fase 1)."""
import secrets

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChildAccess, PasswordSetupToken

User = get_user_model()


def _is_parent_of(user, child_id):
    return ChildAccess.objects.filter(
        user=user, child_id=child_id, role=ChildAccess.Role.PARENT
    ).exists()


def _get_parent_child(user, child_id):
    """Return the Child if `user` is a parent of it, else None."""
    from .models import Child

    if not _is_parent_of(user, child_id):
        return None
    return Child.objects.filter(id=child_id).first()


def username_suggestions(base, count=3):
    """Free username candidates: base + 2 random digits."""
    suggestions = []
    attempts = 0
    while len(suggestions) < count and attempts < 50:
        attempts += 1
        candidate = f"{base}{secrets.randbelow(90) + 10}"
        if candidate in suggestions:
            continue
        if not User.objects.filter(username=candidate).exists():
            suggestions.append(candidate)
    return suggestions


class DiaryAccountView(APIView):
    """POST create the diary login account for a child (parent only)."""

    def post(self, request, child_pk):
        child = _get_parent_child(request.user, child_pk)
        if child is None:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if child.user_id is not None:
            return Response(
                {"detail": "Anak ini sudah punya akun"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = (request.data.get("username") or "").strip()
        if not username:
            return Response(
                {"detail": "Username wajib diisi"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {
                    "detail": "Username sudah dipakai",
                    "suggestions": username_suggestions(username),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # No password yet — the child sets it via a setup token.
        user = User.objects.create_user(username=username)
        user.set_unusable_password()
        user.save(update_fields=["password"])
        child.user = user
        child.save(update_fields=["user"])

        return Response(
            {"username": user.username, "child_id": child.id},
            status=status.HTTP_201_CREATED,
        )
