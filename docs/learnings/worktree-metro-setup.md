# Worktree + Metro Bundler: Required Setup

## Problem

Git worktrees untuk React Native / Expo **tidak bisa langsung jalan** dengan Metro bundler.
Metro tidak follow symlinks dan tidak resolve `node_modules` via Node.js walk-up dari worktree path.
APK yang di-build dari worktree juga bake worktree path sebagai project root — jadi meski Metro jalan dari main repo, app tetap error.

## Root Cause

1. Metro mencari `./node_modules/expo-router/entry` relatif dari project root
2. Worktree tidak punya `node_modules/` sendiri
3. Symlink `node_modules -> ../main/node_modules` tidak diikuti Metro meski `unstable_enableSymlinks = true`
4. APK dev client menyimpan project root path — jadi worktree path baked-in

## Solution: Independent node_modules per Worktree

Setelah `git worktree add <path> <branch>`:

```bash
cd <worktree-path>
npm ci --legacy-peer-deps    # install full node_modules sendiri
```

Untuk multi-worktree simultan (Metro di port berbeda):

```bash
# Di metro.config.js worktree:
config.server = { port: 8082 };  # default 8081, ganti per worktree
```

## Checklist setiap bikin worktree baru

1. `npm ci --legacy-peer-deps` di worktree root
2. `cd backend && uv sync` untuk backend venv
3. Kalau run bareng main repo: set Metro port berbeda di `metro.config.js`
4. Jangan run `test-local.sh` dari worktree yang belum punya `node_modules`
5. Kalau error "Unable to resolve module" — pastikan `node_modules/` ada (bukan symlink)

## Alternatif: Merge ke main repo dulu

Kalau hanya perlu test sekali, merge branch ke main repo dan run `test-local.sh` dari sana.
Ini lebih simple tapi tidak support parallel development.

## Learned: 2026-04-12

Ditemukan saat develop search feature (#003) di worktree `.claude/worktrees/search-feature/`.
Symlink, `unstable_enableSymlinks`, dan build ulang semuanya gagal — hanya `npm ci` penuh yang works.
