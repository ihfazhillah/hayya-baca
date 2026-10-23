"""Mesin poin, stiker, dan pangkat (plan 074 keputusan 4 dan 5).

`evaluasi(profil)` dipanggil setelah setiap hasil baru. Semuanya idempoten:
Stiker unik per (profil, alat, tingkat) dan Poin unik per kunci_sumber, sehingga
evaluasi berulang tidak menggandakan apa pun.

Syarat stiker dibaca dari `Alat.syarat` (data), bukan dari kode per alat.
"""
from django.db import IntegrityError, transaction
from django.db.models import Sum

from .models import (
    Alat, HasilLatihan, HasilMisi, Jejak, Misi, Musim, Naskah, Pangkat, Poin, Stiker, Tingkat,
)

POIN_MISI = 1
POIN_STIKER = {Tingkat.PERUNGGU: 5, Tingkat.PERAK: 15, Tingkat.EMAS: 30}
POIN_JEJAK_MEMBAIK = 10
POIN_TERBIT = 50
JEJAK_MEMBAIK_MIN = 2
URUTAN_TINGKAT = [Tingkat.PERUNGGU, Tingkat.PERAK, Tingkat.EMAS]
JENIS_TEKS_BARU = [Misi.Jenis.KLIK, Misi.Jenis.GUNTING, Misi.Jenis.KEMBAR]


def total_poin(profil):
    return Poin.objects.filter(profil=profil).aggregate(s=Sum("jumlah"))["s"] or 0


def tambah_poin(profil, jumlah, alasan, kunci, oleh=None):
    """Tambah satu baris poin bila kunci belum pernah dipakai. True bila bertambah."""
    if Poin.objects.filter(profil=profil, kunci_sumber=kunci).exists():
        return False
    try:
        with transaction.atomic():
            Poin.objects.create(profil=profil, jumlah=jumlah, alasan=alasan,
                                kunci_sumber=kunci, diberikan_oleh=oleh)
    except IntegrityError:
        return False
    return True


# ---- syarat stiker -------------------------------------------------------

def _hasil_teks_baru(profil, alat):
    """(tanggal, rasio, pakai_petunjuk) percobaan PERTAMA di setiap teks baru alat ini."""
    hasil = []
    pertama = {}
    for h in HasilMisi.objects.filter(
        profil=profil, misi__modul__alat=alat, misi__tahap=Misi.Tahap.MANDIRI,
        misi__jenis__in=JENIS_TEKS_BARU, status=HasilMisi.Status.SELESAI,
    ).order_by("tanggal", "id"):
        pertama.setdefault(("misi", h.misi_id), h)
    for h in HasilLatihan.objects.filter(profil=profil, alat=alat).order_by("tanggal", "id"):
        pertama.setdefault(("latihan", h.kalimat_id), h)
    for h in pertama.values():
        rasio = h.benar / h.total if h.total else 0
        hasil.append((h.tanggal, h.id, rasio, getattr(h, "pakai_petunjuk", False)))
    hasil.sort(key=lambda x: (x[0], x[1]))
    return hasil


def _beruntun(nilai_lulus):
    """Panjang deret True di ujung daftar."""
    n = 0
    for lulus in reversed(nilai_lulus):
        if not lulus:
            break
        n += 1
    return n


def _jejak_draf_nol(profil):
    return list(
        Jejak.objects.filter(versi__naskah__profil=profil, versi__nomor=1)
        .order_by("versi__tanggal", "versi__id")
    )


def _angka_jejak(jejak, angka):
    if angka == "ejaan_per_100":
        return jejak.ejaan * 100 / jejak.jumlah_kata if jejak.jumlah_kata else 0
    return getattr(jejak, angka)


def cek_syarat(profil, alat, syarat):
    """(terpenuhi, kemajuan {sekarang, target} | None)."""
    jenis = syarat.get("jenis")
    if jenis == "misi_tahap_selesai":
        misi = Misi.objects.filter(modul__alat=alat, modul__nomor=alat.modul_belajar,
                                   tahap__in=syarat["tahap"])
        selesai = set(HasilMisi.objects.filter(
            profil=profil, misi__in=misi, status=HasilMisi.Status.SELESAI
        ).values_list("misi_id", flat=True))
        target = misi.count()
        sekarang = len(selesai)
        return target > 0 and sekarang >= target, {"sekarang": sekarang, "target": target}
    if jenis == "skor_beruntun":
        lulus = [
            rasio >= syarat["min_rasio"] and not (syarat.get("tanpa_petunjuk") and petunjuk)
            for _, _, rasio, petunjuk in _hasil_teks_baru(profil, alat)
        ]
        n = _beruntun(lulus)
        return n >= syarat["kali"], {"sekarang": min(n, syarat["kali"]), "target": syarat["kali"]}
    if jenis == "jejak_maks":
        lulus = [_angka_jejak(j, syarat["angka"]) <= syarat["maks"] for j in _jejak_draf_nol(profil)]
        n = _beruntun(lulus)
        return n >= syarat["cerita"], {"sekarang": min(n, syarat["cerita"]),
                                       "target": syarat["cerita"]}
    return False, None  # "pemeriksa": hanya diberikan Ayah atau Ummah


