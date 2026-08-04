# Spec 068 — English daily streak (harian)

## Problem

Motivate daily English practice with a simple **daily streak** on english-web.
The existing `streaks` app is `Child`-based (reading, RN offline sync, grace,
badges) and doesn't fit english-web's **guardian User** model — so this is a new,
lightweight, User-based streak inside the `english` app.

## Decisions (locked)

- **New model, per `User` (owner)** — independent of the Child reading streak.
- A day counts when the learner **completes ≥1 scored attempt** that day
  (shadowing / dictation / custom / drill) — real practice, not just opening.

## Functional requirements

- **FR1** `POST /api/english/streak/ping/` (auth) records practice for **today**
  (server local date) and returns the streak:
  - already practiced today → unchanged;
  - last practice was **yesterday** → `current_streak += 1`;
  - otherwise (gap > 1 day, or first ever) → `current_streak = 1`;
  - `longest_streak = max(longest, current)`.
- **FR2** `GET /api/english/streak/` (auth) → `{current_streak, longest_streak,
  last_practice_date, practiced_today}` for the caller.
- **FR3** Frontend fires the ping **once per day** (localStorage-guarded) whenever
  an attempt is scored; a header badge shows `🔥 N` (hidden when 0).
- **FR4** Owner-scoped & auth-gated; never leaks another user's streak.

## Non-goals (v1)

- Grace period / streak freeze (miss a day → resets to 1 next practice).
- Badges/milestones (could come later).
- Per-timezone correctness beyond server local date (documented caveat).
- RN app (english-web only; RN has its own Child streak).

## Edge cases

- Multiple attempts same day → only the first ping changes state (idempotent by
  date); client also self-limits to one ping/day.
- Missed a day → next ping resets `current_streak` to 1 (longest preserved).
- First ever ping → streak 1.
- Offline / ping fails → ignored (fire-and-forget); streak updates next success.

## Acceptance

- Fresh account: first scored attempt → `🔥 1`.
- Practice on consecutive days → increments; skip a day → resets to 1.
- `longest_streak` retains the best run.
- Logged-out → 401; a second account never sees the first's streak.
- Backend state machine unit-tested.
