# Implementation Plan: Unified Search (Buku & Artikel)

**Spec**: [spec.md](./spec.md)
**Branch**: `003-search-feature`
**Created**: 2026-04-12
**Status**: Draft — awaiting approval

## Scope Decisions (locked)

1. **New Django app `search/`** — own models, views, urls, management command. Book/Article tetap di `library/`.
2. **TF-IDF**: pakai `scikit-learn`'s `TfidfVectorizer`. Tambah ke `backend/pyproject.toml` dependencies (`scikit-learn>=1.5`). Alasan: lebih akurat, n-gram + tokenisasi sudah built-in, scope management command saja (tidak hot-path request).
3. **Ranking**: deterministic scoring di Python (bukan TfidfVectorizer) — sesuai FR-4 spec. TF-IDF hanya dipakai offline untuk generate suggestion corpus.
4. **Pure API, no cache**: mobile tidak menyimpan hasil/suggestion di SQLite.
5. **Entry point**: icon search di header `app/home.tsx`, route `/search` ke screen baru `app/search.tsx`.
6. **Debounce**: 250ms di mobile untuk suggest + search paralel.
7. **SearchLog**: hanya saat tap hasil (bukan submit). Fire-and-forget dari mobile.
8. **Offline**: tidak ada fallback — tampilkan error ramah "Perlu internet untuk cari".

## Workflow

Per `feedback_test_first`: **Plan → Approval → Tests (red) → Implement → Green → Manual E2E**.

Test red dulu (backend pytest + mobile usecase), baru implement.

---

## 1. Backend (Django)

Location: `backend/search/` (new app).

### 1.1 Dependency

`backend/pyproject.toml`: tambah `"scikit-learn>=1.5"` di `dependencies`. Run `uv sync` untuk update `uv.lock`.

### 1.2 App scaffolding

- `python manage.py startapp search` (manual folder OK).
- Register di `config/settings/base.py` `INSTALLED_APPS`: `'search'`.
- `search/urls.py` mounted di `config/urls.py` sebagai `path('api/search/', include('search.urls'))`.

### 1.3 Models — `backend/search/models.py`

```python
class SearchSuggestion(models.Model):
    SOURCE_NGRAM = 'ngram_title'
    SOURCE_USER  = 'user_query'
    SOURCE_CHOICES = [(SOURCE_NGRAM, 'Ngram Title'), (SOURCE_USER, 'User Query')]

    phrase     = models.CharField(max_length=255, unique=True, db_index=True)
    source     = models.CharField(max_length=16, choices=SOURCE_CHOICES)
    weight     = models.FloatField(default=0.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['source', '-weight'])]


class SearchLog(models.Model):
    TYPE_BOOK    = 'book'
    TYPE_ARTICLE = 'article'
    TYPE_CHOICES = [(TYPE_BOOK, 'Book'), (TYPE_ARTICLE, 'Article')]

    child       = models.ForeignKey('accounts.Child', on_delete=models.CASCADE, related_name='search_logs')
    query       = models.CharField(max_length=255, db_index=True)
    result_slug = models.CharField(max_length=255)
    result_type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['-created_at'])]
```

Migration: `0001_initial.py`.

### 1.4 Serializers — `backend/search/serializers.py`

- `SearchResultSerializer` — plain serializer (bukan ModelSerializer), fields: `slug, type, title, categories, cover_url, already_read, score`.
- `SuggestionSerializer` — fields: `phrase, source`.
- `SearchLogCreateSerializer` — input validator untuk POST log.

### 1.5 Views — `backend/search/views.py`

Semua `IsAuthenticated`.

**`SearchView` (GET `/api/search/`)**
- Query params: `q` (required, min 1 char), `child_slug` (optional).
- Query `Book.objects.filter(is_published=True)` (single table — books + articles pakai `content_type` field).
- Filter: `Q(title__icontains=q) | Q(categories__icontains=q)` (categories = CharField/JSON — cek existing model; kalau M2M, adapt).
- Python-side loop: hitung `score` per FR-4, attach `already_read` via prefetch:
  - Books → `reading_progress` filtered by child.
  - Articles → `reading_log` filtered by child.
