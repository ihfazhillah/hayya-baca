"""Ruang Cerita diary views (Spec 060)."""
from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.generics import ListAPIView, get_object_or_404
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess, is_child_account
from accounts.permissions import IsGuardianAccount
from accounts.serializers import ChildSerializer

from .badges import child_has_new_activity, guardian_unread
from .images import MAX_PANELS_PER_POST, InvalidImage, process_panel_image
from .media import verify_panel_token
from .models import (
    REACTION_EMOJIS,
    ComicPanel,
    Comment,
    Post,
    PostType,
    Reaction,
    ReadReceipt,
    TelegramLink,
)
import logging

from . import telegram
from .permissions import IsChildAccount, resolve_accessible_post

logger = logging.getLogger(__name__)


def _notify(fn, *args):
    """Fire a Telegram notification best-effort; never break the request."""
    try:
        fn(*args)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Diary notification failed: %s", exc)
from .serializers import (
    ComicPanelSerializer,
    CommentSerializer,
    FeedPostSerializer,
    PostSerializer,
    PostTypeSerializer,
    author_label,
    child_summary,
)


class MeView(APIView):
    """Bootstrap payload: who am I, and which children do I see?"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_child_account(user):
            return Response(
                {
                    "role": "child",
                    "user_id": user.id,
                    "child": ChildSerializer(user.child_profile).data,
                }
            )

        # Guardian: diary is parent-only, so teachers get an empty list.
        children = Child.objects.filter(
            access__user=user, access__role=ChildAccess.Role.PARENT
        ).distinct()
        return Response(
            {
                "role": "guardian",
                "user_id": user.id,
                "children": ChildSerializer(children, many=True).data,
            }
        )


class PostTypeListView(ListAPIView):
    """Active post types (both roles may read)."""

    permission_classes = [IsAuthenticated]
    serializer_class = PostTypeSerializer
    pagination_class = None

    def get_queryset(self):
        return PostType.objects.filter(is_active=True)


class MyPostViewSet(viewsets.ModelViewSet):
    """A child's own posts (draft + published). Owner-scoped."""

    permission_classes = [IsChildAccount]
    serializer_class = PostSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Post.objects.filter(child=self.request.user.child_profile)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(child=self.request.user.child_profile)

    def perform_update(self, serializer):
        instance = serializer.instance
        new_status = serializer.validated_data.get("status", instance.status)
        extra = {}
        first_publish = (
            new_status == Post.Status.PUBLISHED and instance.published_at is None
        )
        if first_publish:
            extra["published_at"] = timezone.now()
        post = serializer.save(**extra)
        if first_publish:
            _notify(telegram.notify_new_post, post)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])


class PanelBaseView(APIView):
    """Comic panels, scoped to a post owned by the requesting child."""

    permission_classes = [IsChildAccount]

    def get_post(self, request, post_pk):
        return get_object_or_404(
            Post, pk=post_pk, child=request.user.child_profile
        )


