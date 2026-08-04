# Plan 064 — implementation

## Architecture overview

```
english-web (SPA, token in localStorage)
   │  Authorization: Token <key>
   ▼
nginx english.ihfazh.com ──/api/──▶ gunicorn (Django 3.14 venv)  ── Postgres
   │                                     │
   │ /media/english/  → DENY (403)       │ writes EnglishLesson(audio_status=pending)
   │ /protected-english-media/ (internal)│
   ▼ (X-Accel from segment-audio view)   ▼
                              MeloTTS worker (SEPARATE Python 3.12 venv)
                              systemd `english-tts.service`, ORM poll loop
                              synth EN-AU mp3 → segment.audio → status=ready
```

Two venvs share the same repo + Postgres + MEDIA_ROOT:
- `backend/.venv` — Python 3.14, runs gunicorn/Django (existing).
- `backend/.venv-melo` — **Python 3.12**, has `django`, `psycopg`, `MeloTTS`
  (+ torch CPU). Runs ONLY the generation worker via `manage.py`. Never serves web.

## Backend changes (`backend/english/`)

### models.py
- `EnglishLesson`:
  - `owner = ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=CASCADE, related_name="english_lessons")`
  - `is_public = BooleanField(default=False)`
  - `audio_status = CharField(max_length=12, choices=Status, default=Status.READY)`
    (new lessons created via API pass `PENDING` explicitly; import command keeps default READY)
  - `Status = {PENDING, PROCESSING, READY, FAILED}`
  - `error = TextField(blank=True)` (last generation error)
  - slug: for owned lessons append short random suffix to guarantee uniqueness.
- Migration `0002_lesson_owner_visibility.py`.

### querysets / visibility (views.py)
- `visible_to(user)` manager/helper implementing the FR2 rule via `Q`.
- `EnglishLessonViewSet`:
  - `permission_classes = [IsAuthenticated]`
  - `ReadOnlyModelViewSet` → `ModelViewSet` (add create/patch/destroy) but gate
    write actions with an `IsOwnerOrReadOnly`-style permission; create sets owner.
  - `get_queryset` = `visible_to(self.request.user)` annotated `segment_count`.
  - `perform_create`: split sentences (reuse logic akin to pipeline
    `split_sentences`), create segments, `audio_status=PENDING`, `source=custom`,
    `owner=user`.
  - detail/patch/destroy resolve within the visible queryset → 404 if not.

### serializers.py
- List: add `is_owner` (SerializerMethodField vs request.user), `is_public`,
  `audio_status`.
- Detail: same + segments; `EnglishSegmentSerializer.get_audio_url` returns the
  **protected endpoint** URL `/api/english/segments/{id}/audio/` (absolute via
  request), not `obj.audio.url`.
- Create serializer: `title, level, text, is_public`; validate text length/segments.

### protected audio (views.py + urls.py)
- `SegmentAudioView(APIView, IsAuthenticated)`: look up segment; verify parent
  lesson ∈ `visible_to(user)` else 404. If `settings.ENGLISH_USE_X_ACCEL`: return
  empty 200 with `X-Accel-Redirect: /protected-english-media/<audio.name>` +
  `Content-Type: audio/mpeg`. Else `FileResponse(open(audio.path))` (dev).
- url: `path("english/segments/<int:pk>/audio/", SegmentAudioView.as_view())`.
- Keep `transcribe/` but flip to `IsAuthenticated`.

### settings
- `ENGLISH_USE_X_ACCEL = env bool` (prod=1, dev unset).

### management command (worker) — `generate_pending_audio.py`
- Args: `--loop` (poll forever, sleep interval), else single pass.
- Logic: select `PENDING` (and stale `PROCESSING`) lessons FIFO; mark PROCESSING;
  for each segment without audio: MeloTTS EN-AU synth → wav → mp3 (ffmpeg/pydub) →
  `segment.audio.save(...)`; on success `READY`, on exception `FAILED` + `error`.
- MeloTTS import is lazy + guarded (clear message if run under the 3.14 venv).
- Reuses EN-AU speaker-selection logic from `tools/english-pipeline/make_lesson.py`.

## MeloTTS 3.12 venv + systemd (server, deploy)

- Create `backend/.venv-melo` with Python 3.12 (`uv venv --python 3.12` or system
  3.12). Install: `django`, `psycopg[binary]`, `MeloTTS` (git), `pydub`, torch CPU.
  `python -m unidic download` if required by MeloTTS.
