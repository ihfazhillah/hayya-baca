"""Tests for child diary accounts (Spec 060 — Ruang Cerita, Fase 1)."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from .models import Child, ChildAccess, is_child_account

User = get_user_model()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


@pytest.fixture
def child(parent):
    child = Child.objects.create(name="Ahmad", age=8, created_by=parent)
    ChildAccess.objects.create(user=parent, child=child, role=ChildAccess.Role.PARENT)
    return child


# === T1.1: Child.user + is_child_account helper ===


class TestChildAccountHelper:
    def test_child_can_be_linked_to_user(self, child, db):
        child_user = User.objects.create_user(username="ahmad", password="kucing1")
        child.user = child_user
        child.save()
        child.refresh_from_db()
        assert child.user_id == child_user.id
        assert child_user.child_profile == child

    def test_is_child_account_true_for_linked_user(self, child, db):
        child_user = User.objects.create_user(username="ahmad", password="kucing1")
        child.user = child_user
        child.save()
        assert is_child_account(child_user) is True

    def test_is_child_account_false_for_guardian(self, parent):
        assert is_child_account(parent) is False

    def test_is_child_account_false_for_anonymous(self, db):
        assert is_child_account(AnonymousUser()) is False
