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
2. **Dari claude.ai ke server MCP** — dua cara:
   - **Secret-URL** *(dipakai untuk claude.ai — kolom "Request headers" belum
     tersedia di sana)*: server jalan authless, tapi secret ditaruh di **path**
     (`MCP_PATH=/mcp/<hex-panjang>`). Hanya path itu yang dilayani; path lain
     → 404. URL lengkapnya jadi kredensial — rahasiakan.
   - **Header bearer** *(klien yang bisa kirim header)*: set `MCP_BEARER_TOKEN`;
     request tanpa `Authorization: Bearer <token>` ditolak 401 (StaticTokenVerifier).

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

## Deploy ke claude.ai (Secret-URL)

1. **Generate secret** (di server, sekali):
   ```bash
   python -c "import secrets; print(secrets.token_hex(24))"
   ```
2. **`.env`** di server (`tools/english-mcp/.env`, gitignored):
   ```
   ENGLISH_API_BASE=https://english.ihfazh.com   # lewat nginx (loopback)
   ENGLISH_API_TOKEN=<DRF token akun layanan>
   MCP_PATH=/mcp/<secret dari langkah 1>
   MCP_HOST=127.0.0.1
   MCP_PORT=8130
   # MCP_BEARER_TOKEN dikosongkan (auth = secret path)
   ```
3. **systemd** `english-mcp.service` — jalankan `uv run python server.py` dari
   `WorkingDirectory=.../tools/english-mcp`, `EnvironmentFile=.../.env`, bind
   `127.0.0.1:8130`.
4. **nginx** di site `english.ihfazh.com` (TLS certbot yang sudah ada) —
   proxy path secret ke server MCP, **buffering off** (streaming):
   ```nginx
   location /mcp/ {
       proxy_pass http://127.0.0.1:8130;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_buffering off;
       proxy_read_timeout 3600s;
   }
   ```
5. **claude.ai** → Connectors → **Add custom connector** → URL:
   `https://english.ihfazh.com/mcp/<secret>` ; field OAuth dikosongkan.

> Kalau claude.ai menolak connect authless, fallback ke **GitHub OAuth**
> (`fastmcp.server.auth.providers.github.GitHubProvider`) — tools tetap sama,
> hanya `auth=` di `server.py` yang diganti + daftar OAuth app + allowlist akun.
