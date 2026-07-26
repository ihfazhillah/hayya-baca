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


# === T2.2: ProseMirror body validator ===


def doc(*content):
    return {"type": "doc", "content": list(content)}


def para(*content):
    return {"type": "paragraph", "content": list(content)}


def text(s, marks=None):
    node = {"type": "text", "text": s}
    if marks:
        node["marks"] = marks
    return node


class TestProseMirrorValidator:
    def _valid(self, document):
        from diary.prosemirror import InvalidDocument, validate_prosemirror

        try:
            validate_prosemirror(document)
            return True
        except InvalidDocument:
            return False

    def test_valid_document(self):
        assert self._valid(
            doc(para(text("Hujan turun"), {"type": "hardBreak"}, text("di pagi hari")))
        )

    def test_valid_marks(self):
        assert self._valid(
            doc(
                para(
                    text("tebal", [{"type": "bold"}]),
                    text("miring", [{"type": "italic"}]),
                    text(
                        "warna",
                        [{"type": "textStyle", "attrs": {"color": "#ff0000"}}],
                    ),
                )
            )
        )

    def test_reject_non_doc_root(self):
        assert not self._valid(para(text("x")))

    def test_reject_unknown_node(self):
        assert not self._valid(doc({"type": "image", "attrs": {"src": "x"}}))

    def test_reject_unknown_mark(self):
        assert not self._valid(
            doc(para(text("x", [{"type": "link", "attrs": {"href": "http://x"}}])))
        )

    def test_reject_bad_color(self):
        assert not self._valid(
            doc(
                para(
                    text(
                        "x",
                        [{"type": "textStyle", "attrs": {"color": "javascript:1"}}],
                    )
                )
            )
        )

    def test_reject_oversize(self):
        big = "a" * 20001
        assert not self._valid(doc(para(text(big))))

    def test_reject_too_deep(self):
        nested = doc(para(para(para(text("x")))))
        assert not self._valid(nested)


# === T2.3: child post CRUD ===


@pytest.fixture
def child_ctx(api, parent):
    """A child with a diary account + authed client."""
    child = make_child("Ahmad", parent, with_account=True)
    return child, auth(api, child.user)


class TestPostTypesEndpoint:
    def test_list_active_types(self, api, parent):
        child = make_child("Ahmad", parent, with_account=True)
        resp = auth(api, child.user).get("/api/diary/post-types/")
        assert resp.status_code == 200
        slugs = {t["slug"] for t in resp.data}
        assert {"puisi", "komik"} <= slugs


