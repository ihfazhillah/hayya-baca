"""Nama tokoh yang tidak dihitung sebagai kata kembar (Jejak dan sorotan sistem Lapis 3).

Nama otomatis = kata berhuruf besar di Kotak Siapa (Peta 4 Kotak), selain kata umum.
Teks cerita tidak pernah dipakai untuk menebak nama. Anak boleh menambah nama sendiri
(`Naskah.tokoh_tambah`) atau mengabaikan nama otomatis (`Naskah.tokoh_abaikan`).
Nama efektif = (otomatis ∪ tambah) − abaikan, per kata, huruf kecil.
"""
from rest_framework.exceptions import ValidationError

from .kata_umum import KATA_UMUM
from .teks import tokenize

PANJANG_NAMA = 60
MAKS_TAMBAH = 20


def _kata(teks):
    return [t.teks for t in tokenize(teks or "") if t.jenis == "kata"]


def _kecil(teks):
    return {k.lower() for k in _kata(teks)}


def otomatis(peta):
    siapa = peta.get("siapa") if isinstance(peta, dict) else None
    if not isinstance(siapa, str):
        return []
    out, ada = [], set()
    for k in _kata(siapa):
        if k[0].isupper() and k.lower() not in KATA_UMUM and k.lower() not in ada:
            out.append(k)
            ada.add(k.lower())
    return out


def kata(naskah):
    """Kata nama tokoh efektif (huruf kecil) untuk jejak.hitung / sorotan_sistem."""
    semua = {k.lower() for k in otomatis(naskah.peta)}
    for nama in naskah.tokoh_tambah:
        semua |= _kecil(nama)
    return semua - set(naskah.tokoh_abaikan)


def nama(naskah):
    """Nama yang ditampilkan sebagai chip: otomatis yang tidak diabaikan, lalu tambahan anak."""
    abaikan = set(naskah.tokoh_abaikan)
    out = [k for k in otomatis(naskah.peta) if k.lower() not in abaikan]
    ada = {k.lower() for k in out}
    for n in naskah.tokoh_tambah:
        kecil = _kecil(n)
        if n.lower() not in ada and not kecil <= abaikan:
            out.append(n)
            ada.add(n.lower())
    return out


def tokoh_json(naskah):
    return {"nama": nama(naskah), "otomatis": otomatis(naskah.peta),
            "tambah": list(naskah.tokoh_tambah), "abaikan": list(naskah.tokoh_abaikan),
            "kata": sorted(kata(naskah))}


def tambah(naskah, teks):
    teks = " ".join(str(teks or "").split())[:PANJANG_NAMA]
    kecil = _kecil(teks)
    if not kecil:
        raise ValidationError("Tulis nama tokohnya dulu.")
    naskah.tokoh_abaikan = [k for k in naskah.tokoh_abaikan if k not in kecil]
    if kecil <= {k.lower() for k in otomatis(naskah.peta)}:
        return  # sudah ada dari Kotak Siapa
    if teks.lower() in {n.lower() for n in naskah.tokoh_tambah}:
        return
    if len(naskah.tokoh_tambah) >= MAKS_TAMBAH:
        raise ValidationError(f"Paling banyak {MAKS_TAMBAH} nama tambahan.")
    naskah.tokoh_tambah = [*naskah.tokoh_tambah, teks]


def hapus(naskah, teks):
    teks = " ".join(str(teks or "").split())
    if not teks:
        raise ValidationError("Pilih nama yang mau dihapus.")
    naskah.tokoh_tambah = [n for n in naskah.tokoh_tambah if n.lower() != teks.lower()]
    auto = {k.lower() for k in otomatis(naskah.peta)}
    baru = sorted((_kecil(teks) & auto) - set(naskah.tokoh_abaikan))
    naskah.tokoh_abaikan = [*naskah.tokoh_abaikan, *baru]
