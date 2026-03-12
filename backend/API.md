# Hayya Baca API Contract

Base URL: `https://<server>/api/`

Interactive docs: `GET /api/docs/`
OpenAPI schema: `GET /api/schema/`

## Authentication

Token-based. Include header: `Authorization: Token <token>`

### Register

```
POST /api/auth/register/
Content-Type: application/json

{
  "username": "ayah_ahmad",
  "password": "secret123",
  "password2": "secret123"
}

→ 201
{ "token": "abc123..." }
```

### Login

```
POST /api/auth/login/
Content-Type: application/json

{ "username": "ayah_ahmad", "password": "secret123" }

→ 200
{ "token": "abc123..." }

→ 401
{ "detail": "Username atau password salah" }
```

### Logout

```
POST /api/auth/logout/
Authorization: Token abc123...

→ 204 (no content)
```

---

## Children

### List children (mine)

```
GET /api/children/
Authorization: Token abc123...

→ 200
[
  {
    "id": 1,
    "name": "Ahmad",
    "age": 5,
    "avatar_color": "#1A73E8",
    "coins": 12,
    "stars": 45,
    "created_at": "2026-03-12T18:00:00Z"
  }
]
```

### Create child

```
POST /api/children/
Authorization: Token abc123...

{ "name": "Ahmad", "age": 5, "avatar_color": "#E91E63" }

→ 201
{ "id": 1, "name": "Ahmad", "age": 5, "avatar_color": "#E91E63", "coins": 0, "stars": 0, "created_at": "..." }
```

Automatically creates `ChildAccess(role=parent)` for the current user.

### Update child (parent only)

```
PATCH /api/children/1/
Authorization: Token abc123...

{ "name": "Ahmad Faris", "age": 6 }

→ 200
```

### Delete child (parent only)

```
DELETE /api/children/1/
→ 204
```

### List access (parent only)

```
GET /api/children/1/access/
Authorization: Token abc123...

→ 200
[
  { "id": 1, "username": "ayah_ahmad", "role": "parent", "created_at": "..." },
  { "id": 2, "username": "bu_guru", "role": "teacher", "created_at": "..." }
]
```

### Revoke access (parent only)

```
DELETE /api/children/1/access/
Authorization: Token abc123...

{ "access_id": 2 }

→ 204
```

Cannot revoke own access.

---

## Sharing (Invite)

### Generate invite code (parent only)

```
POST /api/share/invites/
Authorization: Token abc123...

{ "child": 1, "role": "teacher" }

→ 201
{
  "id": 1,
  "child": 1,
  "code": "A1B2C3D4",
  "role": "teacher",
  "expires_at": "2026-03-14T18:00:00Z"
}
```

Code expires in 48 hours. Role can be `"parent"` (max 2) or `"teacher"`.

### Redeem invite code

```
POST /api/auth/redeem/
Authorization: Token abc123...

{ "code": "A1B2C3D4" }

→ 201
{
  "detail": "Berhasil",
  "child": { "id": 1, "name": "Ahmad", ... }
}
```

### List my invites

```
GET /api/share/invites/
→ 200 [...]
```

### Cancel invite

```
DELETE /api/share/invites/1/
→ 204
```

---

## Books & Articles (public, no auth required)

### List

```
GET /api/books/
GET /api/books/?type=book
GET /api/books/?type=article
GET /api/books/?type=article&category=Kisah Nyata
GET /api/books/?min_age=6

→ 200
[
  {
    "id": 25,
    "title": "Lelaki Anshar dengan Tiga Anak Panah",
    "content_type": "article",
    "cover": "/media/covers/cover_25.png",
    "categories": ["Kisah Nyata"],
    "min_age": 6,
    "reward_coins": 1,
    "has_audio": false,
    "published_version": 1
  }
]
```

### Detail (book)

```
GET /api/books/1/

→ 200
{
  "id": 1,
  "title": "Sahabat yang disebut namanya di langit",
  "content_type": "book",
  "cover": "/media/covers/cover_1.png",
  "source": "",
  "source_url": "",
  "categories": [],
  "reference_ar": "...",
  "reference_id": "...",
  "min_age": 0,
  "reward_coins": 12,
  "has_audio": false,
  "published_version": 1,
  "pages": [
    { "page": 1, "text": "Siapakah sahabat...", "audio": "" },
    { "page": 2, "text": "Ya, beliau adalah...", "audio": "" }
  ],
  "sections": [],
  "quizzes": []
}
```

