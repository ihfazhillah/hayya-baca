"""Import articles from Markdown files with YAML frontmatter.

Reads .md files, parses into sections (paragraph/heading/arabic),
and optionally generates quiz questions.

Usage:
    # Import all markdown articles from a directory
    python manage.py import_markdown_articles /path/to/articles/

    # Import and auto-generate quizzes (rule-based)
    python manage.py import_markdown_articles /path/to/articles/ --quiz

    # Import specific files
    python manage.py import_markdown_articles /path/to/article.md

    # Limit number of articles (for testing)
    python manage.py import_markdown_articles /path/to/articles/ --limit 10

    # Skip already imported articles
    python manage.py import_markdown_articles /path/to/articles/ --skip-existing
"""

import random
import re
from pathlib import Path

from django.core.management.base import BaseCommand

from library.models import ArticleSection, Book, Quiz

# Arabic unicode ranges
ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]{5,}")


def parse_frontmatter(text):
    """Extract YAML frontmatter and body from markdown."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if not match:
        return {}, text

    meta = {}
    for line in match.group(1).splitlines():
        m = re.match(r'^(\w+):\s*"?(.*?)"?\s*$', line)
        if m:
            meta[m.group(1)] = m.group(2)
    return meta, match.group(2).strip()


def classify_block(block):
    """Classify a text block as paragraph, heading, or arabic."""
    stripped = block.strip()
    if not stripped:
        return None, stripped

    # Pure Arabic text (no Latin chars)
    has_arabic = bool(ARABIC_RE.search(stripped))
    has_latin = bool(re.search(r"[a-zA-Z]{3,}", stripped))

    if has_arabic and not has_latin and len(stripped) < 500:
        return "arabic", stripped

    # Short line without period = heading
    if len(stripped) < 80 and not stripped.endswith(".") and "\n" not in stripped:
        # Remove markdown heading prefix
        clean = re.sub(r"^#+\s*", "", stripped)
        if clean:
            return "heading", clean

    return "paragraph", stripped


def parse_sections(body):
    """Parse markdown body into structured sections."""
    # Remove leading h1 (duplicate of title)
    body = re.sub(r"^#\s+.*\n+", "", body)

    sections = []
    blocks = re.split(r"\n\n+", body)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        sec_type, text = classify_block(block)
        if sec_type is None:
            continue

        sections.append({"type": sec_type, "text": text})

    return sections


def generate_quiz(title, sections):
    """Generate simple quiz questions from article content.

    Rule-based: extracts facts from paragraphs and creates
    true/false + multiple choice questions.
    """
    # Collect paragraph texts
    paragraphs = [s["text"] for s in sections if s["type"] == "paragraph" and len(s["text"]) > 100]
    if len(paragraphs) < 2:
        return []

    quizzes = []

    # Strategy 1: True/False from sentences
    all_sentences = []
    for p in paragraphs:
        sents = re.split(r"(?<=[.!?])\s+", p)
        for s in sents:
            s = s.strip()
            if 30 < len(s) < 200 and not ARABIC_RE.search(s):
                all_sentences.append(s)

    if all_sentences:
        # Pick a factual sentence for true/false
        sent = random.choice(all_sentences[:10])
        quizzes.append({
            "type": "true_false",
            "question": sent,
            "answer": True,
            "explanation": f"Pernyataan ini benar sesuai dengan isi artikel \"{title}\".",
        })

    # Strategy 2: "Judul artikel ini adalah..." (easy warm-up)
    wrong_titles = [
        "Kisah Nabi Musa dan Firaun",
        "Kemuliaan Sahabat Nabi",
        "Keutamaan Shalat Malam",
        "Adab Bertetangga dalam Islam",
    ]
    options = [title] + random.sample(wrong_titles, min(3, len(wrong_titles)))
    random.shuffle(options)
    quizzes.append({
        "type": "multiple_choice",
        "question": "Apa judul artikel yang baru kamu baca?",
        "options": options,
        "answer": options.index(title),
        "explanation": f"Judul artikel ini adalah \"{title}\".",
    })

    return quizzes[:4]  # Max 4 questions


class Command(BaseCommand):
    help = "Import articles from Markdown files with YAML frontmatter"

    def add_arguments(self, parser):
        parser.add_argument("path", help="Path to articles directory or single .md file")
        parser.add_argument("--quiz", action="store_true", help="Auto-generate quiz questions")
        parser.add_argument("--limit", type=int, default=0, help="Max articles to import")
        parser.add_argument("--skip-existing", action="store_true", help="Skip already imported slugs")
        parser.add_argument("--publish", action="store_true", help="Mark imported articles as published")

    def handle(self, *args, **options):
        path = Path(options["path"])

        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = sorted(path.glob("*.md"))
        else:
            self.stderr.write(f"Not found: {path}")
            return

        if options["limit"]:
            files = files[: options["limit"]]

        imported = 0
        skipped = 0

        for f in files:
            text = f.read_text(encoding="utf-8")
            meta, body = parse_frontmatter(text)

            title = meta.get("title", "").strip()
            if not title:
                self.stderr.write(f"  Skipped (no title): {f.name}")
                skipped += 1
                continue

            # Extract slug from filename (e.g. "104-abu-raihanah.md" -> "article-104")
            slug_match = re.match(r"^(\d+)", f.stem)
            slug = f"article-{slug_match.group(1)}" if slug_match else f"article-{f.stem}"

            if options["skip_existing"] and Book.objects.filter(slug=slug).exists():
                skipped += 1
                continue

            categories = [c.strip() for c in meta.get("category", "").split(",") if c.strip()]

            book, created = Book.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "content_type": Book.ContentType.ARTICLE,
                    "source": meta.get("source", "kisahmuslim.com"),
                    "source_url": meta.get("url", ""),
                    "categories": categories,
                    "min_age": 6,
                    "reward_coins": 1,
                    "is_published": options["publish"],
                },
            )

            if not created:
                book.sections.all().delete()
                book.quizzes.all().delete()

            # Parse and create sections
            sections = parse_sections(body)
            for i, sec in enumerate(sections):
                ArticleSection.objects.create(
                    book=book,
                    order=i,
                    type=sec["type"],
                    text=sec["text"],
                )

            # Generate quiz if requested
            quiz_count = 0
            if options["quiz"]:
                quizzes = generate_quiz(title, sections)
                for i, q in enumerate(quizzes):
                    Quiz.objects.create(
                        book=book,
                        order=i,
                        type=q["type"],
                        question=q["question"],
                        options=q.get("options", []),
                        answer=q["answer"],
                        explanation=q.get("explanation", ""),
                    )
                quiz_count = len(quizzes)

            action = "Created" if created else "Updated"
            sections_count = len(sections)
            quiz_info = f", {quiz_count} quiz" if quiz_count else ""
            self.stdout.write(f"  {action}: {title} ({sections_count} sections{quiz_info})")
            imported += 1

        self.stdout.write(self.style.SUCCESS(
            f"Imported {imported} articles, skipped {skipped}"
        ))