class TestChildPostCRUD:
    def test_write_journey(self, child_ctx):
        child, capi = child_ctx
        # Create draft
        resp = capi.post(
            "/api/diary/my/posts/",
            {"type": "puisi", "body": doc(para(text("Hujan turun")))},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["status"] == "draft"
        pid = resp.data["id"]

        # Autosave (PATCH body)
        resp = capi.patch(
            f"/api/diary/my/posts/{pid}/",
            {"body": doc(para(text("Hujan turun deras")))},
            format="json",
        )
        assert resp.status_code == 200

        # Publish
        resp = capi.patch(
            f"/api/diary/my/posts/{pid}/", {"status": "published"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "published"
        assert resp.data["published_at"] is not None

        # Edit after publish
        resp = capi.patch(
            f"/api/diary/my/posts/{pid}/", {"title": "Hujan"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["title"] == "Hujan"

        # Soft delete
        resp = capi.delete(f"/api/diary/my/posts/{pid}/")
        assert resp.status_code == 204
        from diary.models import Post

        assert not Post.objects.filter(id=pid).exists()
        assert Post.all_objects.filter(id=pid).exists()

    def test_list_filter_by_status(self, child_ctx):
        child, capi = child_ctx
        capi.post(
            "/api/diary/my/posts/",
            {"type": "curhat", "body": doc(para(text("draft")))},
            format="json",
        )
        r = capi.post(
            "/api/diary/my/posts/",
            {"type": "curhat", "body": doc(para(text("pub")))},
            format="json",
        )
        capi.patch(
            f"/api/diary/my/posts/{r.data['id']}/",
            {"status": "published"},
            format="json",
        )
        resp = capi.get("/api/diary/my/posts/?status=published")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["status"] == "published"

    def test_invalid_body_rejected(self, child_ctx):
        child, capi = child_ctx
        resp = capi.post(
            "/api/diary/my/posts/",
            {"type": "puisi", "body": {"type": "image"}},
            format="json",
        )
        assert resp.status_code == 400

    def test_comic_allows_null_body(self, child_ctx):
        child, capi = child_ctx
        resp = capi.post(
            "/api/diary/my/posts/", {"type": "komik"}, format="json"
        )
        assert resp.status_code == 201
        assert resp.data["body"] is None

    def test_guardian_cannot_use_my_posts(self, api, parent):
        make_child("Ahmad", parent)
        resp = auth(api, parent).get("/api/diary/my/posts/")
        assert resp.status_code == 403


# === T2.4: privacy isolation between children ===


class TestPostIsolation:
    def _make_post(self, capi, body_text="rahasia"):
        r = capi.post(
            "/api/diary/my/posts/",
            {"type": "curhat", "body": doc(para(text(body_text)))},
            format="json",
        )
        return r.data["id"]

    def test_sibling_cannot_retrieve_returns_404(self, api, parent):
        ahmad = make_child("Ahmad", parent, with_account=True)
        fatimah = make_child("Fatimah", parent, with_account=True)
        pid = self._make_post(auth(APIClient(), ahmad.user))
        # Fatimah tries to read Ahmad's post — must look absent, not forbidden.
        resp = auth(api, fatimah.user).get(f"/api/diary/my/posts/{pid}/")
        assert resp.status_code == 404

    def test_sibling_cannot_patch_or_delete(self, api, parent):
        ahmad = make_child("Ahmad", parent, with_account=True)
        fatimah = make_child("Fatimah", parent, with_account=True)
        pid = self._make_post(auth(APIClient(), ahmad.user))
        fapi = auth(api, fatimah.user)
        assert fapi.patch(
            f"/api/diary/my/posts/{pid}/", {"title": "x"}, format="json"
        ).status_code == 404
        assert fapi.delete(f"/api/diary/my/posts/{pid}/").status_code == 404

    def test_list_shows_only_own_posts(self, api, parent):
        ahmad = make_child("Ahmad", parent, with_account=True)
        fatimah = make_child("Fatimah", parent, with_account=True)
        self._make_post(auth(APIClient(), ahmad.user), "punya ahmad")
        resp = auth(api, fatimah.user).get("/api/diary/my/posts/")
        assert resp.status_code == 200
        assert resp.data == []

    def test_teacher_denied_on_my_posts(self, api, parent, db):
        child = make_child("Ahmad", parent, with_account=True)
        teacher = User.objects.create_user(username="guru", password="test1234")
        ChildAccess.objects.create(user=teacher, child=child, role="teacher")
        resp = auth(api, teacher).get("/api/diary/my/posts/")
        assert resp.status_code == 403


# === T3.1: comic panel upload + resize ===


def make_image(width=2400, height=1200, fmt="PNG"):
    """An in-memory uploaded image file for tests."""
    from io import BytesIO

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    img = Image.new("RGB", (width, height), (120, 80, 200))
    buf = BytesIO()
    img.save(buf, format=fmt)
    ext = fmt.lower()
    ctype = f"image/{'jpeg' if ext == 'jpg' else ext}"
    return SimpleUploadedFile(f"panel.{ext}", buf.getvalue(), content_type=ctype)


@pytest.fixture
def comic_ctx(api, parent):
    from diary.models import Post, PostType

    child = make_child("Ahmad", parent, with_account=True)
    capi = auth(api, child.user)
    post = Post.objects.create(
        child=child, type=PostType.objects.get(slug="komik")
    )
    return child, capi, post


class TestComicPanelUpload:
    def test_upload_resizes_to_webp(self, comic_ctx):
        from PIL import Image

        from diary.models import ComicPanel

        child, capi, post = comic_ctx
        resp = capi.post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": make_image(2400, 1200), "caption": "panel 1"},
            format="multipart",
        )
        assert resp.status_code == 201
        panel = ComicPanel.objects.get(id=resp.data["id"])
        assert panel.image.name.endswith(".webp")
        img = Image.open(panel.image.path)
        assert img.format == "WEBP"
        assert max(img.size) <= 1600

    def test_non_image_rejected(self, comic_ctx):
        from django.core.files.uploadedfile import SimpleUploadedFile

        child, capi, post = comic_ctx
        bad = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
        resp = capi.post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": bad},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_panel_limit_enforced(self, comic_ctx, settings):
        from diary.models import ComicPanel

        child, capi, post = comic_ctx
        for i in range(20):
            ComicPanel.objects.create(post=post, order=i, image="diary/x.webp")
        resp = capi.post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": make_image(400, 400)},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_reorder_and_caption(self, comic_ctx):
        child, capi, post = comic_ctx
        r = capi.post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": make_image(400, 400)},
            format="multipart",
        )
        pid = r.data["id"]
        resp = capi.patch(
            f"/api/diary/my/posts/{post.id}/panels/{pid}/",
            {"order": 5, "caption": "baru"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["order"] == 5
        assert resp.data["caption"] == "baru"

    def test_delete_panel(self, comic_ctx):
        from diary.models import ComicPanel

        child, capi, post = comic_ctx
        r = capi.post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": make_image(400, 400)},
            format="multipart",
        )
        pid = r.data["id"]
        resp = capi.delete(f"/api/diary/my/posts/{post.id}/panels/{pid}/")
        assert resp.status_code == 204
        assert not ComicPanel.objects.filter(id=pid).exists()

    def test_sibling_cannot_upload(self, api, parent, comic_ctx):
        child, capi, post = comic_ctx
        other = make_child("Fatimah", parent, with_account=True)
        resp = auth(api, other.user).post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": make_image(400, 400)},
            format="multipart",
        )
        assert resp.status_code == 404
