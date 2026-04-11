"""Report riwayat bacaan anak dalam rentang waktu tertentu.

Usage:
    python manage.py reading_report --days 30
    python manage.py reading_report --days 14 --child Sakinah
    python manage.py reading_report --days 30 --overview-only
    python manage.py reading_report --days 30 --detail-only

Output: detail per tanggal (dikelompokkan per anak) + overview
(jumlah buku, jumlah artikel, distribusi kategori).
"""

from collections import Counter, defaultdict
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.utils import timezone

WIB = ZoneInfo("Asia/Jakarta")

from accounts.models import Child
from library.models import Book
from reading.models import ReadingLog


class Command(BaseCommand):
    help = "Tampilkan riwayat bacaan anak (detail + overview) dalam N hari terakhir."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=14,
            help="Rentang waktu mundur dari sekarang (default: 14).",
        )
        parser.add_argument(
            "--child",
            type=str,
            default=None,
            help="Filter nama anak (case-insensitive, substring match).",
        )
        parser.add_argument(
            "--detail-only",
            action="store_true",
            help="Hanya tampilkan detail per tanggal, tanpa overview.",
        )
        parser.add_argument(
            "--overview-only",
            action="store_true",
            help="Hanya tampilkan overview, tanpa detail per tanggal.",
        )

    def handle(self, *args, **opts):
        days = opts["days"]
        child_filter = opts["child"]
        show_detail = not opts["overview_only"]
        show_overview = not opts["detail_only"]

        since = timezone.now() - timedelta(days=days)

        logs_qs = ReadingLog.objects.filter(completed_at__gte=since)
        if child_filter:
            matching = Child.objects.filter(name__icontains=child_filter)
            logs_qs = logs_qs.filter(child__in=matching)
        logs = list(logs_qs.order_by("child_id", "-completed_at"))

        children = {c.id: c.name for c in Child.objects.all()}
        slugs = {l.book_id for l in logs if not l.book_id.startswith("__")}
        books = {b.slug: b for b in Book.objects.filter(slug__in=slugs)}

        # Group per child → per date
        grouped: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
        for l in logs:
            if l.book_id.startswith("__"):
                continue
            name = children.get(l.child_id, f"child#{l.child_id}")
            date_key = l.completed_at.astimezone(WIB).strftime("%Y-%m-%d")
            grouped[name][date_key].append(l)

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"\n=== Reading report: {days} hari terakhir (sejak {since.strftime('%Y-%m-%d')}) ==="
            )
        )
        self.stdout.write(f"Total entri (exclude unlock markers): {sum(len(v) for d in grouped.values() for v in d.values())}\n")

        if not grouped:
            self.stdout.write(self.style.WARNING("Tidak ada data di rentang ini."))
            return

        for name in sorted(grouped.keys()):
            dates = grouped[name]
            total = sum(len(v) for v in dates.values())
            self.stdout.write(
                self.style.HTTP_INFO(f"\n── {name} ({total} bacaan) ──")
            )

            if show_detail:
                for date_key in sorted(dates.keys(), reverse=True):
                    self.stdout.write(f"  {date_key}:")
                    for l in dates[date_key]:
                        b = books.get(l.book_id)
                        title = b.title if b else l.book_id
                        ctype = b.content_type if b else "?"
                        cats = ", ".join(b.categories) if b and b.categories else "-"
                        ts = l.completed_at.astimezone(WIB).strftime("%H:%M")
                        self.stdout.write(
                            f"    {ts} WIB [{ctype:7}] {title}  ({cats})"
                        )

            if show_overview:
                book_count = 0
                article_count = 0
                cat_counter: Counter[str] = Counter()
                title_counter: Counter[str] = Counter()
                for entries in dates.values():
                    for l in entries:
                        b = books.get(l.book_id)
                        if not b:
                            continue
                        if b.content_type == Book.ContentType.BOOK:
                            book_count += 1
                        elif b.content_type == Book.ContentType.ARTICLE:
                            article_count += 1
                        for c in (b.categories or []):
                            cat_counter[c] += 1
                        title_counter[b.title] += 1

                self.stdout.write(self.style.SUCCESS(f"  Overview:"))
                self.stdout.write(
                    f"    Buku: {book_count} | Artikel: {article_count} | Unik judul: {len(title_counter)}"
                )
                if cat_counter:
                    self.stdout.write(f"    Kategori:")
                    for cat, n in cat_counter.most_common():
                        self.stdout.write(f"      {n:3}x  {cat}")
                else:
                    self.stdout.write(
                        "    Kategori: (kosong — kemungkinan semua bacaan adalah buku tanpa categories)"
                    )

        # Global overview across all children
        if show_overview and len(grouped) > 1:
            self.stdout.write(self.style.MIGRATE_HEADING("\n── Global overview ──"))
            g_book = g_article = 0
            g_cats: Counter[str] = Counter()
            for l in logs:
                if l.book_id.startswith("__"):
                    continue
                b = books.get(l.book_id)
                if not b:
                    continue
                if b.content_type == Book.ContentType.BOOK:
                    g_book += 1
                elif b.content_type == Book.ContentType.ARTICLE:
                    g_article += 1
                for c in (b.categories or []):
                    g_cats[c] += 1
            self.stdout.write(f"  Total buku: {g_book} | Total artikel: {g_article}")
            if g_cats:
                self.stdout.write(f"  Top kategori:")
                for cat, n in g_cats.most_common(10):
                    self.stdout.write(f"    {n:3}x  {cat}")
