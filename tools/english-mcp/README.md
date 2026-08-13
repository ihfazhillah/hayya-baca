# english-mcp

MCP server yang mengekspos modul English Hayya Baca ke Claude. Thin-client HTTP
ke REST API yang sudah ada (`/api/english/...`) — **tidak** menyentuh Django /
gunicorn / worker MeloTTS.

## Tools

| Tool | Fungsi |
|---|---|
| `add_lesson(title, text, level?, is_public?)` | Buat lesson custom. Audio EN-AU digenerate async di server. |
| `list_lessons()` | Daftar lesson + progres audio (`processing 9/20`, `ready`, …). |
| `get_lesson_status(lesson_id)` | Status satu lesson + progres segmen (x/y). |

## Auth (dua lapis)

1. **Ke Django** — satu **DRF token** akun layanan (`ENGLISH_API_TOKEN`). Semua
   lesson dibuat atas nama akun itu.
2. **Dari claude.ai ke server MCP** — static bearer (`MCP_BEARER_TOKEN`). Kalau
   di-set, request tanpa `Authorization: Bearer <token>` ditolak 401.

## Setup

```bash
cd tools/english-mcp
uv sync
cp .env.example .env   # isi ENGLISH_API_TOKEN (dan MCP_BEARER_TOKEN untuk prod)
```

Buat DRF token akun layanan (di backend):

```bash
cd backend && . ./.env    # prod: wajib source .env dulu (Postgres)
.venv/bin/python manage.py drf_create_token <username>
```

## Menjalankan

```bash
# HTTP (untuk claude.ai / remote) — default 127.0.0.1:8130/mcp
set -a; . ./.env; set +a
uv run python server.py

# stdio (untuk Claude Desktop / Code lokal)
uv run python server.py --stdio
```

## Test

```bash
ENGLISH_API_TOKEN=dummy uv run pytest -q
```

Hermetik (backend difake dengan `httpx.MockTransport`), tak butuh backend hidup.

## Deploy ke claude.ai (ringkasan)

1. Jalankan server sebagai systemd service di host `ksatriamuslim`, bind lokal
   (mis. `127.0.0.1:8130`), env dari `.env`.
2. nginx: `location /mcp { proxy_pass http://127.0.0.1:8130; }` di site
   `english.ihfazh.com` (TLS certbot yang sudah ada). Perlu proxy header +
   dukung streaming (buffering off).
3. claude.ai → Settings → Connectors → **Add custom connector** → URL
   `https://english.ihfazh.com/mcp`. Advanced → **Request headers**:
   `Authorization: Bearer <MCP_BEARER_TOKEN>`.
   > Kolom Request headers masih **beta** di claude.ai; kalau belum ada di
   > akunmu, alternatifnya OAuth 2.1 (belum diimplementasikan di sini).

Detail langkah deploy diisi saat Fase 3.
