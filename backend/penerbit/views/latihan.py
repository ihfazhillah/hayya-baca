"""Latihan Harian (Pemanasan Alat Lama)."""
from django.db import transaction
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .. import hadiah, jadwal, penilaian
from ..kata_umum import KATA_UMUM
from ..models import Alat, HasilLatihan, KalimatLatihan, Misi, Percobaan, Stiker, Tingkat
from .base import PenulisView
from .misi import proses_klik


def alat_ringkas(alat):
    return {"kode": alat.kode, "nama": alat.nama, "emoji": alat.emoji, "warna": alat.warna,
            "pertanyaan": alat.pertanyaan}


def percobaan_latihan(profil, kalimat):
    """Lihat percobaan_aktif: dikunci, panggil di dalam transaction.atomic."""
    p = Percobaan.objects.select_for_update().filter(
        profil=profil, kalimat=kalimat, selesai=False).order_by("id").last()
    return p or Percobaan.objects.create(profil=profil, kalimat=kalimat)


def ambil_kalimat(request, pk):
    """Hanya kalimat alat yang sudah dipelajari (punya Perunggu)."""
    return get_object_or_404(
        KalimatLatihan, pk=pk, alat__in=jadwal.alat_dipelajari(request.profil)
    )


def selesaikan(request, kalimat, p, benar, total):
    # Jadwal pemanasan hanya maju lewat kartu pemanasan hari ini (dari Latihan Harian atau, bila
    # kebetulan sama, dari Ruang Latihan). Teks lain di Ruang Latihan tidak memajukan jadwal.
    kartu_hari_ini = kalimat in jadwal.kartu_hari_ini(request.profil)
    HasilLatihan.objects.create(
        profil=request.profil, kalimat=kalimat, alat=kalimat.alat,
        alat_dipilih=p.alat_dipilih if p else None, benar=benar, total=total,
    )
    if kartu_hari_ini:
        jadwal.majukan(request.profil, kalimat.alat)
    baru = hadiah.evaluasi(request.profil)
    return {"selesai": True, "hadiah_baru": baru, **penilaian.jawaban(kalimat.data, kalimat.jenis)}


class LatihanView(PenulisView):
    def get(self, request):
        profil = request.profil
        dipelajari = list(jadwal.alat_dipelajari(profil))
        campuran = len(dipelajari) >= jadwal.MIN_ALAT_CAMPURAN
        selesai_hari_ini = set(
            HasilLatihan.objects.filter(profil=profil, tanggal__gte=jadwal.awal_hari())
            .values_list("kalimat_id", flat=True)
        )
        kartu = []
        for i, k in enumerate(jadwal.kartu_hari_ini(profil)):
            # Hanya percobaan hari ini: tebakan alat kemarin tidak membuka alat hari ini.
            p = Percobaan.objects.filter(profil=profil, kalimat=k,
                                         created_at__gte=jadwal.awal_hari()).last()
            sembunyikan = campuran and i >= 1 and not (p and p.alat_benar)
            kartu.append({
                "id": k.id,
                "jenis": k.jenis,
                "alat": None if sembunyikan else alat_ringkas(k.alat),
                "pilihan_alat": [alat_ringkas(a) for a in dipelajari] if sembunyikan else [],
                "selesai": k.id in selesai_hari_ini,
                "kata_umum": sorted(KATA_UMUM) if k.jenis == Misi.Jenis.KEMBAR else [],
                **penilaian.data_publik(k.data, k.jenis),
            })
        out = {"kartu": kartu}
        if not kartu:
            out["pesan"] = "Hari ini tidak ada pemanasan. Langsung lanjut, yuk!"
        return Response(out)


class LatihanAlatView(PenulisView):
    """Latihan campuran: anak memilih alat dulu."""

    @transaction.atomic
    def post(self, request, pk):
        k = ambil_kalimat(request, pk)
        alat = Alat.objects.filter(kode=request.data.get("alat")).first()
        if alat is None:
            raise ValidationError("Pilih salah satu alat.")
        p = percobaan_latihan(request.profil, k)
        benar = alat == k.alat
        if p.alat_dipilih is None:
            p.alat_dipilih = alat
        p.alat_benar = p.alat_benar or benar
        p.save()
        out = {"benar": benar}
        if benar:
            out["alat"] = alat_ringkas(alat)
        else:
            out["pesan"] = "Hmm, coba baca sekali lagi. Masalahnya apa?"
        return Response(out)


