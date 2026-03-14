# Game Score Feature Ideas (parking)

Parked 2026-03-14, needs tight discussion before implementation.

## Ideas

1. **Per-child score history per game** — track score trend (naik/turun), at minimum keep last score
2. **Per-game leaderboard** — accumulated scores across children

## Why

Gamification and motivation for kids to improve and compete.

## Open Questions

- Data model changes (SQLite + backend)
- Navigation flow — screens already growing, need clear hierarchy
- Whether leaderboard is local-only or synced to backend
- UI/UX design for fitting more screens without overwhelming flow
- Discussion required before any code work
