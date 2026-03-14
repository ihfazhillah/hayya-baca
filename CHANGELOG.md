# Changelog

## v1.0.6
- Replace React Query with event emitter for children data
- Fix sync push, keyboard overlap, add-child validation, safe area layout

## v1.0.4
- Fix child sync, add-child errors, keyboard overlap, landscape layout

## v1.0.3
- Fix game session datetime bug
- Add server sync and multi-device support (push-first, active child only, idempotency)

## v1.0.2
- Fix critical bugs across reading, quiz, game, and article screens
- Fix ArticleScreen hooks ordering crash

## v1.0.1
- Add e2e tests hitting actual backend
- Fix game and article screens to match actual backend API

## v1.0.0
- Add GameZone: game model, API, admin preview, Dino Jump POC
- Add game screen (HTML5 WebView, coin-per-session)
- Add reading timeline and coin audit trail
- Move add-child form from child select to parent dashboard
- Fetch articles from server with bundled fallback + SQLite cache
- Switch production to PostgreSQL, add auto-deploy CI/CD
- Add import_markdown_articles command for bulk markdown import

## v0.1.0-alpha.7
- Switch to app.config.ts, allow API base URL override
- Fix build script to read version from app.config.ts

## v0.1.0-alpha.6
- Add backend sync, API client, parent dashboard with PIN gate
- Add use-case tests and gate build on test pass
- Split Django settings into base/dev/production
- Add leaderboard, progress tracking on home, fix auto-update install
- Add DRF API endpoints, OpenAPI docs, API contract

## v0.1.0-alpha.5
- Initial MVP release
- Guided reading with speech recognition (word-by-word)
- Book library (20 buku) + article mode (10 artikel) with quiz
- Coin/star reward system, celebration screen
- Auto-update from GitHub releases
- Responsive tablet/HP layout, kid-friendly purple theme
