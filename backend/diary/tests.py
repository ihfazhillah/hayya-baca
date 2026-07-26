"""Ruang Cerita diary tests (Spec 060)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


def auth(api, user):
    token, _ = Token.objects.get_or_create(user=user)
    api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api


def make_child(name, parent, with_account=False):
    child = Child.objects.create(name=name, created_by=parent)
    ChildAccess.objects.create(user=parent, child=child, role=ChildAccess.Role.PARENT)
    if with_account:
        u = User.objects.create_user(username=name.lower(), password="kucing1")
        child.user = u
        child.save()
    return child


# === T1.9: /api/diary/me/ ===


class TestMe:
    def test_child_sees_own_profile(self, api, parent):
        child = make_child("Ahmad", parent, with_account=True)
        resp = auth(api, child.user).get("/api/diary/me/")
        assert resp.status_code == 200
        assert resp.data["role"] == "child"
        assert resp.data["child"]["name"] == "Ahmad"

    def test_guardian_sees_all_their_children(self, api, parent):
        make_child("Ahmad", parent)
        make_child("Fatimah", parent)
        resp = auth(api, parent).get("/api/diary/me/")
        assert resp.status_code == 200
        assert resp.data["role"] == "guardian"
        names = {c["name"] for c in resp.data["children"]}
        assert names == {"Ahmad", "Fatimah"}

    def test_teacher_sees_no_children(self, api, parent, db):
        child = make_child("Ahmad", parent)
        teacher = User.objects.create_user(username="guru", password="test1234")
        ChildAccess.objects.create(user=teacher, child=child, role="teacher")
        resp = auth(api, teacher).get("/api/diary/me/")
        assert resp.status_code == 200
        assert resp.data["role"] == "guardian"
        assert resp.data["children"] == []

    def test_unauthenticated_rejected(self, api, db):
        resp = api.get("/api/diary/me/")
        assert resp.status_code == 401


# === T2.1: models + soft-delete + seed ===


class TestModels:
    def test_seed_post_types_present(self, db):
        from diary.models import PostType

        slugs = set(PostType.objects.values_list("slug", flat=True))
        assert {"puisi", "pantun", "cerpen", "komik", "curhat"} <= slugs

    def test_comic_type_has_comic_kind(self, db):
        from diary.models import PostType

        assert PostType.objects.get(slug="komik").kind == "comic"
        assert PostType.objects.get(slug="puisi").kind == "text"

    def test_soft_delete_excludes_from_default_manager(self, db, parent):
        from django.utils import timezone

        from diary.models import Post, PostType

        child = make_child("Ahmad", parent, with_account=True)
        ptype = PostType.objects.get(slug="curhat")
        post = Post.objects.create(child=child, type=ptype, body={"x": 1})
        post.deleted_at = timezone.now()
        post.save()
        assert not Post.objects.filter(id=post.id).exists()
        assert Post.all_objects.filter(id=post.id).exists()
