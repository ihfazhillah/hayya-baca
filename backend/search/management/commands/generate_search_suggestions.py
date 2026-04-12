"""Generate search suggestions from book titles (n-gram TF-IDF) and user query log.

Pure-Python TF-IDF — scope is offline post-publish. No extra deps.
Idempotent: delete + recreate ngram rows; upsert user_query rows.
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone

from library.models import Book
from search.models import SearchLog, SearchSuggestion


NGRAM_MIN = 1
NGRAM_MAX = 4
TOP_NGRAM = 500
USER_QUERY_DAYS = 30
USER_QUERY_MIN_COUNT = 2


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\b\w+\b", _normalize(text))


def _ngrams(tokens: list[str], n_min: int, n_max: int) -> list[str]:
    out = []
    for n in range(n_min, n_max + 1):
        for i in range(len(tokens) - n + 1):
            out.append(" ".join(tokens[i : i + n]))
    return out


def _tfidf(titles: list[str]) -> dict[str, float]:
    docs: list[list[str]] = [_ngrams(_tokenize(t), NGRAM_MIN, NGRAM_MAX) for t in titles]
    n_docs = max(len(docs), 1)

    df: dict[str, int] = defaultdict(int)
    for doc in docs:
        for term in set(doc):
            df[term] += 1

    scores: dict[str, float] = defaultdict(float)
    for doc in docs:
        if not doc:
            continue
        tf = Counter(doc)
        total = sum(tf.values())
        for term, count in tf.items():
            tf_val = count / total
            idf_val = math.log((1 + n_docs) / (1 + df[term])) + 1
            scores[term] += tf_val * idf_val
    return scores


class Command(BaseCommand):
    help = "Regenerate SearchSuggestion rows from published titles + user query log."

    def handle(self, *args, **options):
        titles = list(
            Book.objects.filter(is_published=True).values_list("title", flat=True)
        )
        scores = _tfidf(titles)
        top = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:TOP_NGRAM]

        SearchSuggestion.objects.filter(
            source=SearchSuggestion.SOURCE_NGRAM
        ).delete()
        SearchSuggestion.objects.bulk_create(
            [
                SearchSuggestion(
                    phrase=phrase,
                    source=SearchSuggestion.SOURCE_NGRAM,
                    weight=weight,
                )
                for phrase, weight in top
            ]
        )

        cutoff = timezone.now() - timedelta(days=USER_QUERY_DAYS)
        rows = (
            SearchLog.objects.filter(created_at__gte=cutoff)
            .values("query")
            .annotate(c=Count("id"))
            .filter(c__gte=USER_QUERY_MIN_COUNT)
        )
        seen_user_phrases: set[str] = set()
        for row in rows:
            phrase = _normalize(row["query"]).strip()
            if not phrase:
                continue
            seen_user_phrases.add(phrase)
            SearchSuggestion.objects.update_or_create(
                phrase=phrase,
                defaults={
                    "source": SearchSuggestion.SOURCE_USER,
                    "weight": float(row["c"]),
                },
            )
        SearchSuggestion.objects.filter(
            source=SearchSuggestion.SOURCE_USER
        ).exclude(phrase__in=seen_user_phrases).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"ngram={len(top)} user_query={len(seen_user_phrases)}"
            )
        )
