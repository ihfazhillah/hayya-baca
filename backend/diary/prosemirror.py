"""Pure whitelist validator for ProseMirror/TipTap documents (Spec 060 §4.2).

Content is stored as ProseMirror JSON and never as raw HTML, so validation is
an allow-list over a tiny node/mark vocabulary — far easier to audit than HTML
sanitisation, and XSS-free by construction.
"""
import re

ALLOWED_NODES = {"doc", "paragraph", "text", "hardBreak"}
ALLOWED_MARKS = {"bold", "italic", "textStyle"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")

MAX_TEXT_CHARS = 20_000
MAX_DEPTH = 3  # doc → paragraph → text


class InvalidDocument(ValueError):
    """Raised when a document violates the whitelist or limits."""


def validate_prosemirror(document):
    if not isinstance(document, dict) or document.get("type") != "doc":
        raise InvalidDocument("Root harus node 'doc'")
    total = _walk(document, depth=1)
    if total > MAX_TEXT_CHARS:
        raise InvalidDocument("Tulisan terlalu panjang")
    return True


def _walk(node, depth):
    if depth > MAX_DEPTH:
        raise InvalidDocument("Struktur terlalu dalam")
    if not isinstance(node, dict):
        raise InvalidDocument("Node tidak valid")

    node_type = node.get("type")
    if node_type not in ALLOWED_NODES:
        raise InvalidDocument(f"Node '{node_type}' tidak diizinkan")

    text_count = 0
    if node_type == "text":
        value = node.get("text")
        if not isinstance(value, str):
            raise InvalidDocument("Node text harus string")
        text_count += len(value)
        _validate_marks(node.get("marks", []))

    for child in node.get("content", []) or []:
        text_count += _walk(child, depth + 1)
    return text_count


def _validate_marks(marks):
    if not isinstance(marks, list):
        raise InvalidDocument("marks harus list")
    for mark in marks:
        mtype = mark.get("type") if isinstance(mark, dict) else None
        if mtype not in ALLOWED_MARKS:
            raise InvalidDocument(f"Mark '{mtype}' tidak diizinkan")
        if mtype == "textStyle":
            color = (mark.get("attrs") or {}).get("color")
            if color is not None and not HEX_COLOR.match(str(color)):
                raise InvalidDocument("Warna harus hex #rrggbb")
