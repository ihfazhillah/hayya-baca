# Spec 064 — English module: auth, lesson visibility, user-created lessons

## Problem

The English Practice module (`english.ihfazh.com` + `english` backend app) is
currently **fully public** (`AllowAny`) and lessons are admin-only (imported via
`import_english_lesson`). We want:

1. **Login required** — access `english-web` only with an existing backend
   account. For now **guardian** accounts (username + password); designed so
   **child** accounts can be added later without rework.
2. **Lesson visibility** — some lessons are **public** (visible to every logged-in
   account) and some are **private to the owner**.
3. **User-created lessons** — a logged-in user can create a lesson from the web by
   typing English text; the server generates **AU-accent audio** for it (MeloTTS
   EN-AU). The user can optionally toggle their lesson **public**.
4. **Private audio is access-controlled** — segment mp3 of a private lesson must
   not be openly downloadable from `/media/`.

## Actors

- **Guardian** — Django `User` (no linked child account). Logs in with
  username + password via existing `POST /api/auth/login/` → DRF token.
- **(future) Child** — `Child.user` account via `child-login`. Out of scope now
  but the ownership model (`owner = User`) already accommodates it.

## Definitions / visibility rules

A lesson is **visible** to authenticated user `U` when any holds:

- `owner_id == U.id` — **own** lesson (any status; U sees their own drafts +
  processing state).
- `is_public == True AND audio_status == 'ready'` — someone's **published public**
  lesson (never expose a half-generated public lesson to others).
- `owner_id IS NULL AND is_published == True` — **legacy admin** lesson imported
  via the management command.

`audio_status ∈ {pending, processing, ready, failed}`.
- Admin-imported lessons: `ready` (audio already present).
- User-created lessons: start `pending` → worker sets `processing` → `ready`/`failed`.

A lesson is **playable** only when `audio_status == 'ready'`.

## Functional requirements

### Backend

- **FR1** All `english` API endpoints require authentication (`IsAuthenticated`).
  Unauthenticated → 401.
- **FR2** `GET /api/english/lessons/` returns only lessons visible to the caller
  (rule above), annotated with `segment_count`, plus `owner`-derived fields:
  `is_owner` (bool), `is_public`, `audio_status`.
- **FR3** `GET /api/english/lessons/{id}/` returns detail only if visible, else 404
  (not 403 — don't leak existence of private lessons).
- **FR4** `POST /api/english/lessons/` (new) — authenticated create:
  body `{title, level, text, is_public}`. Server splits `text` into sentence
  segments, creates the lesson with `owner=caller`, `source='custom'`,
  `audio_status='pending'`, and empty-audio segments. Returns the created lesson.
- **FR5** `PATCH /api/english/lessons/{id}/` — owner-only: toggle `is_public`,
  edit `title`/`level`. Non-owner → 404. (No text edit after creation in v1 —
  editing text = delete + recreate, keeps audio-regen simple.)
- **FR6** `DELETE /api/english/lessons/{id}/` — owner-only; cascades segments +
  deletes audio files.
- **FR7** Segment audio is served through an **auth-checked** endpoint
  `GET /api/english/segments/{id}/audio/`: 200 (via X-Accel in prod) if the
  caller can see the parent lesson, else 404. The serializer's `audio_url` points
  to **this endpoint**, never the raw `/media/` URL. Direct `/media/english/…`
  access is denied by nginx (see plan).

### Audio generation (MeloTTS, separate Python 3.12 venv)

- **FR8** A worker (`manage.py generate_pending_audio [--loop]`) run under a
  **separate Python 3.12 venv** (backend venv is 3.14; MeloTTS needs ≤3.12)
  picks up `pending` lessons, synthesizes EN-AU mp3 per segment, saves to
  `segment.audio`, and sets the lesson `ready` (or `failed` on error, with the
  reason logged). Runs as a systemd service polling every few seconds.
- **FR9** Generation is idempotent/resumable: re-running regenerates only
  segments whose audio is missing; a crashed `processing` lesson is retried.

### Frontend (`english-web`)

- **FR10** Unauthenticated visitor sees a **login page** (username + password).
  Successful login stores the token (localStorage) and enters the app; 401 on any
  request clears the token → back to login. Logout button clears token.
- **FR11** Lessons list shows **own** + **public** lessons, with badges:
  own/private/public and a **"diproses…"** state for own lessons still generating.
- **FR12** **Buat Lesson** page: title, level, English text, "publik" toggle →
  `POST` → returns to list where the new lesson shows processing; the list/detail
  **polls** until `ready`, then it's playable.
- **FR13** All existing practice modes (listen/dictation/shadowing, transcribe)
  keep working, now authenticated.

### RN app

- **FR14** RN `src/lib/english.ts` already calls through `apiFetch` (sends token),
  so RN keeps working under `IsAuthenticated`; it will now see own + public
  lessons. Creating lessons from RN is **out of scope**.

## Non-goals (v1)

- Child login to english-web (model-ready, UI later).
- Editing lesson text after creation (delete + recreate instead).
- YouTube user-created lessons (custom-text only for user creation).
- Sharing/permission granularity beyond public/private.

## Edge cases

- **Empty/very long text** on create → validate: non-empty, cap length
  (e.g. ≤ 5000 chars / ≤ 60 segments) → 400.
- **Duplicate slug** for user lessons → slug includes owner id / random suffix to
  stay unique.
- **Generation failure** (bad MeloTTS load) → lesson `failed`, surfaced in UI with
  a retry affordance (owner-only re-queue).
- **Non-owner requests private audio/detail** → 404, never 403 (no existence leak).
- **Public lesson still processing** → excluded from other users' lists (FR2 rule).
- **Token invalid/expired** → 401 → frontend logs out cleanly.
- **X-Accel disabled in dev** → view falls back to `FileResponse` so local dev
  works without nginx.

## Acceptance

- Logged-out `curl` to `/api/english/lessons/` → 401.
- Guardian login → sees admin public + own lessons; not other users' private ones.
- Create lesson → appears as processing → worker fills audio → becomes playable.
- Toggling public makes it visible to a second account (once ready).
- Private lesson audio URL is not directly fetchable from `/media/`; the
  authenticated segment-audio endpoint serves it only to permitted users.
- Backend use-case tests green; `english-web` typecheck + build green.