- Filter `score > 0`, sort `(-score, -updated_at)`, cap 30.
- Return `{results: [...], total: len(results)}`.

**`SuggestView` (GET `/api/search/suggest/`)**
- Query param: `q` (optional).
- Jika `q` kosong → top 5 `SearchSuggestion` where `source='user_query'` ordered `-weight`.
- Jika `q` ada → `SearchSuggestion.objects.filter(phrase__istartswith=q).order_by('-weight')[:8]`, gabungkan kedua source.
- Return `{suggestions: [...]}`.

**`SearchLogCreateView` (POST `/api/search/log/`)**
- Body: `{child_slug, query, result_slug, result_type}`.
- Resolve child by slug (scope ke user request). 404 jika bukan milik user.
- Insert baru (tidak upsert).
- Return 201, body minimal.

### 1.6 URLs — `backend/search/urls.py`

```python
urlpatterns = [
    path('', SearchView.as_view(), name='search'),
    path('suggest/', SuggestView.as_view(), name='search-suggest'),
    path('log/', SearchLogCreateView.as_view(), name='search-log'),
]
```

### 1.7 Management command — `backend/search/management/commands/generate_search_suggestions.py`

Langkah:
1. Query `Book.objects.filter(is_published=True).values_list('title', flat=True)`.
2. `TfidfVectorizer(ngram_range=(1,4), lowercase=True, strip_accents='unicode', token_pattern=r'\b\w+\b')` → fit_transform titles.
3. Sum tf-idf per ngram across docs → rank → ambil top 500.
4. `SearchSuggestion.objects.filter(source='ngram_title').delete()` → bulk_create baru.
5. Aggregate `SearchLog`:
   ```python
   from django.db.models import Count
   from django.utils import timezone
   from datetime import timedelta
   cutoff = timezone.now() - timedelta(days=30)
   rows = (SearchLog.objects.filter(created_at__gte=cutoff)
           .values('query').annotate(c=Count('id')).filter(c__gte=2))
   ```
   Upsert per query ke `SearchSuggestion(source='user_query', weight=count)`.
6. Idempotent: delete + recreate ngram rows tiap run; user_query upsert via `update_or_create`.

### 1.8 Backend tests — `backend/search/tests/test_search.py` (pytest-django)

Red-first. Minimum coverage:
- `test_search_exact_title_scores_100`
- `test_search_prefix_scores_50`
- `test_search_contains_scores_25`
- `test_search_category_match_scores_10`
- `test_search_already_read_boost_5` (with child_slug)
- `test_search_sort_score_then_updated_at`
- `test_search_caps_at_30`
- `test_suggest_empty_returns_top_user_queries`
- `test_suggest_prefix_matches_ngram_and_user`
- `test_log_click_creates_row`
- `test_log_requires_auth`
- `test_generate_suggestions_idempotent` (run 2× → same DB state)

Gunakan factory/fixture minimal, hit DRF APIClient.

---

## 2. Mobile (React Native / Expo)

### 2.1 Types — `src/types/search.ts` (new)

```ts
export type SearchResultType = 'book' | 'article';

export type SearchResult = {
  slug: string;
  type: SearchResultType;
  title: string;
  categories: string[];
  coverUrl?: string;
  alreadyRead: boolean;
  score: number;
};

export type Suggestion = { phrase: string; source: 'ngram_title' | 'user_query' };
```

### 2.2 API client — `src/lib/api.ts`

Tambah:
- `searchContent(query: string, childSlug?: string): Promise<SearchResult[]>`
- `searchSuggest(query: string): Promise<Suggestion[]>`
- `logSearchClick(childSlug, query, resultSlug, resultType): Promise<void>`

