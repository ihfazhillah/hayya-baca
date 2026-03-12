import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Child, ChildAccess, ShareInvite

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


@pytest.fixture
def parent_token(parent):
    token, _ = Token.objects.get_or_create(user=parent)
    return token.key


@pytest.fixture
def auth_api(api, parent_token):
    api.credentials(HTTP_AUTHORIZATION=f"Token {parent_token}")
    return api


@pytest.fixture
def child(parent):
    child = Child.objects.create(name="Ahmad", age=5, created_by=parent)
    ChildAccess.objects.create(user=parent, child=child, role=ChildAccess.Role.PARENT)
    return child


# === Auth ===


class TestRegister:
    def test_register_success(self, api, db):
        resp = api.post("/api/auth/register/", {
            "username": "newuser", "password": "pass1234", "password2": "pass1234"
        })
        assert resp.status_code == 201
        assert "token" in resp.data

    def test_register_password_mismatch(self, api, db):
        resp = api.post("/api/auth/register/", {
            "username": "newuser", "password": "pass1234", "password2": "wrong"
        })
        assert resp.status_code == 400

    def test_register_duplicate_username(self, api, parent):
        resp = api.post("/api/auth/register/", {
            "username": "ayah", "password": "pass1234", "password2": "pass1234"
        })
        assert resp.status_code == 400


class TestLogin:
    def test_login_success(self, api, parent):
        resp = api.post("/api/auth/login/", {"username": "ayah", "password": "test1234"})
        assert resp.status_code == 200
        assert "token" in resp.data

    def test_login_wrong_password(self, api, parent):
        resp = api.post("/api/auth/login/", {"username": "ayah", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, api, db):
        resp = api.post("/api/auth/login/", {"username": "ghost", "password": "pass"})
        assert resp.status_code == 401


class TestLogout:
    def test_logout(self, auth_api, parent):
        resp = auth_api.post("/api/auth/logout/")
        assert resp.status_code == 204
        assert not Token.objects.filter(user=parent).exists()

    def test_logout_unauthenticated(self, api, db):
        resp = api.post("/api/auth/logout/")
        assert resp.status_code == 401


# === Children ===


class TestChildCRUD:
    def test_create_child(self, auth_api, parent):
        resp = auth_api.post("/api/children/", {"name": "Fatimah", "age": 3})
        assert resp.status_code == 201
        assert resp.data["name"] == "Fatimah"
        assert ChildAccess.objects.filter(
            user=parent, child_id=resp.data["id"], role="parent"
        ).exists()

    def test_list_children(self, auth_api, child):
        resp = auth_api.get("/api/children/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["name"] == "Ahmad"

    def test_list_children_only_own(self, api, child, db):
        other = User.objects.create_user(username="other", password="test1234")
        token, _ = Token.objects.get_or_create(user=other)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.get("/api/children/")
        assert resp.status_code == 200
        assert len(resp.data) == 0

    def test_update_child(self, auth_api, child):
        resp = auth_api.patch(f"/api/children/{child.id}/", {"name": "Ahmad Faris"})
        assert resp.status_code == 200
        child.refresh_from_db()
        assert child.name == "Ahmad Faris"

    def test_delete_child(self, auth_api, child):
        resp = auth_api.delete(f"/api/children/{child.id}/")
        assert resp.status_code == 204

    def test_teacher_cannot_update(self, api, child, db):
        teacher = User.objects.create_user(username="guru", password="test1234")
        ChildAccess.objects.create(user=teacher, child=child, role="teacher")
        token, _ = Token.objects.get_or_create(user=teacher)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.patch(f"/api/children/{child.id}/", {"name": "Hacked"})
        assert resp.status_code == 403

    def test_unauthenticated(self, api, db):
        resp = api.get("/api/children/")
        assert resp.status_code == 401


# === Share / Access ===


class TestShareInvite:
    def test_create_invite(self, auth_api, child):
        resp = auth_api.post("/api/share/invites/", {"child": child.id, "role": "teacher"})
        assert resp.status_code == 201
        assert len(resp.data["code"]) == 8

    def test_redeem_invite(self, auth_api, child, api, db):
        resp = auth_api.post("/api/share/invites/", {"child": child.id, "role": "teacher"})
        code = resp.data["code"]

        teacher = User.objects.create_user(username="guru", password="test1234")
        token, _ = Token.objects.get_or_create(user=teacher)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.post("/api/auth/redeem/", {"code": code})
        assert resp.status_code == 201
        assert ChildAccess.objects.filter(user=teacher, child=child, role="teacher").exists()

    def test_redeem_invalid_code(self, auth_api):
        resp = auth_api.post("/api/auth/redeem/", {"code": "INVALID1"})
        assert resp.status_code == 400

    def test_redeem_used_code(self, auth_api, child, api, db):
        resp = auth_api.post("/api/share/invites/", {"child": child.id, "role": "teacher"})
        code = resp.data["code"]
        ShareInvite.objects.filter(code=code).update(used=True)

        teacher = User.objects.create_user(username="guru", password="test1234")
        token, _ = Token.objects.get_or_create(user=teacher)
        api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = api.post("/api/auth/redeem/", {"code": code})
        assert resp.status_code == 400

    def test_max_two_parents(self, auth_api, child, db):
        parent2 = User.objects.create_user(username="ibu", password="test1234")
        ChildAccess.objects.create(user=parent2, child=child, role="parent")

        resp = auth_api.post("/api/share/invites/", {"child": child.id, "role": "parent"})
        code = resp.data["code"]

        parent3 = User.objects.create_user(username="paman", password="test1234")
        token, _ = Token.objects.get_or_create(user=parent3)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        resp = client.post("/api/auth/redeem/", {"code": code})
        assert resp.status_code == 400

    def test_access_list(self, auth_api, child):
        resp = auth_api.get(f"/api/children/{child.id}/access/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["role"] == "parent"

    def test_revoke_access(self, auth_api, child, db):
        teacher = User.objects.create_user(username="guru", password="test1234")
        access = ChildAccess.objects.create(user=teacher, child=child, role="teacher")
        resp = auth_api.delete(
            f"/api/children/{child.id}/access/",
            {"access_id": access.id},
            format="json",
        )
        assert resp.status_code == 204
        assert not ChildAccess.objects.filter(id=access.id).exists()
