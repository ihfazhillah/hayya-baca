"""Jelajah (Spec 075 K4): Buat soal untuk Ayah dan Alat Bebas.

Buat soal untuk Ayah: anak menulis teks Si Ceroboh sendiri dan menandai kesalahannya; tokenizer
dan aturan "bisa diklik" sama dengan impor course. Orang tua mengerjakannya dengan klik yang
dinilai server per klik (`proses_klik`), kunci baru dibuka setelah selesai.

Alat Bebas: sorotan sistem untuk teks apa saja. Tidak dinilai, tidak disimpan.
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .. import jadwal, jejak
from ..impor import _bisa_diklik as bisa_diklik
from ..models import Alat, JawabanSoalBuatan, Misi, SoalBuatan, Stiker, Tingkat
from ..teks import tokenize
from .base import OrtuView, PenulisView
from .belajar import nama, profil_boleh_ortu, profil_ortu
from .misi import proses_klik

BATAS_TEKS = 600
BATAS_KESALAHAN = 8
BATAS_KENAPA = 200
BATAS_TEKS_BEBAS = 5000


# ---- Buat soal untuk Ayah: sisi anak -------------------------------------------------

def alat_celah(alat):
    """Alat yang misi kliknya memakai mode celah (Kaca Pembesar): anak juga boleh menandai
    tanda baca, spasi, dan celah. Diambil dari isi course, bukan kode alat."""
    return Misi.objects.filter(modul__alat=alat, jenis=Misi.Jenis.KLIK, data__celah=True).exists()


def alat_bisa_soal(profil):
    """Kode alat yang sudah boleh dipakai membuat soal: setelah stiker Perak alat itu
    (roadmap "Mengajarkan orang lain"). Profil simulasi: semua alat."""
    if profil.buka_semua:
        return set(Alat.objects.values_list("kode", flat=True))
    return set(Stiker.objects.filter(profil=profil, tingkat=Tingkat.PERAK)
               .values_list("alat__kode", flat=True))


def alat_ringkas(a):
    return {"kode": a.kode, "nama": a.nama, "emoji": a.emoji, "warna": a.warna}


def jawaban_json(j, total):
    return {"oleh": nama(j.user), "ditemukan": len(j.ditemukan), "total": total,
            "meleset": j.meleset, "selesai": j.selesai, "tanggal": j.diubah}


def soal_json_anak(s):
    total = len(s.data["kunci"])
    return {
        "id": s.id, "alat": alat_ringkas(s.alat), "teks": s.teks, "dibuat": s.dibuat,
        "tokens": s.data["tokens"], "kunci": s.data["kunci"], "celah": s.data["celah"],
        "jumlah": total, "kenapa": s.data["kenapa"],
        "jawaban": [jawaban_json(j, total) for j in s.jawaban.all()],
    }


def _bilangan(x):
    return isinstance(x, int) and not isinstance(x, bool)


def ubah_soal(teks, kesalahan, celah):
    """Teks + tanda anak → data soal (token + kunci), dengan validasi yang sama dengan impor."""
    teks = (teks or "").strip()
    if not teks or not any(t.jenis == "kata" for t in tokenize(teks)):
        raise ValidationError("Tulis dulu teks Si Ceroboh-mu.")
    if len(teks) > BATAS_TEKS:
        raise ValidationError(f"Teksnya terlalu panjang. Paling banyak {BATAS_TEKS} huruf, ya.")
    tokens = tokenize(teks)
    if not isinstance(kesalahan, list):
        raise ValidationError("Tandai kesalahan yang kamu sembunyikan.")
    kunci, kenapa, sudah = [], [], set()
    for k in kesalahan:
        if not isinstance(k, dict):
            raise ValidationError("Tanda kesalahan tidak dikenal.")
        token, c = k.get("token"), k.get("celah")
        if (token is None) == (c is None):
            raise ValidationError("Setiap tanda berisi satu kata atau satu celah.")
        if token is not None:
            if not _bilangan(token) or not 0 <= token < len(tokens):
                raise ValidationError("Tanda kesalahan ada di luar teks.")
            target = {"token": [token], "celah": None}
        else:
            if not _bilangan(c) or not 0 <= c <= len(tokens):
                raise ValidationError("Tanda kesalahan ada di luar teks.")
            target = {"token": [], "celah": c}
        if not bisa_diklik(tokens, target, celah):
            raise ValidationError("Ada tanda yang tidak bisa diklik. Tandai kata, ya.")
        kunci_tanda = (token, c)
        if kunci_tanda in sudah:
            continue
        sudah.add(kunci_tanda)
        alasan = " ".join(str(k.get("kenapa") or "").split())
        if len(alasan) > BATAS_KENAPA:
            raise ValidationError("Alasannya terlalu panjang. Satu kalimat saja, ya.")
        kunci.append([target])
        kenapa.append(alasan)
    if not kunci:
        raise ValidationError("Tandai paling sedikit satu kesalahan.")
    if len(kunci) > BATAS_KESALAHAN:
        raise ValidationError(f"Paling banyak {BATAS_KESALAHAN} kesalahan, ya.")
    return teks, {"tokens": [t.json() for t in tokens], "kunci": kunci, "celah": celah,
                  "kenapa": kenapa}


class SoalBuatanView(PenulisView):
    def get(self, request):
        profil = request.profil
        boleh = alat_bisa_soal(profil)
        alat = [{**alat_ringkas(a), "terbuka": a.kode in boleh, "celah": alat_celah(a),
                 "syarat": f"Terbuka setelah stiker Perak {a.nama}."}
                for a in Alat.objects.all()]
        soal = SoalBuatan.objects.filter(profil=profil).select_related("alat").prefetch_related(
            "jawaban__user")
        return Response({"alat": alat, "soal": [soal_json_anak(s) for s in soal],
                         "batas": {"teks": BATAS_TEKS, "kesalahan": BATAS_KESALAHAN}})

    def post(self, request):
        alat = Alat.objects.filter(kode=request.data.get("alat")).first()
        if alat is None:
            raise ValidationError("Pilih alatnya dulu.")
        if alat.kode not in alat_bisa_soal(request.profil):
            raise PermissionDenied(f"Soal {alat.nama} terbuka setelah stiker Perak {alat.nama}.")
        teks, data = ubah_soal(request.data.get("teks"), request.data.get("kesalahan"),
                               alat_celah(alat))
        s = SoalBuatan.objects.create(profil=request.profil, alat=alat, teks=teks, data=data)
        return Response({**soal_json_anak(s),
                         "pesan": "Soalmu sudah disimpan. Minta Ayah atau Ummah mengerjakannya!"},
                        status=status.HTTP_201_CREATED)


class TokenSoalView(PenulisView):
    """Browser tidak memecah teks sendiri: token untuk ditandai berasal dari tokenizer server."""

    def post(self, request):
        teks = str(request.data.get("teks") or "").strip()
        if len(teks) > BATAS_TEKS:
            raise ValidationError(f"Teksnya terlalu panjang. Paling banyak {BATAS_TEKS} huruf, ya.")
        return Response({"teks": teks, "tokens": [t.json() for t in tokenize(teks)]})


class SoalBuatanItemView(PenulisView):
    def delete(self, request, pk):
        get_object_or_404(SoalBuatan, pk=pk, profil=request.profil).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- Buat soal untuk Ayah: Pojok Orang Tua ---------------------------------------------

def punyaku_json(j, s):
    if j is None:
        return None
    return {"diklik": j.diklik, "celah": j.celah, "ditemukan": len(j.ditemukan),
            "total": len(s.data["kunci"]), "meleset": j.meleset, "selesai": j.selesai}


def kunci_terbuka(s):
    return {"kunci": s.data["kunci"], "kenapa": s.data["kenapa"], "teks": s.teks}


def soal_ortu(request, pk):
    """Soal anak yang diperiksa atau simulasi milik orang tua ini; keluarga lain 404."""
    return get_object_or_404(
        SoalBuatan.objects.filter(profil_boleh_ortu(request.user)).select_related("alat", "profil"),
        pk=pk)


class SoalBuatanOrtuListView(OrtuView):
    def get(self, request):
        profil = profil_ortu(self, request)
        out = []
        for s in SoalBuatan.objects.filter(profil=profil).select_related("alat"):
            j = s.jawaban.filter(user=request.user).first()
            out.append({"id": s.id, "alat": alat_ringkas(s.alat), "dibuat": s.dibuat,
                        "jumlah": len(s.data["kunci"]), "punyaku": punyaku_json(j, s)})
        return Response({"penulis": profil.nama_panggilan, "soal": out})


class SoalBuatanOrtuView(OrtuView):
    def get(self, request, pk):
        s = soal_ortu(request, pk)
        j = s.jawaban.filter(user=request.user).first()
        out = {"id": s.id, "alat": alat_ringkas(s.alat), "penulis": s.profil.nama_panggilan,
               "dibuat": s.dibuat, "tokens": s.data["tokens"], "celah": s.data["celah"],
               "jumlah": len(s.data["kunci"]), "punyaku": punyaku_json(j, s)}
        if j and j.selesai:
            out.update(kunci_terbuka(s))
        return Response(out)


def jawaban_aktif(s, user):
    """Dikunci sampai transaksi selesai (dua klik bersamaan tidak saling menimpa)."""
    j = JawabanSoalBuatan.objects.select_for_update().filter(soal=s, user=user).first()
    j = j or JawabanSoalBuatan.objects.create(soal=s, user=user)
    if j.selesai:
        raise ValidationError("Soal ini sudah selesai kamu kerjakan.")
    return j


class KlikSoalBuatanView(OrtuView):
    @transaction.atomic
    def post(self, request, pk):
        s = soal_ortu(request, pk)
        j = jawaban_aktif(s, request.user)
        out = proses_klik(j, s.data, request)
        out.pop("boleh_petunjuk", None)
        if j.selesai:
            out.update(selesai=True, **kunci_terbuka(s))
        return Response(out)


class BerhentiSoalBuatanView(OrtuView):
    @transaction.atomic
    def post(self, request, pk):
        s = soal_ortu(request, pk)
        j = jawaban_aktif(s, request.user)
        j.selesai = True
        j.save()
        return Response({"selesai": True, "ditemukan": len(j.ditemukan),
                         "total": len(s.data["kunci"]), **kunci_terbuka(s)})


def jumlah_soal_belum_dikerjakan(profil, user):
    selesai = JawabanSoalBuatan.objects.filter(user=user, selesai=True).values("soal_id")
    return SoalBuatan.objects.filter(profil=profil).exclude(id__in=selesai).count()


# ---- Alat Bebas ---------------------------------------------------------------------

class SorotanBebasView(PenulisView):
    """Tanda sistem (kata kembar, kalimat panjang) untuk teks tempelan, hanya untuk alat yang
    sudah dipelajari (Perunggu). Tanpa nama tokoh: teks ini bukan naskah."""

    def post(self, request):
        teks = str(request.data.get("teks") or "")
        if len(teks) > BATAS_TEKS_BEBAS:
            raise ValidationError("Teksnya terlalu panjang. Coba satu atau dua paragraf saja.")
        alat = request.data.get("alat") or []
        if not isinstance(alat, list):
            raise ValidationError("Kirim daftar alat.")
        profil = request.profil
        if profil.buka_semua:
            boleh = set(Alat.objects.values_list("kode", flat=True))
        else:
            boleh = set(jadwal.alat_dipelajari(profil).values_list("kode", flat=True))
        return Response(jejak.sorotan_sistem(teks, [a for a in alat if a in boleh]))