### Detail (article)

```
GET /api/books/25/

→ 200
{
  "id": 25,
  "title": "Lelaki Anshar dengan Tiga Anak Panah",
  "content_type": "article",
  ...
  "pages": [],
  "sections": [
    { "order": 0, "type": "paragraph", "text": "...", "items": [] },
    { "order": 1, "type": "heading", "text": "Alkisah", "items": [] },
    { "order": 2, "type": "list", "text": "", "items": ["point 1", "point 2"] }
  ],
  "quizzes": [
    {
      "id": 1,
      "order": 0,
      "type": "multiple_choice",
      "question": "Apa yang ditemukan...",
      "options": ["A", "B", "C", "D"],
      "answer": 1,
      "explanation": "Karena..."
    },
    {
      "id": 2,
      "order": 1,
      "type": "true_false",
      "question": "Allah memasukkan...",
      "options": [],
      "answer": true,
      "explanation": "Rasulullah..."
    }
  ]
}
```

### Static content (alternative, no DB)

```
GET /media/published/manifest.json      → content index with versions
GET /media/published/books/1.json       → individual book
GET /media/published/articles/25.json   → individual article
```

---

## Reading Progress

### List progress for a child

```
GET /api/children/1/progress/
Authorization: Token abc123...

→ 200
[
  {
    "id": 1,
    "child": 1,
    "book": 3,
    "last_page": 12,
    "completed": false,
    "completed_count": 0,
    "updated_at": "2026-03-12T19:00:00Z"
  }
]
```

### Upsert progress

```
POST /api/children/1/progress/
Authorization: Token abc123...

{
  "child": 1,
  "book": 3,
  "last_page": 15,
  "completed": true,
  "completed_count": 1
}

→ 201
```

Uses `update_or_create` on (child, book) — safe to POST repeatedly.

---

## Quiz Attempts

### Submit quiz result

```
POST /api/children/1/quiz-attempts/
Authorization: Token abc123...

{
  "child": 1,
  "book": 25,
  "score": 3,
  "total": 4
}

→ 201
{
  "id": 1,
  "child": 1,
  "book": 25,
  "score": 3,
  "total": 4,
  "stars_earned": 3,
  "created_at": "2026-03-12T19:30:00Z"
}
```

`stars_earned` is auto-calculated:
- 100% → 4 stars
- ≥75% → 3 stars
- ≥50% → 2 stars
- ≥25% → 1 star
- <25% → 0 stars

Stars are automatically added to child's total.

### List quiz attempts

```
GET /api/children/1/quiz-attempts/
→ 200 [...]
```

---

## Rewards

### List reward history

```
GET /api/children/1/rewards/
Authorization: Token abc123...

→ 200
[
  {
    "id": 1,
    "child": 1,
    "type": "coin",
    "count": 3,
    "description": "Selesai buku: Sahabat yang disebut namanya di langit",
    "created_at": "2026-03-12T18:30:00Z",
    "synced": true
  }
]
```

### Bulk sync from device

```
POST /api/children/1/rewards/sync/
Authorization: Token abc123...

{
  "rewards": [
    { "child": 1, "type": "coin", "count": 3, "description": "Selesai buku: ..." },
    { "child": 1, "type": "star", "count": 12, "description": "Stars halaman 1-15" }
  ]
}

→ 201
{ "detail": "Synced" }
```

Automatically updates child's `coins` and `stars` totals.

---

## Permission Matrix

| Endpoint | Parent | Teacher | No auth |
|----------|--------|---------|---------|
| Auth (register/login) | — | — | ✅ |
| List/create children | ✅ | ✅ (read) | ❌ |
| Edit/delete child | ✅ | ❌ | ❌ |
| Share/access management | ✅ | ❌ | ❌ |
| Books list/detail | ✅ | ✅ | ✅ |
| Reading progress | ✅ | ✅ (read) | ❌ |
| Quiz attempts | ✅ | ✅ (read) | ❌ |
| Rewards | ✅ | ✅ (read) | ❌ |
| Reward sync | ✅ | ❌ | ❌ |

---

## Error Format

```json
{
  "detail": "Error message"
}
```

or field-level:

```json
{
  "username": ["Username sudah dipakai"],
  "password2": ["Password tidak cocok"]
}
```

HTTP status codes: 200, 201, 204, 400, 401, 403, 404.
