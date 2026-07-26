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


# === T3.2: signed media URL + private serving ===


def _upload_panel(capi, post):
    r = capi.post(
        f"/api/diary/my/posts/{post.id}/panels/",
        {"image": make_image(400, 400)},
        format="multipart",
    )
    return r.data["id"], r.data["image_url"]


class TestSignedMedia:
    def test_image_url_is_signed_and_serves(self, comic_ctx):
        child, capi, post = comic_ctx
        pid, url = _upload_panel(capi, post)
        assert "token=" in url
        # A fresh browser (no auth header) can fetch via the signed URL.
        path = url.split("testserver")[-1] if "testserver" in url else url
        anon = APIClient()
        resp = anon.get(path)
        assert resp.status_code == 200

    def test_tampered_token_rejected(self, comic_ctx):
        child, capi, post = comic_ctx
        pid, _ = _upload_panel(capi, post)
        anon = APIClient()
        resp = anon.get(f"/api/diary/media/{pid}/?token=deadbeef:1:bad")
        assert resp.status_code == 403

    def test_missing_token_rejected(self, comic_ctx):
        child, capi, post = comic_ctx
        pid, _ = _upload_panel(capi, post)
        resp = APIClient().get(f"/api/diary/media/{pid}/")
        assert resp.status_code == 403

    def test_expired_token_rejected(self, comic_ctx, monkeypatch):
        import django.core.signing as signing

        from diary.media import signed_panel_token

        child, capi, post = comic_ctx
        pid, _ = _upload_panel(capi, post)
        # Stamp the token ~2 hours in the past so the 1h TTL rejects it.
        real = signing.time.time()
        monkeypatch.setattr(signing.time, "time", lambda: real - 7200)
        old_token = signed_panel_token(pid)
        monkeypatch.undo()
        resp = APIClient().get(f"/api/diary/media/{pid}/?token={old_token}")
        assert resp.status_code == 403


# === Fase 4 shared fixtures ===


@pytest.fixture
def published_ctx(api, parent):
    """A published post by Ahmad, plus parent + child clients."""
    from diary.models import Post, PostType

    child = make_child("Ahmad", parent, with_account=True)
    from django.utils import timezone

    post = Post.objects.create(
        child=child,
        type=PostType.objects.get(slug="curhat"),
        body=doc(para(text("hari ini sedih"))),
        status="published",
        published_at=timezone.now(),
    )
    child_api = auth(APIClient(), child.user)
    parent_api = auth(APIClient(), parent)
    return {
        "child": child,
        "parent": parent,
        "post": post,
        "child_api": child_api,
        "parent_api": parent_api,
    }


# === T4.1: comments ===


class TestComments:
    def test_two_way_conversation(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        # Guardian comments
        r = ctx["parent_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("kenapa sedih, Nak?")))},
            format="json",
        )
        assert r.status_code == 201
        assert r.data["author_role"] == "guardian"
        # Child replies
        r = ctx["child_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("dimarahi bu guru")))},
            format="json",
        )
        assert r.status_code == 201
        assert r.data["author_role"] == "child"
        # Both see the thread
        r = ctx["parent_api"].get(f"/api/diary/posts/{pid}/comments/")
        assert len(r.data) == 2

    def test_author_can_edit_own_comment(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        r = ctx["parent_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("a")))},
            format="json",
        )
        cid = r.data["id"]
        r = ctx["parent_api"].patch(
            f"/api/diary/comments/{cid}/",
            {"body": doc(para(text("b")))},
            format="json",
        )
        assert r.status_code == 200

    def test_cannot_edit_others_comment(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        r = ctx["parent_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("a")))},
            format="json",
        )
        cid = r.data["id"]
        r = ctx["child_api"].patch(
            f"/api/diary/comments/{cid}/",
            {"body": doc(para(text("hacked")))},
            format="json",
        )
        assert r.status_code in (403, 404)

    def test_soft_delete_own_comment(self, published_ctx):
        from diary.models import Comment

        ctx = published_ctx
        pid = ctx["post"].id
        r = ctx["child_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("a")))},
            format="json",
        )
        cid = r.data["id"]
        r = ctx["child_api"].delete(f"/api/diary/comments/{cid}/")
        assert r.status_code == 204
        assert not Comment.objects.filter(id=cid).exists()
        assert Comment.all_objects.filter(id=cid).exists()

    def test_outsider_cannot_comment(self, api, parent, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        stranger = User.objects.create_user(username="stranger", password="test1234")
        r = auth(api, stranger).post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("x")))},
            format="json",
        )
        assert r.status_code == 404

    def test_guardian_cannot_comment_on_draft(self, api, parent):
        from diary.models import Post, PostType

        child = make_child("Ahmad", parent, with_account=True)
        draft = Post.objects.create(
            child=child, type=PostType.objects.get(slug="curhat"),
            body=doc(para(text("rahasia"))), status="draft",
        )
        r = auth(api, parent).get(f"/api/diary/posts/{draft.id}/comments/")
        assert r.status_code == 404


