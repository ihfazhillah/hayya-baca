"""Image processing for comic panels (Spec 060 §4.3 / plan §2.3).

Every upload is re-encoded to WebP: shrinks payloads, normalises format, and —
because it fully re-encodes — strips EXIF/GPS metadata from camera photos.
"""
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError

MAX_SIDE = 1600
WEBP_QUALITY = 80
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PANELS_PER_POST = 20


class InvalidImage(ValueError):
    pass


def process_panel_image(uploaded):
    """Validate + re-encode an uploaded image to a WebP ContentFile."""
    if uploaded.size and uploaded.size > MAX_UPLOAD_BYTES:
        raise InvalidImage("Gambar terlalu besar (maksimal 10 MB)")

    # Reject video (and anything non-image) up front with a clear message; PIL
    # below is the real gate, but this makes the intent explicit for children.
    ctype = (getattr(uploaded, "content_type", "") or "").lower()
    if ctype.startswith("video/"):
        raise InvalidImage("Video tidak didukung — hanya gambar")

    try:
        img = Image.open(uploaded)
        img.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise InvalidImage("File bukan gambar yang valid")

    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img.thumbnail((MAX_SIDE, MAX_SIDE))

    buf = BytesIO()
    img.save(buf, format="WEBP", quality=WEBP_QUALITY)
    return ContentFile(buf.getvalue(), name="panel.webp")
