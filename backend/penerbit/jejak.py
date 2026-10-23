"""Jejak Keterampilan dan sorotan otomatis (Rancangan Situs §Jejak, §Stabilo per alat)."""
import re
from collections import Counter

from .kata_umum import KATA_UMUM
from .teks import kalimat, tokenize

KATA_PERASAAN = {"sedih", "senang", "kesal", "takut", "malu", "marah", "bahagia", "kecewa"}
TANDA_AKHIR = {".", ",", "!", "?"}
# "dirumah", "kesekolah": di/ke yang menempel pada nama tempat umum.
_DI_KE_TEMPAT = re.compile(
    r"^(di|ke)(rumah|sekolah|pasar|masjid|kebun|dapur|kamar|taman|jalan|luar|dalam|atas|"
    r"bawah|sana|sini|mana|kelas|toko|warung|halaman|depan|belakang|samping)$"
)
BATAS_KALIMAT_PANJANG = 20
BATAS_KATA_KEMBAR = 3
# Analisis otomatis → alat yang sorotannya dipakai (kode Alat musim 1).
ALAT_KEMBAR = "kembar"
ALAT_KALIMAT_PANJANG = "gunting"


def _kata_kalimat(tokens):
    return [[t for t in tokens[a:b + 1] if t.jenis == "kata"] for a, b in kalimat(tokens)]


def _hitung_kembar(tokens, tokoh=()):
    """Hitung kata selain kata umum dan nama tokoh (`tokoh` = kata huruf kecil)."""
    lewati = KATA_UMUM | set(tokoh)
    return Counter(
        t.teks.lower() for t in tokens if t.jenis == "kata" and t.teks.lower() not in lewati
    )


def _kesalahan_ejaan(tokens):
    n = 0
    for a, _ in kalimat(tokens):
        t = tokens[a]
        if t.jenis == "kata" and t.teks[0].isalpha() and t.teks[0].islower():
            n += 1
    for i, t in enumerate(tokens):
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if t.jenis == "spasi" and nxt and nxt.jenis == "tanda" and nxt.teks in TANDA_AKHIR:
            n += 1
        if t.jenis == "tanda" and t.teks in TANDA_AKHIR and nxt and nxt.jenis == "kata":
            n += 1
        if t.jenis == "kata" and _DI_KE_TEMPAT.match(t.teks.lower()):
            n += 1
    return n


def hitung(teks, tokoh=()):
    tokens = tokenize(teks or "")
    per_kalimat = _kata_kalimat(tokens)
    kembar = _hitung_kembar(tokens, tokoh).most_common(1)
    return {
        "jumlah_kata": sum(1 for t in tokens if t.jenis == "kata"),
        "kalimat_terpanjang": max((len(k) for k in per_kalimat), default=0),
        "kata_kembar": kembar[0][0] if kembar else "",
        "kata_kembar_jumlah": kembar[0][1] if kembar else 0,
        "kalimat_perasaan": sum(
            1 for k in per_kalimat if any(t.teks.lower() in KATA_PERASAAN for t in k)
        ),
        "kesalahan_ejaan": _kesalahan_ejaan(tokens),
    }


def sorotan_sistem(teks, alat, tokoh=()):
    """Sorotan otomatis untuk alat yang diminta. Posisi = indeks karakter di teks."""
    tokens = tokenize(teks or "")
    out = []
    if ALAT_KEMBAR in alat:
        kembar = {k for k, n in _hitung_kembar(tokens, tokoh).items() if n > BATAS_KATA_KEMBAR}
        for t in tokens:
            if t.jenis == "kata" and t.teks.lower() in kembar:
                out.append({"alat": ALAT_KEMBAR, "index": t.awal, "length": t.akhir - t.awal,
                            "sumber": "sistem", "diperbaiki": False})
    if ALAT_KALIMAT_PANJANG in alat:
        for a, b in kalimat(tokens):
            if sum(1 for t in tokens[a:b + 1] if t.jenis == "kata") > BATAS_KALIMAT_PANJANG:
                out.append({"alat": ALAT_KALIMAT_PANJANG, "index": tokens[a].awal,
                            "length": tokens[b].akhir - tokens[a].awal,
                            "sumber": "sistem", "diperbaiki": False})
    return sorted(out, key=lambda s: s["index"])
