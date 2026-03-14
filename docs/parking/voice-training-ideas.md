# Voice Training & Speech Improvement Ideas (parking)

Parked 2026-03-14, needs significant research before implementation.

## Goals

1. **Simpan suara anak** — untuk training voice model, ganti suara robot Google
2. **Improve speech recognition** — lebih akurat untuk suara anak
3. **Deteksi konteks** — bedakan anak sedang baca vs ngobrol
4. **Noise filtering** — identifikasi suara yang sedang baca vs background noise

## Open Questions

- Bagaimana cara track & kirim audio dari app ke server?
- Format apa yang berguna? Per huruf, per kata, per kalimat, per halaman?
- Seberapa besar data yang dibutuhkan untuk training yang berguna?
- Post-processing workflow di sisi server — tools apa, pipeline bagaimana?
- Storage & bandwidth cost untuk audio files

## Why

Suara TTS robot kurang engaging untuk anak, speech recognition kurang akurat untuk suara anak kecil.
