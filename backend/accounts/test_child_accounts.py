"""Tests for child diary accounts (Spec 060 — Ruang Cerita, Fase 1)."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from django.utils import timezone
from datetime import timedelta

from .models import (
    Child,
    ChildAccess,
    LoginLockout,
    PasswordSetupToken,
    is_child_account,
)

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


# === T1.2: PasswordSetupToken + LoginLockout ===


class TestPasswordSetupToken:
    def test_generate_creates_valid_token(self, child, parent):
        token = PasswordSetupToken.generate(child=child, created_by=parent)
        assert len(token.code) == 8
        assert token.used_at is None
        assert token.expires_at > timezone.now()
        assert token.is_valid()

    def test_code_has_no_ambiguous_chars(self, child, parent):
        token = PasswordSetupToken.generate(child=child, created_by=parent)
        assert not (set(token.code) & set("O0I1L"))

    def test_generate_voids_previous_active_tokens(self, child, parent):
        old = PasswordSetupToken.generate(child=child, created_by=parent)
        PasswordSetupToken.generate(child=child, created_by=parent)
        old.refresh_from_db()
        assert not old.is_valid()

    def test_expired_token_is_invalid(self, child, parent):
        token = PasswordSetupToken.generate(child=child, created_by=parent)
        token.expires_at = timezone.now() - timedelta(minutes=1)
        token.save()
        assert not token.is_valid()

    def test_used_token_is_invalid(self, child, parent):
        token = PasswordSetupToken.generate(child=child, created_by=parent)
        token.mark_used()
        assert not token.is_valid()


class TestLoginLockout:
    def test_no_lock_before_threshold(self, db):
        for _ in range(4):
            LoginLockout.record_failure("ahmad")
        assert not LoginLockout.is_locked("ahmad")

    def test_locks_after_five_failures(self, db):
        for _ in range(5):
            LoginLockout.record_failure("ahmad")
        assert LoginLockout.is_locked("ahmad")

    def test_lock_duration_doubles(self, db):
        # 5th failure → 60s, 6th → 120s, capped at 900s
        assert LoginLockout.lock_seconds(5) == 60
        assert LoginLockout.lock_seconds(6) == 120
        assert LoginLockout.lock_seconds(7) == 240
        assert LoginLockout.lock_seconds(100) == 900

    def test_reset_clears_lock(self, db):
        for _ in range(5):
            LoginLockout.record_failure("ahmad")
        LoginLockout.reset("ahmad")
        assert not LoginLockout.is_locked("ahmad")

    def test_expired_lock_not_locked(self, db):
        for _ in range(5):
            LoginLockout.record_failure("ahmad")
        lock = LoginLockout.objects.get(username="ahmad")
        lock.locked_until = timezone.now() - timedelta(seconds=1)
        lock.save()
        assert not LoginLockout.is_locked("ahmad")


# === T1.3: ChildPasswordValidator ===


class TestChildPasswordValidator:
    def _validate(self, password):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from .validators import ChildPasswordValidator

        try:
            ChildPasswordValidator().validate(password)
            return True
        except DjangoValidationError:
            return False

    def test_simple_word_with_digit_ok(self):
        assert self._validate("kucing1") is True

    def test_all_numeric_ok(self):
        assert self._validate("123456") is True

    def test_too_short_rejected(self):
        assert self._validate("abc") is False

    def test_exactly_six_ok(self):
        assert self._validate("abcdef") is True


# === Shared API fixtures ===


@pytest.fixture
def api():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def parent_api(api, parent):
    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=parent)
    api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api


# === T1.4: create child diary account ===


class TestCreateDiaryAccount:
    def test_create_success(self, parent_api, child):
        resp = parent_api.post(
            f"/api/children/{child.id}/diary-account/", {"username": "ahmad"}
        )
        assert resp.status_code == 201
        assert resp.data["username"] == "ahmad"
        child.refresh_from_db()
        assert child.user is not None
        assert child.user.username == "ahmad"
        # No password yet — child cannot log in until setup.
        assert not child.user.has_usable_password()

    def test_duplicate_username_returns_suggestions(self, parent_api, child, db):
        User.objects.create_user(username="ahmad", password="test1234")
        resp = parent_api.post(
            f"/api/children/{child.id}/diary-account/", {"username": "ahmad"}
        )
        assert resp.status_code == 409
        assert len(resp.data["suggestions"]) >= 1
        for s in resp.data["suggestions"]:
            assert not User.objects.filter(username=s).exists()

    def test_child_already_has_account_rejected(self, parent_api, child, db):
        u = User.objects.create_user(username="ahmad")
        child.user = u
        child.save()
        resp = parent_api.post(
            f"/api/children/{child.id}/diary-account/", {"username": "ahmad2"}
        )
        assert resp.status_code == 400

    def test_teacher_cannot_create(self, api, child, db):
        from rest_framework.authtoken.models import Token

        teacher = User.objects.create_user(username="guru", password="test1234")
        ChildAccess.objects.create(user=teacher, child=child, role="teacher")
        token, _ = Token.objects.get_or_create(user=teacher)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.post(
            f"/api/children/{child.id}/diary-account/", {"username": "x"}
        )
        assert resp.status_code == 403

    def test_non_guardian_cannot_create(self, api, child, db):
        from rest_framework.authtoken.models import Token

        other = User.objects.create_user(username="other", password="test1234")
        token, _ = Token.objects.get_or_create(user=other)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.post(
            f"/api/children/{child.id}/diary-account/", {"username": "x"}
        )
        assert resp.status_code in (403, 404)


@pytest.fixture
def child_with_account(child, db):
    u = User.objects.create_user(username="ahmad")
    u.set_unusable_password()
    u.save()
    child.user = u
    child.save()
    return child


# === T1.5: setup token endpoint ===


class TestSetupTokenEndpoint:
    def test_parent_generates_token(self, parent_api, child_with_account):
        resp = parent_api.post(
            f"/api/children/{child_with_account.id}/diary-account/setup-token/"
        )
        assert resp.status_code == 201
        assert len(resp.data["code"]) == 8
        assert resp.data["code"] in resp.data["setup_url"]
        assert "expires_at" in resp.data

    def test_generating_voids_previous(self, parent_api, child_with_account):
        r1 = parent_api.post(
            f"/api/children/{child_with_account.id}/diary-account/setup-token/"
        )
        old_code = r1.data["code"]
        parent_api.post(
            f"/api/children/{child_with_account.id}/diary-account/setup-token/"
        )
        old = PasswordSetupToken.objects.get(code=old_code)
        assert not old.is_valid()

    def test_requires_account_first(self, parent_api, child):
        resp = parent_api.post(
            f"/api/children/{child.id}/diary-account/setup-token/"
        )
        assert resp.status_code == 400

    def test_teacher_cannot_generate(self, api, child_with_account, db):
        from rest_framework.authtoken.models import Token

        teacher = User.objects.create_user(username="guru", password="test1234")
        ChildAccess.objects.create(
            user=teacher, child=child_with_account, role="teacher"
        )
        token, _ = Token.objects.get_or_create(user=teacher)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.post(
            f"/api/children/{child_with_account.id}/diary-account/setup-token/"
        )
        assert resp.status_code == 403


# === T1.6: child-setup (set own password via token) ===


class TestChildSetup:
    def _token(self, child, parent):
        return PasswordSetupToken.generate(child=child, created_by=parent).code

    def test_setup_sets_password_and_logs_in(
        self, api, child_with_account, parent
    ):
        code = self._token(child_with_account, parent)
        resp = api.post(
            "/api/auth/child-setup/", {"code": code, "password": "kucing1"}
        )
        assert resp.status_code == 200
        assert "token" in resp.data
        assert resp.data["child"]["name"] == "Ahmad"
        child_with_account.user.refresh_from_db()
        assert child_with_account.user.check_password("kucing1")

    def test_setup_voids_token(self, api, child_with_account, parent):
        code = self._token(child_with_account, parent)
        api.post("/api/auth/child-setup/", {"code": code, "password": "kucing1"})
        assert not PasswordSetupToken.objects.get(code=code).is_valid()

    def test_wrong_code_rejected(self, api, child_with_account, db):
        resp = api.post(
            "/api/auth/child-setup/", {"code": "WRONGXYZ", "password": "kucing1"}
        )
        assert resp.status_code == 400

    def test_short_password_rejected(self, api, child_with_account, parent):
        code = self._token(child_with_account, parent)
        resp = api.post(
            "/api/auth/child-setup/", {"code": code, "password": "abc"}
        )
        assert resp.status_code == 400
        assert child_with_account.user.check_password("abc") is False

    def test_used_token_rejected(self, api, child_with_account, parent):
        code = self._token(child_with_account, parent)
        api.post("/api/auth/child-setup/", {"code": code, "password": "kucing1"})
        resp = api.post(
            "/api/auth/child-setup/", {"code": code, "password": "anjing2"}
        )
        assert resp.status_code == 400

    def test_reset_flow_reuses_mechanism(self, api, child_with_account, parent):
        # First setup.
        c1 = self._token(child_with_account, parent)
        api.post("/api/auth/child-setup/", {"code": c1, "password": "kucing1"})
        # Reset: new token, new password.
        c2 = self._token(child_with_account, parent)
        resp = api.post(
            "/api/auth/child-setup/", {"code": c2, "password": "anjing2"}
        )
        assert resp.status_code == 200
        child_with_account.user.refresh_from_db()
        assert child_with_account.user.check_password("anjing2")


@pytest.fixture
def child_with_password(child_with_account):
    child_with_account.user.set_password("kucing1")
    child_with_account.user.save()
    return child_with_account


# === T1.7: child-login + progressive lockout ===


class TestChildLogin:
    def test_login_success(self, api, child_with_password):
        resp = api.post(
            "/api/auth/child-login/", {"username": "ahmad", "password": "kucing1"}
        )
        assert resp.status_code == 200
        assert "token" in resp.data
        assert resp.data["child"]["name"] == "Ahmad"

    def test_wrong_password_401(self, api, child_with_password):
        resp = api.post(
            "/api/auth/child-login/", {"username": "ahmad", "password": "salah"}
        )
        assert resp.status_code == 401

    def test_locks_after_five_failures(self, api, child_with_password):
        for _ in range(5):
            api.post(
                "/api/auth/child-login/",
                {"username": "ahmad", "password": "salah"},
            )
        # Even the correct password is now blocked.
        resp = api.post(
            "/api/auth/child-login/", {"username": "ahmad", "password": "kucing1"}
        )
        assert resp.status_code == 429

    def test_success_resets_lockout(self, api, child_with_password):
        for _ in range(4):
            api.post(
                "/api/auth/child-login/",
                {"username": "ahmad", "password": "salah"},
            )
        resp = api.post(
            "/api/auth/child-login/", {"username": "ahmad", "password": "kucing1"}
        )
        assert resp.status_code == 200
        assert not LoginLockout.is_locked("ahmad")

    def test_lock_expires(self, api, child_with_password):
        for _ in range(5):
            api.post(
                "/api/auth/child-login/",
                {"username": "ahmad", "password": "salah"},
            )
        lock = LoginLockout.objects.get(username="ahmad")
        lock.locked_until = timezone.now() - timedelta(seconds=1)
        lock.save()
        resp = api.post(
            "/api/auth/child-login/", {"username": "ahmad", "password": "kucing1"}
        )
        assert resp.status_code == 200

    def test_guardian_rejected_at_child_login(self, api, parent):
        parent.set_password("test1234")
        parent.save()
        resp = api.post(
            "/api/auth/child-login/", {"username": "ayah", "password": "test1234"}
        )
        assert resp.status_code == 403


# === T1.8: guard existing endpoints against child accounts ===


@pytest.fixture
def child_api(api, child_with_password):
    from rest_framework.authtoken.models import Token

    token, _ = Token.objects.get_or_create(user=child_with_password.user)
    api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api


class TestGuardExistingEndpoints:
    def test_child_cannot_list_children(self, child_api):
        resp = child_api.get("/api/children/")
        assert resp.status_code == 403

    def test_child_cannot_create_child(self, child_api):
        resp = child_api.post("/api/children/", {"name": "X"})
        assert resp.status_code == 403

    def test_child_rejected_at_regular_login(self, api, child_with_password):
        resp = api.post(
            "/api/auth/login/", {"username": "ahmad", "password": "kucing1"}
        )
        assert resp.status_code == 403

    def test_child_cannot_create_invite(self, child_api, child_with_password):
        resp = child_api.post(
            "/api/share/invites/",
            {"child": child_with_password.id, "role": "teacher"},
        )
        assert resp.status_code == 403

    def test_child_cannot_redeem(self, child_api):
        resp = child_api.post("/api/auth/redeem/", {"code": "WHATEVER1"})
        assert resp.status_code == 403

    def test_child_cannot_view_access_list(self, child_api, child_with_password):
        resp = child_api.get(f"/api/children/{child_with_password.id}/access/")
        assert resp.status_code == 403

    def test_guardian_still_works(self, parent_api, child):
        resp = parent_api.get("/api/children/")
        assert resp.status_code == 200