# === T4.2: reactions ===


class TestReactions:
    def test_toggle_idempotent(self, published_ctx):
        from diary.models import Reaction

        ctx = published_ctx
        pid = ctx["post"].id
        url = f"/api/diary/posts/{pid}/reactions/"
        # Add
        r = ctx["parent_api"].put(url, {"emoji": "❤️"}, format="json")
        assert r.status_code == 200
        assert Reaction.objects.filter(post_id=pid, emoji="❤️").count() == 1
        # Add again — idempotent, still one
        ctx["parent_api"].put(url, {"emoji": "❤️"}, format="json")
        assert Reaction.objects.filter(post_id=pid, emoji="❤️").count() == 1
        # Remove
        r = ctx["parent_api"].delete(url, {"emoji": "❤️"}, format="json")
        assert r.status_code == 200
        assert Reaction.objects.filter(post_id=pid, emoji="❤️").count() == 0

    def test_invalid_emoji_rejected(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        r = ctx["parent_api"].put(
            f"/api/diary/posts/{pid}/reactions/", {"emoji": "💀"}, format="json"
        )
        assert r.status_code == 400

    def test_child_and_guardian_both_react(self, published_ctx):
        from diary.models import Reaction

        ctx = published_ctx
        pid = ctx["post"].id
        url = f"/api/diary/posts/{pid}/reactions/"
        ctx["parent_api"].put(url, {"emoji": "❤️"}, format="json")
        ctx["child_api"].put(url, {"emoji": "🌟"}, format="json")
        assert Reaction.objects.filter(post_id=pid).count() == 2

    def test_outsider_cannot_react(self, api, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        stranger = User.objects.create_user(username="stranger", password="test1234")
        r = auth(api, stranger).put(
            f"/api/diary/posts/{pid}/reactions/", {"emoji": "❤️"}, format="json"
        )
        assert r.status_code == 404


# === T4.3: seen + read receipt ===


class TestSeen:
    def test_guardian_seen_creates_read_receipt(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        r = ctx["parent_api"].post(f"/api/diary/posts/{pid}/seen/")
        assert r.status_code == 200
        labels = [rb["label"] for rb in r.data["read_by"]]
        assert "ayah" in labels

    def test_first_read_unchanged_on_second_visit(self, published_ctx):
        from diary.models import ReadReceipt

        ctx = published_ctx
        pid = ctx["post"].id
        ctx["parent_api"].post(f"/api/diary/posts/{pid}/seen/")
        first = ReadReceipt.objects.get(
            post_id=pid, user=ctx["parent"]
        ).first_read_at
        ctx["parent_api"].post(f"/api/diary/posts/{pid}/seen/")
        rr = ReadReceipt.objects.get(post_id=pid, user=ctx["parent"])
        assert rr.first_read_at == first
        assert rr.last_seen_at >= first

    def test_child_seen_no_read_receipt(self, published_ctx):
        from diary.models import ReadReceipt

        ctx = published_ctx
        pid = ctx["post"].id
        r = ctx["child_api"].post(f"/api/diary/posts/{pid}/seen/")
        assert r.status_code == 200
        rr = ReadReceipt.objects.get(post_id=pid, user=ctx["child"].user)
        assert rr.first_read_at is None
        assert rr.last_seen_at is not None
        # Child's own view is not a "read by" entry.
        assert r.data["read_by"] == []


# === T4.4: feed + detail + badges ===


def publish_post(child, slug="curhat", body_text="isi"):
    from django.utils import timezone

    from diary.models import Post, PostType

    return Post.objects.create(
        child=child,
        type=PostType.objects.get(slug=slug),
        body=doc(para(text(body_text))),
        status="published",
        published_at=timezone.now(),
    )


class TestFeed:
    def test_combined_feed_ordered(self, api, parent):
        ahmad = make_child("Ahmad", parent)
        fatimah = make_child("Fatimah", parent)
        publish_post(ahmad, body_text="pertama")
        publish_post(fatimah, body_text="kedua")
        resp = auth(api, parent).get("/api/diary/feed/")
        assert resp.status_code == 200
        results = resp.data["results"]
        assert len(results) == 2
        # Newest first
        assert results[0]["child"]["name"] == "Fatimah"

    def test_feed_excludes_drafts_and_other_children(self, api, parent, db):
        from diary.models import Post, PostType

        mine = make_child("Ahmad", parent)
        publish_post(mine)
        Post.objects.create(
            child=mine, type=PostType.objects.get(slug="curhat"),
            body=doc(para(text("draft"))), status="draft",
        )
        # Another family's child
        other_parent = User.objects.create_user(username="lain", password="x")
        other_child = make_child("Zaid", other_parent)
        publish_post(other_child)

        resp = auth(api, parent).get("/api/diary/feed/")
        assert len(resp.data["results"]) == 1

    def test_feed_child_filter(self, api, parent):
        ahmad = make_child("Ahmad", parent)
        fatimah = make_child("Fatimah", parent)
        publish_post(ahmad)
        publish_post(fatimah)
        resp = auth(api, parent).get(f"/api/diary/feed/?child={ahmad.id}")
        assert len(resp.data["results"]) == 1
        assert resp.data["results"][0]["child"]["id"] == ahmad.id

    def test_is_unread_flips_after_seen(self, api, parent):
        ahmad = make_child("Ahmad", parent)
        post = publish_post(ahmad)
        papi = auth(api, parent)
        resp = papi.get("/api/diary/feed/")
        assert resp.data["results"][0]["is_unread"] is True
        papi.post(f"/api/diary/posts/{post.id}/seen/")
        resp = papi.get("/api/diary/feed/")
        assert resp.data["results"][0]["is_unread"] is False

    def test_child_cannot_use_feed(self, api, parent):
        ahmad = make_child("Ahmad", parent, with_account=True)
        resp = auth(api, ahmad.user).get("/api/diary/feed/")
        assert resp.status_code == 403


class TestPostDetail:
    def test_detail_includes_thread_and_reactions(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        ctx["parent_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("hai")))}, format="json",
        )
        ctx["parent_api"].put(
            f"/api/diary/posts/{pid}/reactions/", {"emoji": "❤️"}, format="json"
        )
        ctx["parent_api"].post(f"/api/diary/posts/{pid}/seen/")
        resp = ctx["child_api"].get(f"/api/diary/posts/{pid}/")
        assert resp.status_code == 200
        assert resp.data["title"] == ""
        assert len(resp.data["comments"]) == 1
        assert resp.data["reactions"]["counts"]["❤️"] == 1
        assert any(rb["label"] == "ayah" for rb in resp.data["read_by"])

    def test_detail_includes_panels(self, comic_ctx):
        child, capi, post = comic_ctx
        post.status = "published"
        from django.utils import timezone

        post.published_at = timezone.now()
        post.save()
        capi.post(
            f"/api/diary/my/posts/{post.id}/panels/",
            {"image": make_image(400, 400), "caption": "p1"},
            format="multipart",
        )
        resp = capi.get(f"/api/diary/posts/{post.id}/")
        assert resp.status_code == 200
        assert len(resp.data["panels"]) == 1
        assert "token=" in resp.data["panels"][0]["image_url"]

    def test_guardian_cannot_open_draft_detail(self, api, parent):
        from diary.models import Post, PostType

        child = make_child("Ahmad", parent, with_account=True)
        draft = Post.objects.create(
            child=child, type=PostType.objects.get(slug="curhat"),
            body=doc(para(text("x"))), status="draft",
        )
        resp = auth(api, parent).get(f"/api/diary/posts/{draft.id}/")
        assert resp.status_code == 404


class TestBadges:
    def test_guardian_unread_counts(self, api, parent):
        ahmad = make_child("Ahmad", parent)
        p1 = publish_post(ahmad)
        publish_post(ahmad)
        papi = auth(api, parent)
        resp = papi.get("/api/diary/badges/")
        assert resp.status_code == 200
        counts = {c["child_id"]: c["unread"] for c in resp.data["children"]}
        assert counts[ahmad.id] == 2
        papi.post(f"/api/diary/posts/{p1.id}/seen/")
        resp = papi.get("/api/diary/badges/")
        counts = {c["child_id"]: c["unread"] for c in resp.data["children"]}
        assert counts[ahmad.id] == 1

    def test_child_badge_on_new_comment(self, published_ctx):
        ctx = published_ctx
        pid = ctx["post"].id
        # Child sees own post first (baseline last_seen)
        ctx["child_api"].post(f"/api/diary/posts/{pid}/seen/")
        resp = ctx["child_api"].get("/api/diary/badges/")
        assert pid not in resp.data["posts"]
        # Guardian comments → child badge appears
        ctx["parent_api"].post(
            f"/api/diary/posts/{pid}/comments/",
            {"body": doc(para(text("hai")))}, format="json",
        )
        resp = ctx["child_api"].get("/api/diary/badges/")
        assert pid in resp.data["posts"]
        # Child opens → badge clears
        ctx["child_api"].post(f"/api/diary/posts/{pid}/seen/")
        resp = ctx["child_api"].get("/api/diary/badges/")
        assert pid not in resp.data["posts"]


# === T5.1: telegram link + webhook ===


class TestTelegramLink:
    def test_link_returns_deep_link(self, api, parent, settings):
        settings.TELEGRAM_BOT_USERNAME = "ruangcerita_bot"
        make_child("Ahmad", parent)
        r = auth(api, parent).post("/api/diary/telegram/link/")
        assert r.status_code == 200
        assert r.data["deep_link"].startswith("https://t.me/ruangcerita_bot?start=")

    def test_webhook_start_sets_chat_id(self, api, parent, settings):
        from diary.models import TelegramLink

        settings.TELEGRAM_WEBHOOK_SECRET = "s3cr3t"
        make_child("Ahmad", parent)
        r = auth(api, parent).post("/api/diary/telegram/link/")
        code = r.data["link_code"]
        update = {
            "message": {"text": f"/start {code}", "chat": {"id": 998877}}
        }
        resp = api.post(
            "/api/diary/telegram/webhook/s3cr3t/", update, format="json"
        )
        assert resp.status_code == 200
        link = TelegramLink.objects.get(user=parent)
        assert link.chat_id == "998877"

    def test_webhook_wrong_secret_404(self, api, parent, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = "s3cr3t"
        resp = api.post(
            "/api/diary/telegram/webhook/wrong/",
            {"message": {"text": "/start X", "chat": {"id": 1}}},
            format="json",
        )
        assert resp.status_code == 404

    def test_webhook_disabled_when_no_secret(self, api, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = ""
        resp = api.post(
            "/api/diary/telegram/webhook//",
            {"message": {"text": "/start X", "chat": {"id": 1}}},
            format="json",
        )
        assert resp.status_code == 404

    def test_expired_code_does_not_link(self, api, parent, settings):
        from django.utils import timezone

        from diary.models import TelegramLink

        settings.TELEGRAM_WEBHOOK_SECRET = "s3cr3t"
        make_child("Ahmad", parent)
        r = auth(api, parent).post("/api/diary/telegram/link/")
        code = r.data["link_code"]
        TelegramLink.objects.filter(user=parent).update(
            code_expires_at=timezone.now() - timezone.timedelta(minutes=1)
        )
        api.post(
            "/api/diary/telegram/webhook/s3cr3t/",
            {"message": {"text": f"/start {code}", "chat": {"id": 5}}},
            format="json",
        )
        link = TelegramLink.objects.get(user=parent)
        assert link.chat_id is None

    def test_unlink(self, api, parent):
        from diary.models import TelegramLink

        make_child("Ahmad", parent)
        auth(api, parent).post("/api/diary/telegram/link/")
        r = auth(api, parent).delete("/api/diary/telegram/link/")
        assert r.status_code == 204
        assert not TelegramLink.objects.filter(user=parent).exists()


# === T5.2: notification sending + excerpt builder ===


class TestExcerptBuilder:
    def test_no_title_includes_excerpt_only(self):
        from diary.telegram import build_notification

        msg = build_notification(
            "Ahmad", "Puisi", "", doc(para(text("Hujan turun di pagi hari")))
        )
        assert "Ahmad" in msg and "Puisi" in msg
        assert "Hujan turun" in msg

    def test_with_title_includes_title_and_excerpt(self):
        from diary.telegram import build_notification

        msg = build_notification(
            "Ahmad", "Cerpen", "Kucingku", doc(para(text("Aku punya kucing")))
        )
        assert "Kucingku" in msg
        assert "Aku punya kucing" in msg

    def test_comic_null_body_does_not_crash(self):
        from diary.telegram import build_notification

        msg = build_notification("Ahmad", "Komik", "", None)
        assert "Ahmad" in msg

    def test_excerpt_truncated_to_120(self):
        from diary.telegram import excerpt_from_body

        long = "kata " * 60
        out = excerpt_from_body(doc(para(text(long))))
        assert len(out) <= 120


class TestNotificationTrigger:
    def _link_guardian(self, parent, chat_id="123"):
        from django.utils import timezone

        from diary.models import TelegramLink

        TelegramLink.objects.create(
            user=parent,
            link_code="x",
            chat_id=chat_id,
            code_expires_at=timezone.now() + timezone.timedelta(days=1),
        )

    def test_publish_notifies_linked_guardian(self, api, parent, monkeypatch):
        sent = []
        monkeypatch.setattr(
            "diary.telegram.send_message",
            lambda chat_id, text: sent.append((chat_id, text)),
        )
        self._link_guardian(parent)
        child = make_child("Ahmad", parent, with_account=True)
        capi = auth(api, child.user)
        r = capi.post(
            "/api/diary/my/posts/",
            {"type": "puisi", "body": doc(para(text("hai")))},
            format="json",
        )
        pid = r.data["id"]
        capi.patch(
            f"/api/diary/my/posts/{pid}/", {"status": "published"}, format="json"
        )
        assert len(sent) == 1
        assert sent[0][0] == "123"
        assert "Ahmad" in sent[0][1]

    def test_publish_send_failure_does_not_break(self, api, parent, monkeypatch):
        def boom(chat_id, text):
            raise RuntimeError("telegram down")

        monkeypatch.setattr("diary.telegram.send_message", boom)
        self._link_guardian(parent)
        child = make_child("Ahmad", parent, with_account=True)
        capi = auth(api, child.user)
        r = capi.post(
            "/api/diary/my/posts/",
            {"type": "puisi", "body": doc(para(text("hai")))},
            format="json",
        )
        pid = r.data["id"]
        resp = capi.patch(
            f"/api/diary/my/posts/{pid}/", {"status": "published"}, format="json"
        )
        assert resp.status_code == 200  # publish still succeeds

    def test_child_reply_notifies_guardian(self, published_ctx, monkeypatch):
        sent = []
        monkeypatch.setattr(
            "diary.telegram.send_message",
            lambda chat_id, text: sent.append((chat_id, text)),
        )
        ctx = published_ctx
        self._link_guardian(ctx["parent"])
        ctx["child_api"].post(
            f"/api/diary/posts/{ctx['post'].id}/comments/",
            {"body": doc(para(text("balas")))}, format="json",
        )
        assert len(sent) == 1

    def test_guardian_comment_does_not_notify(self, published_ctx, monkeypatch):
        sent = []
        monkeypatch.setattr(
            "diary.telegram.send_message",
            lambda chat_id, text: sent.append((chat_id, text)),
        )
        ctx = published_ctx
        self._link_guardian(ctx["parent"])
        ctx["parent_api"].post(
            f"/api/diary/posts/{ctx['post'].id}/comments/",
            {"body": doc(para(text("dari ayah")))}, format="json",
        )
        assert sent == []