def kemajuan(profil, alat, tingkat):
    return cek_syarat(profil, alat, alat.syarat.get(tingkat, {}))[1]


def beri_stiker(profil, alat, tingkat, oleh=None, catatan=""):
    """Buat stiker (+poin, +jadwal ulang untuk Perunggu). Kembalikan hadiah baru (bisa kosong)."""
    with transaction.atomic():
        stiker, dibuat = Stiker.objects.get_or_create(
            profil=profil, alat=alat, tingkat=tingkat,
            defaults={"diberikan_oleh": oleh, "catatan": catatan},
        )
    if not dibuat:
        return []
    baru = [{"jenis": "stiker", "alat": alat.kode, "tingkat": tingkat,
             "nama": alat.nama, "emoji": alat.emoji}]
    tambah_poin(profil, POIN_STIKER[tingkat],
                f"Stiker {Tingkat(tingkat).label} {alat.nama}", f"stiker:{alat.kode}:{tingkat}", oleh)
    if tingkat == Tingkat.PERUNGGU:
        from .jadwal import mulai_jadwal

        mulai_jadwal(profil, alat)
    baru += _naikkan_pangkat(profil)
    return baru


# ---- pangkat -------------------------------------------------------------

def _pangkat_terpenuhi(profil, pangkat):
    s = pangkat.syarat
    if s.get("jenis") == "perunggu_semua":
        musim_pertama = Musim.objects.order_by("nomor").first()
        alat = Alat.objects.filter(musim=musim_pertama)
        punya = Stiker.objects.filter(profil=profil, alat__in=alat,
                                      tingkat=Tingkat.PERUNGGU).count()
        return alat.exists() and punya == alat.count()
    if s.get("jenis") == "buku_terbit":
        return Naskah.objects.filter(profil=profil, tahap=Naskah.Tahap.TERBIT).count() >= s["jumlah"]
    return False


def _naikkan_pangkat(profil):
    sekarang = profil.pangkat.urutan if profil.pangkat else 0
    tertinggi = None
    for p in Pangkat.objects.filter(urutan__gt=sekarang).order_by("urutan"):
        if _pangkat_terpenuhi(profil, p):
            tertinggi = p
    if tertinggi is None:
        return []
    profil.pangkat = tertinggi
    profil.save(update_fields=["pangkat"])
    return [{"jenis": "pangkat", "nama": tertinggi.nama}]


# ---- poin lain -----------------------------------------------------------

def _poin_misi(profil):
    baru = 0
    for misi_id, judul in HasilMisi.objects.filter(
        profil=profil, status=HasilMisi.Status.SELESAI
    ).values_list("misi_id", "misi__judul").distinct():
        if tambah_poin(profil, POIN_MISI, f"Misi selesai: {judul}", f"misi:{misi_id}"):
            baru += POIN_MISI
    return baru


def _poin_jejak(profil):
    angka = ["kalimat_terpanjang", "kata_kembar_jumlah", "kalimat_perasaan", "ejaan_per_100"]
    jejak = _jejak_draf_nol(profil)
    baru = 0
    for sebelum, sesudah in zip(jejak, jejak[1:]):
        membaik = sum(_angka_jejak(sesudah, a) < _angka_jejak(sebelum, a) for a in angka)
        if membaik >= JEJAK_MEMBAIK_MIN and tambah_poin(
            profil, POIN_JEJAK_MEMBAIK, "Draf Nol lebih bersih dari cerita sebelumnya",
            f"jejak:{sesudah.versi_id}",
        ):
            baru += POIN_JEJAK_MEMBAIK
    return baru


def _poin_terbit(profil):
    baru = 0
    for n in Naskah.objects.filter(profil=profil, tahap=Naskah.Tahap.TERBIT):
        if tambah_poin(profil, POIN_TERBIT, f"Buku terbit: {n.judul}", f"terbit:{n.id}"):
            baru += POIN_TERBIT
    return baru


def evaluasi(profil):
    """Hitung ulang semua hadiah otomatis. Kembalikan daftar hadiah yang baru didapat."""
    baru = []
    poin = _poin_misi(profil) + _poin_jejak(profil) + _poin_terbit(profil)
    for alat in Alat.objects.all():
        for tingkat in URUTAN_TINGKAT:
            if Stiker.objects.filter(profil=profil, alat=alat, tingkat=tingkat).exists():
                continue
            terpenuhi, _ = cek_syarat(profil, alat, alat.syarat.get(tingkat, {}))
            if terpenuhi:
                baru += beri_stiker(profil, alat, tingkat)
    baru += _naikkan_pangkat(profil)
    if poin:
        baru.insert(0, {"jenis": "poin", "jumlah": poin})
    return baru