class PanelListCreateView(PanelBaseView):
    def post(self, request, post_pk):
        post = self.get_post(request, post_pk)

        if post.panels.count() >= MAX_PANELS_PER_POST:
            return Response(
                {"detail": f"Maksimal {MAX_PANELS_PER_POST} panel"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload = request.data.get("image")
        if upload is None:
            return Response(
                {"detail": "Gambar wajib diisi"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            processed = process_panel_image(upload)
        except InvalidImage as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        last = post.panels.order_by("-order").first()
        next_order = (last.order + 1) if last else 0
        panel = ComicPanel(
            post=post,
            order=request.data.get("order", next_order),
            caption=request.data.get("caption", ""),
        )
        panel.image.save(processed.name, processed, save=True)
        return Response(
            ComicPanelSerializer(panel, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PanelDetailView(PanelBaseView):
    def get_panel(self, request, post_pk, pk):
        post = self.get_post(request, post_pk)
        return get_object_or_404(ComicPanel, pk=pk, post=post)

    def patch(self, request, post_pk, pk):
        panel = self.get_panel(request, post_pk, pk)
        if "order" in request.data:
            panel.order = request.data["order"]
        if "caption" in request.data:
            panel.caption = request.data["caption"]
        panel.save(update_fields=["order", "caption"])
        return Response(
            ComicPanelSerializer(panel, context={"request": request}).data
        )

    def delete(self, request, post_pk, pk):
        panel = self.get_panel(request, post_pk, pk)
        panel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PanelMediaView(APIView):
    """Serve a panel image if the signed token is valid. No auth header needed
    (the short-lived signature is the capability), so <img src> works."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        token = request.query_params.get("token", "")
        if not verify_panel_token(token, pk):
            return HttpResponse(status=status.HTTP_403_FORBIDDEN)

        panel = get_object_or_404(ComicPanel, pk=pk)
        if not panel.image:
            return HttpResponse(status=status.HTTP_404_NOT_FOUND)

        if settings.DIARY_USE_X_ACCEL:
            response = HttpResponse(content_type="image/webp")
            internal = settings.DIARY_INTERNAL_MEDIA_LOCATION.rstrip("/")
            response["X-Accel-Redirect"] = f"{internal}/{panel.image.name}"
            return response

        return FileResponse(panel.image.open("rb"), content_type="image/webp")


class PostCommentsView(APIView):
    """Flat two-way comment thread on a post (Spec 060 §5.1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, post_pk):
        post = resolve_accessible_post(request.user, post_pk)
        if post is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        comments = post.comments.select_related("author")
        return Response(
            CommentSerializer(
                comments, many=True, context={"request": request}
            ).data
        )

    def post(self, request, post_pk):
        post = resolve_accessible_post(request.user, post_pk)
        if post is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CommentSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(post=post, author=request.user)
        if is_child_account(request.user):
            _notify(telegram.notify_child_reply, post, comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    """Edit/soft-delete a comment — author only."""

    permission_classes = [IsAuthenticated]

    def get_own_comment(self, request, pk):
        return Comment.objects.filter(pk=pk, author=request.user).first()

    def patch(self, request, pk):
        comment = self.get_own_comment(request, pk)
        if comment is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CommentSerializer(
            comment, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        comment = self.get_own_comment(request, pk)
        if comment is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        comment.deleted_at = timezone.now()
        comment.save(update_fields=["deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


def reaction_summary(post, user):
    """{emoji: count} plus the emojis the current user reacted with."""
    counts = {}
    mine = []
    for r in post.reactions.all():
        counts[r.emoji] = counts.get(r.emoji, 0) + 1
        if r.user_id == user.id:
            mine.append(r.emoji)
    return {"counts": counts, "mine": mine}


class PostReactionsView(APIView):
    """Idempotent add/remove of an emoji reaction (Spec 060 §5.2)."""

    permission_classes = [IsAuthenticated]

    def _post_and_emoji(self, request, post_pk):
        post = resolve_accessible_post(request.user, post_pk)
        emoji = request.data.get("emoji")
        return post, emoji

    def put(self, request, post_pk):
        post, emoji = self._post_and_emoji(request, post_pk)
        if post is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if emoji not in REACTION_EMOJIS:
            return Response(
                {"detail": "Emoji tidak valid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        Reaction.objects.get_or_create(post=post, user=request.user, emoji=emoji)
        return Response(reaction_summary(post, request.user))

    def delete(self, request, post_pk):
        post, emoji = self._post_and_emoji(request, post_pk)
        if post is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        Reaction.objects.filter(
            post=post, user=request.user, emoji=emoji
        ).delete()
        return Response(reaction_summary(post, request.user))


def read_by_list(post):
    """Guardians who have read this post → shown to the child as receipts."""
    receipts = post.receipts.filter(first_read_at__isnull=False).select_related(
        "user"
    )
    return [
        {"label": author_label(r.user), "at": r.first_read_at} for r in receipts
    ]


class PostSeenView(APIView):
    """Mark a post seen: guardians leave a read receipt, everyone updates the
    last-seen watermark used for unread badges (Spec 060 §5.3, §6.1)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, post_pk):
        post = resolve_accessible_post(request.user, post_pk)
        if post is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        receipt, created = ReadReceipt.objects.get_or_create(
            post=post,
            user=request.user,
            defaults={"last_seen_at": now},
        )
        receipt.last_seen_at = now
        # A read receipt ("Dibaca Ayah") is a guardian action only.
        if not is_child_account(request.user) and receipt.first_read_at is None:
            receipt.first_read_at = now
        receipt.save(update_fields=["last_seen_at", "first_read_at"])

        return Response({"read_by": read_by_list(post)})


class FeedCursorPagination(CursorPagination):
    ordering = "-published_at"
    page_size = 20


class FeedView(ListAPIView):
    """Guardian's combined feed of their children's published posts."""

    permission_classes = [IsAuthenticated, IsGuardianAccount]
    serializer_class = FeedPostSerializer
    pagination_class = FeedCursorPagination

    def get_queryset(self):
        qs = Post.objects.filter(
            status=Post.Status.PUBLISHED,
            child__access__user=self.request.user,
            child__access__role=ChildAccess.Role.PARENT,
        ).select_related("child", "type")
        child_id = self.request.query_params.get("child")
        if child_id:
            qs = qs.filter(child_id=child_id)
        return qs.distinct()


def post_detail_payload(post, request):
    """Full post detail: body/panels + thread + reactions + receipts."""
    data = PostSerializer(post, context={"request": request}).data
    data["child"] = child_summary(post.child)
    data["panels"] = ComicPanelSerializer(
        post.panels.all(), many=True, context={"request": request}
    ).data
    data["comments"] = CommentSerializer(
        post.comments.select_related("author"),
        many=True,
        context={"request": request},
    ).data
    data["reactions"] = reaction_summary(post, request.user)
    data["read_by"] = read_by_list(post)
    return data


class PostDetailView(APIView):
    """Read a single post (child owner: any status; guardian: published)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        post = resolve_accessible_post(request.user, pk)
        if post is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(post_detail_payload(post, request))


class BadgesView(APIView):
    """Unread signals: guardians get per-child counts; children get post ids
    with new guardian activity (Spec 060 §6.1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_child_account(user):
            return Response(self._child_badges(user))
        return Response(self._guardian_badges(user))

    def _guardian_badges(self, user):
        posts = (
            Post.objects.filter(
                status=Post.Status.PUBLISHED,
                child__access__user=user,
                child__access__role=ChildAccess.Role.PARENT,
            )
            .select_related("child")
            .distinct()
        )
        counts = {}
        for post in posts:
            receipt = post.receipts.filter(user=user).first()
            if guardian_unread(post, receipt):
                counts[post.child_id] = counts.get(post.child_id, 0) + 1
        children = ChildAccess.objects.filter(
            user=user, role=ChildAccess.Role.PARENT
        ).values_list("child_id", flat=True)
        return {
            "children": [
                {"child_id": cid, "unread": counts.get(cid, 0)} for cid in children
            ],
            "total": sum(counts.values()),
        }

    def _child_badges(self, user):
        child = user.child_profile
        post_ids = []
        for post in Post.objects.filter(child=child):
            receipt = post.receipts.filter(user=user).first()
            if child_has_new_activity(post, receipt, user.id):
                post_ids.append(post.id)
        return {"posts": post_ids, "total": len(post_ids)}


class TelegramLinkView(APIView):
    """Guardian links/unlinks their Telegram account (Spec 060 §6.2)."""

    permission_classes = [IsAuthenticated, IsGuardianAccount]

    def post(self, request):
        code = telegram.new_link_code()
        link, _ = TelegramLink.objects.update_or_create(
            user=request.user,
            defaults={
                "link_code": code,
                "code_expires_at": telegram.link_code_expiry(),
            },
        )
        return Response(
            {"deep_link": telegram.deep_link(code), "link_code": code}
        )

    def delete(self, request):
        TelegramLink.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TelegramWebhookView(APIView):
    """Telegram calls this on bot updates. Handles /start <code> linking."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, secret):
        configured = settings.TELEGRAM_WEBHOOK_SECRET
        if not configured or secret != configured:
            return Response(status=status.HTTP_404_NOT_FOUND)

        message = (request.data or {}).get("message", {})
        text = (message.get("text") or "").strip()
        chat_id = str((message.get("chat") or {}).get("id", "")) or None

        if text.startswith("/start") and chat_id:
            parts = text.split(maxsplit=1)
            if len(parts) == 2:
                self._link(parts[1].strip(), chat_id)

        return Response({"ok": True})

    def _link(self, code, chat_id):
        link = TelegramLink.objects.filter(link_code=code).first()
        if link is None or link.code_expires_at < timezone.now():
            return
        link.chat_id = chat_id
        link.save(update_fields=["chat_id"])
        telegram.send_message(
            chat_id, "Akun Ruang Cerita terhubung. Kamu akan dapat kabar di sini."
        )
