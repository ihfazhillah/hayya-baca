# Event Queue vs Improved Trigger-Based — Analisis

## Konsep Event Queue
Setiap mutation = event di-park ke queue lokal. Worker proses periodic.

## Plus Event Queue
1. Decoupled — mutation tidak perlu tahu sync
2. Batchable — akumulasi event, push batch per cycle
3. Predictable — FIFO queue, no race condition
4. Retry-safe — fail event tetap di-queue

## Minus Event Queue
1. Kompleksitas tinggi — butuh schema, worker, dedupe
2. Over-engineering — app ini sederhana
3. Extra table SQLite — migration, memory
4. Ordering antar tipe event — FIFO tidak guarantee urutan reward vs progress
5. Duplikasi — `synced=0` rows = implicit queue sudah ada

## Alternatif: Improved Trigger-Based
1. Foreground flush ALL — `syncAll()` tanpa arg
2. Periodic timer 5 menit — `setInterval`
3. Hapus manual buttons — parent, home badge
4. Bulk streak push — backend endpoint baru

## Perbandingan

Kompleksitas: Event Queue TINGGI vs Trigger Rendah
Code surface: Event Queue BESAR vs Trigger Kecil (1-2 line)
Maintainability: Event Queue Butuh dokumentasi vs Trigger Sudah ada
Testing: Event Queue Perlu mock queue vs Trigger Test syncAll sudah ada
Performance: Sama (SQLite ke HTTP)
Offline safe: Event Queue Ya vs Trigger Sudah ada synced=0

## Rekomendasi Sementara
Improved Trigger-Based cukup. Event Queue over-engineering untuk scope ini.

Tunggu feedback Andrew dan Bilal sebelum final decision.
