# Tasks 064 — English auth + visibility + user-created lessons

Test-first where a test can express the behavior (per repo rule). One logical
change per commit; `feat(english): …` / `test(english): …`.

## A. Backend data model + visibility
- [ ] A1. `test(english)`: add `backend/english/tests.py` — 401 when logged out;
  visibility matrix (own / other-private / public-ready / public-processing /
  admin-published) for list + detail (404 for hidden). **Write failing first.**
- [ ] A2. Model: `owner`, `is_public`, `audio_status`, `error`; slug uniqueness for
  owned lessons. Migration `0002`.
- [ ] A3. `visible_to(user)` helper + viewset `IsAuthenticated` + `get_queryset`.
- [ ] A4. Serializers: `is_owner`/`is_public`/`audio_status` on list & detail.
- [ ] A5. Run A1 → green.

## B. Create / patch / delete
- [ ] B1. `test(english)`: create → PENDING + N segments + owner set; text
  validation (empty / too long) → 400; patch/delete owner-only (404 non-owner).
- [ ] B2. Sentence-split helper (port from pipeline `split_sentences`).
- [ ] B3. Viewset → create/patch/destroy + `IsOwnerOrReadOnly`; `perform_create`.
- [ ] B4. Run B1 → green.

## C. Protected audio
- [ ] C1. `test(english)`: segment-audio permission (owner 200 / non-owner 404);
  signed-`t` accept + reject (bad/expired); X-Accel header present when
  `ENGLISH_USE_X_ACCEL=1`; `FileResponse` fallback when off.
- [ ] C2. `SegmentAudioView` (session-token OR signed `t`) + HMAC sign/verify util;
  serializer `audio_url` → signed protected URL; `ENGLISH_USE_X_ACCEL` setting;
  flip `transcribe/` to `IsAuthenticated`.
- [ ] C3. Run C1 → green.

## D. MeloTTS worker (3.12)
- [ ] D1. `test(english)`: worker single-pass with MeloTTS synth monkeypatched —
  PENDING→READY, audio saved per segment; exception → FAILED + error; resumable
  (missing-audio only).
- [ ] D2. `generate_pending_audio` management command (`--loop`), lazy guarded
  MeloTTS import, EN-AU speaker pick, wav→mp3.
- [ ] D3. `deploy/english-tts.service` (systemd unit, `.venv-melo`, EnvironmentFile).
- [ ] D4. Run D1 → green.

## E. Frontend english-web (auth + create)
- [ ] E1. `AuthContext` + `localStorage` token; `api.ts` attach header + 401→logout;
  `createLesson`/`patchLesson`/`deleteLesson`.
- [ ] E2. `Login.tsx`; route guard in `App.tsx`/`main.tsx`; logout button.
- [ ] E3. `Lessons.tsx` badges + processing state + "Buat Lesson" entry.
- [ ] E4. `CreateLesson.tsx` (title/level/text/public) + post + poll to ready.
- [ ] E5. `LessonPlayer.tsx` processing notice + poll; audio via signed URL.
- [ ] E6. `tsc --noEmit` + `vite build` green.

## F. Integration / deploy
- [ ] F1. nginx: internal `/protected-english-media/` + `deny /media/english/`
  (update `deploy/english.nginx.conf` + server site).
- [ ] F2. Server: `.venv-melo` (3.12) + MeloTTS install + `unidic download`.
- [ ] F3. migrate english; install+start `english-tts.service`; set
  `ENGLISH_USE_X_ACCEL=1`; restart hayyabaca; reload nginx.
- [ ] F4. Build+rsync english-web.
- [ ] F5. Smoke test full acceptance list (spec §Acceptance).

## Manual QA checklist (frontend, no runner)
- [ ] Logged-out → login page; wrong creds → error.
- [ ] Login persists across reload; logout clears.
- [ ] Own list shows private + processing; public toggle → visible to 2nd account.
- [ ] Create → processing → auto-becomes playable (poll).
- [ ] Private audio URL not fetchable without token/signature.
- [ ] Listen / dictation / shadowing still work authenticated.