- systemd `english-tts.service`: `ExecStart=<.venv-melo>/bin/python manage.py
  generate_pending_audio --loop`, `EnvironmentFile=backend/.env` (Postgres +
  MEDIA_ROOT), `WorkingDirectory=backend`, restart=always. Deploy doc in
  `deploy/english-tts.service` (repo) mirroring how `hayyabaca.service` is set up.
- One-time warmup note (MeloTTS downloads model on first synth).

## nginx (`deploy/english.nginx.conf` + server)

- Add internal location:
  ```
  location /protected-english-media/ {
      internal;
      alias /home/ihfazh/hayyabaca/backend/media/;
  }
  ```
- Deny direct access to english audio so only X-Accel can serve it:
  ```
  location /media/english/ { return 403; }
  ```
  (Other apps' `/media/` unaffected.)

## Frontend (`english-web/src`)

- `auth.tsx` — `AuthContext` {token, user, login(username,password), logout}.
  Token in `localStorage['english.token']`; login → `POST /api/auth/login/`.
- `api.ts` — attach `Authorization: Token`; on 401 call `logout()` + throw;
  add `createLesson`, `patchLesson`, `deleteLesson`, `fetchLesson` (unchanged path).
- `main.tsx`/`App.tsx` — wrap in `AuthProvider`; route guard: no token → `<Login>`.
- `pages/Login.tsx` — form; error display; Indonesian copy.
- `pages/Lessons.tsx` — badges (own/private/public/processing); "＋ Buat Lesson".
- `pages/CreateLesson.tsx` — title/level/text/public toggle → create → navigate to
  list; poll lesson status (reuse list refetch) until `ready`.
- `pages/LessonPlayer.tsx` — if `audio_status != ready` show processing notice +
  poll; audio uses the `audio_url` (now the protected endpoint — the browser will
  send the token? No: `<audio src>` can't carry the Authorization header).

### ⚠️ Audio auth detail (important)
`<audio src=…>` / `expo-av` cannot attach an `Authorization` header. Options
(decide in review):
- **(A)** Segment-audio endpoint also accepts a **short-lived signed query token**
  (`?t=<hmac>`) that the detail response embeds in `audio_url`; view verifies HMAC
  (owner+expiry) instead of the header. Works for `<audio>` and `expo-av`. **←
  recommended.**
- (B) Fetch bytes via `fetch()` with header → `blob:` URL (web only; breaks RN
  parity and streaming).
Plan adopts **(A)**: `audio_url` = `/api/english/segments/{id}/audio/?t=<sig>`;
`SegmentAudioView` accepts either a valid session token OR a valid signed `t`.

## Testing

- **Backend** (`backend/english/tests.py`, Django TestCase — this app has none yet):
  - auth required (401 logged-out);
  - visibility matrix (own / other-private / public-ready / public-processing /
    admin-published) for list + detail;
  - create → PENDING + N segments + owner set + validation errors;
  - patch/delete owner-only (404 for non-owner);
  - segment-audio permission (owner ok, non-owner 404) + signed-`t` accept/reject +
    X-Accel header when enabled;
  - worker: monkeypatch MeloTTS synth → asserts status transitions + audio saved.
- **Frontend**: `english-web` has no test runner; gate on `tsc --noEmit` + `vite
  build` (as today). Manual QA checklist in tasks.
- **RN**: extend an existing `usecase-*` only if english is already covered; else
  no new RN test (english RN screens unchanged beyond auth already handled).

## Deploy sequence (single release, per "sekalian semua")

1. Merge to master (tests green) + push.
2. Server: `git pull`; `uv sync --group production --group stt` (backend 3.14).
3. Create `.venv-melo` (3.12) + install MeloTTS; `python -m unidic download`.
4. `set -a; . ./.env; set +a; .venv/bin/python manage.py migrate english`.
5. Install `english-tts.service` (systemd) + start; verify worker idle-polls.
6. Update nginx english site (internal + deny locations); `nginx -t` + reload.
7. Set `ENGLISH_USE_X_ACCEL=1` in `.env`; restart `hayyabaca.service`.
8. Build + rsync `english-web` (now with login/create).
9. Smoke test: 401 logged-out, login, create → processing → ready → play; public
   toggle visible to 2nd account; private audio not directly fetchable.