Pakai `apiFetch` existing. Map snake_case → camelCase di client.

### 2.3 Icon entry — `app/home.tsx`

- Tambah `IconButton` (ionicon `search`) di header, di sebelah existing trailing buttons.
- `onPress={() => router.push('/search')}`.
- Visible di semua tab (home.tsx adalah shared header).

### 2.4 Screen baru — `app/search.tsx`

State:
- `query: string`
- `suggestions: Suggestion[]`
- `results: SearchResult[]`
- `loading: boolean`
- `error: string | null`

Behavior:
- `TextInput` `autoFocus`, placeholder "Cari buku atau artikel…".
- `useEffect` debounce 250ms:
  - `q.length < 2` → `searchSuggest('')` → set `suggestions`, kosongkan `results`.
  - `q.length >= 2` → paralel `Promise.all([searchSuggest(q), searchContent(q, activeChild?.slug)])`.
- Error network → set `error` "Perlu internet untuk cari. Coba lagi ya!".
- Section render:
  1. Suggestions (chip list horizontal) — tap → setQuery + trigger search.
  2. Results (FlatList vertikal) — item via `SearchResultItem`.
- Empty:
  - `query=''` → heading "Pencarian populer" + suggestions.
  - `query>=2 && results.length===0 && !loading` → empty state "Tidak ditemukan. Coba kata lain ya!".
- Tap result:
  1. `logSearchClick(...)` fire-and-forget (ignore errors).
  2. `router.push('/read/' + slug)` atau `/article/' + slug)`.

### 2.5 Component — `src/components/SearchResultItem.tsx` (new)

Re-use visual pattern dari `FavoritSection` item:
- Cover thumbnail (atau initials fallback).
- Title.
- Badge `BUKU` / `ARTIKEL`.
- Badge `✓ Pernah dibaca` kalau `alreadyRead`.

### 2.6 Test — `src/__tests__/usecase-search.test.tsx`

Mock `@/lib/api` functions. Red-first. Cakup:
- Mengetik query → memanggil `searchContent` + `searchSuggest` (setelah debounce).
- Empty input → render "Pencarian populer" dari `searchSuggest('')`.
- 0 hasil → empty state visible.
- Tap hasil book → `logSearchClick` terpanggil + `router.push('/read/[slug]')`.
- Tap hasil article → navigate ke `/article/[slug]`.
- Error network → pesan ramah anak muncul, tidak crash.

Pakai `jest.useFakeTimers()` untuk advance debounce.

---

## 3. Seed / Dev setup

- Jalankan sekali di dev: `cd backend && uv run python manage.py migrate && uv run python manage.py generate_search_suggestions`.
- Dokumentasikan di PR description (bukan CLAUDE.md).

---

## 4. Rollout checklist

- [ ] Backend tests red → green
- [ ] Mobile usecase test red → green
- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` full suite green
- [ ] Manual E2E via `/test-local`:
  - [ ] Icon search muncul di home
  - [ ] Mengetik → suggestion muncul
  - [ ] Submit → hasil mixed book/article, badge tipe benar
  - [ ] Tap hasil → navigate benar, SearchLog tercipta di backend
  - [ ] Already-read badge muncul untuk konten yang pernah dibaca child aktif
  - [ ] Offline → pesan ramah, no crash
- [ ] Satu commit per area: `feat(search): #003 backend`, `feat(search): #003 mobile`, dst.

## Open Questions

1. `Book.categories` di model existing — JSONField, M2M, atau CharField? Perlu cek sebelum implement filter `__icontains`. (Akan di-verify saat test red.)
2. Apakah `accounts.Child` benar nama app/model-nya? Atau di app lain? (Cek cepat sebelum migrasi.)
3. `TfidfVectorizer` + Python 3.14 compat — `scikit-learn>=1.5` harusnya OK, konfirmasi via `uv sync` dry run.