class LatihanKlikView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        k = ambil_kalimat(request, pk)
        if k.jenis != Misi.Jenis.KLIK:
            raise ValidationError("Kalimat ini bukan Klik Kesalahan.")
        p = percobaan_latihan(request.profil, k)
        out = proses_klik(p, k.data, request)
        if p.selesai:
            out.update(selesaikan(request, k, p, out["total"], out["total"]))
        return Response(out)


class LatihanBerhentiView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        k = ambil_kalimat(request, pk)
        p = percobaan_latihan(request.profil, k)
        p.selesai = True
        p.save()
        return Response(selesaikan(request, k, p, len(p.ditemukan), len(k.data.get("kunci", []))))


class LatihanPeriksaView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        k = ambil_kalimat(request, pk)
        p = percobaan_latihan(request.profil, k)
        if k.jenis == Misi.Jenis.GUNTING:
            potong = request.data.get("potong")
            if not isinstance(potong, list):
                raise ValidationError("Kirim daftar potong.")
            hasil = penilaian.nilai_gunting(k.data, potong)
            p.selesai = True
            p.save()
            return Response({**hasil, **selesaikan(request, k, p, hasil["skor"], hasil["total"])})
        if k.jenis == Misi.Jenis.KEMBAR:
            if not penilaian.nilai_kembar(k.data, request.data.get("kata")):
                p.meleset += 1
                p.save()
                return Response({"hasil": "belum", "meleset": p.meleset, "selesai": False})
            p.selesai = True
            p.save()
            return Response({"hasil": "benar",
                             **selesaikan(request, k, p, 1 if p.meleset == 0 else 0, 1)})
        raise ValidationError("Kalimat ini tidak diperiksa dengan cara ini.")


class RuangLatihanView(PenulisView):
    """Ruang Latihan satu alat (spec 075 K4): semua teks bank latihan alat itu, bebas dimainkan
    setelah Perunggu. Teks yang belum dicoba didahulukan, lalu yang paling jarang dicoba.
    Penilaian memakai endpoint latihan yang sama, jadi percobaan pertama di tiap teks dihitung
    sebagai teks baru untuk Perak."""

    def get(self, request, kode):
        profil = request.profil
        alat = get_object_or_404(Alat, kode=kode)
        if not Stiker.objects.filter(profil=profil, alat=alat, tingkat=Tingkat.PERUNGGU).exists():
            raise PermissionDenied(
                f"Ruang Latihan {alat.nama} terbuka setelah kamu mendapat stiker Perunggu "
                f"di Modul {alat.modul_belajar}.")
        qs = (KalimatLatihan.objects.filter(alat=alat)
              .annotate(n=Count("hasillatihan", filter=Q(hasillatihan__profil=profil)),
                        terakhir=Max("hasillatihan__tanggal", filter=Q(hasillatihan__profil=profil)))
              .order_by("n", "terakhir", "kode"))
        kartu = [{
            "id": k.id, "kode": k.kode, "jenis": k.jenis, "dicoba": k.n > 0,
            "kata_umum": sorted(KATA_UMUM) if k.jenis == Misi.Jenis.KEMBAR else [],
            **penilaian.data_publik(k.data, k.jenis),
        } for k in qs]
        perak = Stiker.objects.filter(profil=profil, alat=alat, tingkat=Tingkat.PERAK).exists()
        return Response({
            "alat": alat_ringkas(alat),
            "kartu": kartu,
            "dicoba": sum(1 for k in kartu if k["dicoba"]),
            "jumlah": len(kartu),
            "perak": {
                "punya": perak,
                "syarat_teks": alat.syarat_teks.get(Tingkat.PERAK, ""),
                "kemajuan": None if perak else hadiah.kemajuan(profil, alat, Tingkat.PERAK),
            },
        })
