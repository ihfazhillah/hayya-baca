# Spec 070 — Lesson "Baca Bersama" redesign + per-lesson progress

Redesign of the lesson player (LessonPlayer.tsx). Aligned via interactive mockup.

## What changes
- **Read-along transcript**: the WHOLE lesson text is shown as a list of sentences;
  tap any sentence to make it the active practice card (free navigation, not just
  prev/next). Full context, addresses "kepotong" feel.
- **One combined flow** per sentence: ▶️ Dengar (custom player + approx karaoke +
  speed 0.8×/1×) → 🎤 Tiru & Nilai (record → score → Salis panel). ✍️ Dikte is a
  small secondary toggle (blurs text + textarea).
- **Per-word pronunciation**: tap a word in the active sentence → popover with IPA
  + ▶️ TTS (speakAU) + 🔊 native audio + ➕ "Latih kata ini" (reuses Spec 069
  `/dict/` + `words/add`).
- **Progress**: bar + ✓ per practiced sentence.

## Progress persistence (per-account, server)
- Model `EnglishLessonProgress`: owner FK, lesson FK, `done_orders` (JSON list of
  segment orders practiced), `last_index` (int), updated_at. unique(owner, lesson).
- `GET /api/english/lessons/<id>/progress/` → `{done: [orders], last_index}`.
- `POST /api/english/lessons/<id>/progress/` → body `{last_index?, done_order?}`;
  upserts (adds done_order to the set, updates last_index). Owner-scoped, auth;
  404 if the lesson isn't visible to the caller.
- Frontend restores active index + done set on load; posts on select + on practice
  (fire-and-forget).

## Non-goals (v1)
- Karaoke exact word timing (approximate from audio duration ÷ word count).
- Continuous "play all" (could add later).
- RN app.

## Acceptance
- Open lesson → full transcript shown, resumes at last position with ✓ marks.
- Tap sentence → play (karaoke) + record → Salis + ✓ + progress; persists across
  refresh & devices.
- Tap a word → IPA + audio + add-to-word-practice.
