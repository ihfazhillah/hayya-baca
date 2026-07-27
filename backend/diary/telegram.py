"""Telegram notification channel for guardians (Spec 060 §6.2).

A doorbell, not a postman: notifications carry name + type + optional title +
a short excerpt, never the full writing — diary content lives only in the app.
Sending is synchronous best-effort; failures are logged and never break the
request that triggered them. When TELEGRAM_BOT_TOKEN is unset the sender is a
no-op, so the whole feature stays dormant in dev/tests.
"""
import json
import logging
import secrets
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

LINK_CODE_TTL = timedelta(minutes=15)
SEND_TIMEOUT = 3  # seconds
EXCERPT_LEN = 120


def new_link_code():
    return secrets.token_urlsafe(8)


def link_code_expiry():
    return timezone.now() + LINK_CODE_TTL


def bot_username():
    """Telegram bot username from system config (env). '@' stripped.

    Empty string means no bot is configured yet.
    """
    return (settings.TELEGRAM_BOT_USERNAME or "").strip().lstrip("@")


def deep_link(code):
    return f"https://t.me/{bot_username()}?start={code}"


def send_message(chat_id, text):
    """Best-effort Telegram sendMessage. Returns True on success."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=SEND_TIMEOUT) as resp:
            return resp.status == 200
    except Exception as exc:  # noqa: BLE001 — best-effort, never bubble up
        logger.warning("Telegram send failed: %s", exc)
        return False


def excerpt_from_body(body, limit=EXCERPT_LEN):
    """Flatten ProseMirror JSON to plain text, truncated to `limit` chars."""
    if not body:
        return ""
    parts = []

    def walk(node):
        if not isinstance(node, dict):
            return
        if node.get("type") == "text":
            parts.append(node.get("text", ""))
        for child in node.get("content", []) or []:
            walk(child)
        # Paragraph breaks keep poems/pantun readable.
        if node.get("type") == "paragraph":
            parts.append("\n")

    walk(body)
    text = " ".join("".join(parts).split())
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def post_url(post):
    """Web URL that opens this post in the app."""
    base = settings.DIARY_WEB_BASE_URL.rstrip("/")
    return f"{base}/post/{post.id}"


def _with_link(message, url):
    """Append the post link on its own line (Telegram auto-links plain URLs)."""
    return f"{message}\n\n{url}" if url else message


def build_notification(child_name, type_label, title, body, url=None):
    """Compose the message: name + type + (title if any) + excerpt + link."""
    header = f"🖋️ {child_name} menulis {type_label}"
    if title:
        body_msg = f"{header}\n\n“{title}”\n{excerpt_from_body(body)}".rstrip()
    else:
        body_msg = f"{header}\n\n{excerpt_from_body(body)}".rstrip()
    return _with_link(body_msg, url)


def build_reply_notification(child_name, type_label, body, url=None):
    body_msg = (
        f"💬 {child_name} membalas di {type_label}\n\n{excerpt_from_body(body)}"
    ).rstrip()
    return _with_link(body_msg, url)


def linked_guardian_chat_ids(child):
    """Chat ids of the child's guardians who have linked Telegram."""
    from accounts.models import ChildAccess

    from .models import TelegramLink

    guardian_ids = ChildAccess.objects.filter(
        child=child, role=ChildAccess.Role.PARENT
    ).values_list("user_id", flat=True)
    return list(
        TelegramLink.objects.filter(user_id__in=guardian_ids)
        .exclude(chat_id__isnull=True)
        .exclude(chat_id="")
        .values_list("chat_id", flat=True)
    )


def notify_new_post(post):
    text = build_notification(
        post.child.name, post.type.label, post.title, post.body, post_url(post)
    )
    for chat_id in linked_guardian_chat_ids(post.child):
        send_message(chat_id, text)


def notify_child_reply(post, comment):
    text = build_reply_notification(
        post.child.name, post.type.label, comment.body, post_url(post)
    )
    for chat_id in linked_guardian_chat_ids(post.child):
        send_message(chat_id, text)
