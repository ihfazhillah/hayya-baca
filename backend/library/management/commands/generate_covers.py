"""Generate cover images from title for books/articles without a cover."""

import colorsys
import hashlib
import textwrap

from django.conf import settings
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw, ImageFont

from library.models import Book

WIDTH = 1080
HEIGHT = 720

# Warm, muted palette — consistent with app avatar colors
PALETTES = [
    ("#E91E63", "#FFFFFF"),
    ("#9C27B0", "#FFFFFF"),
    ("#3F51B5", "#FFFFFF"),
    ("#009688", "#FFFFFF"),
    ("#FF9800", "#FFFFFF"),
    ("#795548", "#FFFFFF"),
    ("#607D8B", "#FFFFFF"),
    ("#4CAF50", "#FFFFFF"),
    ("#00796B", "#FFFFFF"),
    ("#C62828", "#FFFFFF"),
    ("#4527A0", "#FFFFFF"),
    ("#1565C0", "#FFFFFF"),
]

FONT_PATH = "/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf"


def color_for_title(title: str) -> tuple[str, str]:
    h = int(hashlib.md5(title.encode()).hexdigest(), 16)
    return PALETTES[h % len(PALETTES)]


def draw_cover(title: str, out_path: str):
    bg_color, fg_color = color_for_title(title)

    # Slightly darker shade for bottom area
    r, g, b = Image.new("RGB", (1, 1), bg_color).getpixel((0, 0))
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, min(s * 1.2, 1.0), v * 0.75)
    dark_color = (int(r2 * 255), int(g2 * 255), int(b2 * 255))

    img = Image.new("RGB", (WIDTH, HEIGHT), bg_color)
    draw = ImageDraw.Draw(img)

    # Bottom band
    draw.rectangle([(0, HEIGHT - 200), (WIDTH, HEIGHT)], fill=dark_color)

    # Big initial letter(s) — center top area
    initials = "".join(w[0].upper() for w in title.split()[:2])
    try:
        font_big = ImageFont.truetype(FONT_PATH, 200)
    except OSError:
        font_big = ImageFont.load_default(200)

    bbox = draw.textbbox((0, 0), initials, font=font_big)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((WIDTH - tw) / 2, (HEIGHT - 200 - th) / 2 - 20),
        initials,
        fill=fg_color + "40",  # semi-transparent
        font=font_big,
    )

    # Title text in bottom band
    try:
        font_title = ImageFont.truetype(FONT_PATH, 36)
    except OSError:
        font_title = ImageFont.load_default(36)

    wrapped = textwrap.fill(title, width=40)
    bbox = draw.textbbox((0, 0), wrapped, font=font_title)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((WIDTH - tw) / 2, HEIGHT - 200 + (200 - th) / 2),
        wrapped,
        fill=fg_color,
        font=font_title,
    )

    img.save(out_path, "PNG")


class Command(BaseCommand):
    help = "Generate cover images for books/articles without a cover"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Regenerate all")

    def handle(self, *args, **options):
        if options["force"]:
            books = Book.objects.all()
        else:
            books = Book.objects.filter(cover="")

        covers_dir = settings.MEDIA_ROOT / "covers"
        covers_dir.mkdir(parents=True, exist_ok=True)

        count = 0
        for book in books:
            filename = f"cover_{book.id}.png"
            out_path = covers_dir / filename
            draw_cover(book.title, str(out_path))
            book.cover = f"covers/{filename}"
            book.save(update_fields=["cover"])
            self.stdout.write(f"  Generated: {book.title} → {filename}")
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Generated {count} covers"))
