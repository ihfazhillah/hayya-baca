"""Misi, ujian, dan Latihan Bertanya untuk penulis."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .. import hadiah, penilaian
from ..kata_umum import KATA_UMUM
from ..models import HasilMisi, HasilUjian, Misi, Modul, PemeriksaanLembar, Percobaan, SoalUjian
from ..progres import modul_terbuka, pesan_terkunci, status_misi
from .base import PenulisView

JENIS_INTERAKTIF = {Misi.Jenis.KLIK, Misi.Jenis.GUNTING, Misi.Jenis.KEMBAR}


def ambil_misi(request, pk):
    misi = get_object_or_404(Misi.objects.select_related("modul", "lembar"), pk=pk)
    if not modul_terbuka(request.profil, misi.modul):
        raise PermissionDenied(pesan_terkunci(misi.modul))
    return misi


def percobaan_aktif(profil, misi):
    """Percobaan berjalan, dikunci sampai transaksi selesai: dua klik yang datang bersamaan
    tidak saling menimpa `ditemukan` (Postgres). Panggil di dalam transaction.atomic."""
    p = Percobaan.objects.select_for_update().filter(
        profil=profil, misi=misi, selesai=False).order_by("id").last()
    return p or Percobaan.objects.create(profil=profil, misi=misi)


def catat_hasil(profil, misi, **kw):
    """Simpan HasilMisi lalu jalankan mesin hadiah. Kembalikan hadiah baru."""
    HasilMisi.objects.create(profil=profil, misi=misi, **kw)
    return hadiah.evaluasi(profil)


def selesai_respons(misi, percobaan, hadiah_baru):
    return {
        "selesai": True,
        "ditemukan": len(percobaan.ditemukan) if percobaan else 0,
        "hadiah_baru": hadiah_baru,
        **penilaian.jawaban(misi.data, misi.jenis),
    }


class MisiView(PenulisView):
    def get(self, request, pk):
        misi = ambil_misi(request, pk)
        semua = list(misi.modul.misi.order_by("urutan").values_list("id", flat=True))
        status = status_misi(request.profil, [misi]).get(misi.id)
        out = {
            "id": misi.id,
            "modul": {"nomor": misi.modul.nomor, "judul": misi.modul.judul,
                      "alat": misi.modul.alat.kode if misi.modul.alat else None},
            "urutan": misi.urutan,
            "jumlah_misi": len(semua),
            "berikutnya": semua[semua.index(misi.id) + 1] if misi.id != semua[-1] else None,
            "judul": misi.judul,
            "tahap": misi.tahap,
            "tahap_label": misi.get_tahap_display(),
            "jenis": misi.jenis,
            "petunjuk": misi.petunjuk,
            "status": status,
            **penilaian.data_publik(misi.data, misi.jenis),
        }
        if misi.jenis == Misi.Jenis.KLIK and misi.tahap != Misi.Tahap.PETUNJUK:
            out.pop("jumlah", None)
        if misi.jenis == Misi.Jenis.KEMBAR:
            out["kata_umum"] = sorted(KATA_UMUM)
        if misi.lembar:
            out["lembar"] = {"kode": misi.lembar.kode, "judul": misi.lembar.judul}
        if misi.jenis in JENIS_INTERAKTIF:
            p = Percobaan.objects.filter(profil=request.profil, misi=misi, selesai=False).last()
            out["percobaan"] = {
                "diklik": p.diklik if p else [],
                "celah": p.celah if p else [],
                "ditemukan": len(p.ditemukan) if p else 0,
                "meleset": p.meleset if p else 0,
                "pakai_petunjuk": p.pakai_petunjuk if p else False,
            }
        if status == HasilMisi.Status.SELESAI:
            out.update(penilaian.jawaban(misi.data, misi.jenis))
        return Response(out)


def proses_klik(p, data, request):
    """Satu klik pada percobaan `p`. Kembalikan respons; `p.selesai` True bila semua ketemu."""
    token, celah = request.data.get("token"), request.data.get("celah")
    if token is None and celah is None:
        raise ValidationError("Kirim token atau celah.")
    hasil, grup = penilaian.nilai_klik(data, p.ditemukan, token=token, celah=celah)
    if hasil == "ketemu":
        p.ditemukan = p.ditemukan + [grup]
        if token is not None:
            p.diklik = p.diklik + [token]
        if celah is not None:
            p.celah = p.celah + [celah]
    elif hasil == "meleset":
        p.meleset += 1
    total = len(data["kunci"])
    p.selesai = len(p.ditemukan) == total
    p.save()
    return {"hasil": hasil, "ditemukan": len(p.ditemukan), "total": total,
            "meleset": p.meleset,
            "boleh_petunjuk": p.meleset >= penilaian.BATAS_MELESET_PETUNJUK,
            "selesai": False}


class KlikView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis != Misi.Jenis.KLIK:
            raise ValidationError("Misi ini bukan Klik Kesalahan.")
        p = percobaan_aktif(request.profil, misi)
        out = proses_klik(p, misi.data, request)
        if p.selesai:
            baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI,
                               benar=out["total"], total=out["total"], meleset=p.meleset,
                               pakai_petunjuk=p.pakai_petunjuk)
            out.update(selesai_respons(misi, p, baru))
        return Response(out)


class PetunjukView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis != Misi.Jenis.KLIK:
            raise ValidationError("Petunjuk hanya untuk Klik Kesalahan.")
        p = percobaan_aktif(request.profil, misi)
        if p.meleset < penilaian.BATAS_MELESET_PETUNJUK:
            raise ValidationError("Coba dulu sedikit lagi, ya.")
        p.pakai_petunjuk = True
        p.save()
        return Response({"kalimat": penilaian.kalimat_petunjuk(misi.data, p.ditemukan)})


class BerhentiView(PenulisView):
    """Anak merasa sudah selesai mencari: catat yang ditemukan, buka versi benar."""

    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis != Misi.Jenis.KLIK:
            raise ValidationError("Hanya untuk Klik Kesalahan.")
        p = percobaan_aktif(request.profil, misi)
        p.selesai = True
        p.save()
        baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI,
                           benar=len(p.ditemukan), total=len(misi.data["kunci"]),
                           meleset=p.meleset, pakai_petunjuk=p.pakai_petunjuk)
        return Response(selesai_respons(misi, p, baru))


class PeriksaView(PenulisView):
    """Gunting (daftar potongan) dan Detektor Kembar (kata pilihan)."""

    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis == Misi.Jenis.GUNTING:
            potong = request.data.get("potong")
            if not isinstance(potong, list):
                raise ValidationError("Kirim daftar potong.")
            hasil = penilaian.nilai_gunting(misi.data, potong)
            baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI,
                               benar=hasil["skor"], total=hasil["total"],
                               meleset=len(hasil["tidak_perlu"]))
            return Response({**hasil, **selesai_respons(misi, None, baru)})
        if misi.jenis == Misi.Jenis.KEMBAR:
            p = percobaan_aktif(request.profil, misi)
            if not penilaian.nilai_kembar(misi.data, request.data.get("kata")):
                p.meleset += 1
                p.save()
                return Response({"hasil": "belum", "meleset": p.meleset, "selesai": False})
            p.selesai = True
            p.save()
            baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI,
                               benar=1 if p.meleset == 0 else 0, total=1, meleset=p.meleset)
            return Response({"hasil": "benar", **selesai_respons(misi, p, baru)})
        raise ValidationError("Misi ini tidak diperiksa dengan cara ini.")


class TandaiView(PenulisView):
    """Misi tandai dan LOG."""

    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis not in (Misi.Jenis.TANDAI, Misi.Jenis.LOG):
            raise ValidationError("Misi ini diselesaikan dengan cara lain.")
        log = (request.data.get("log") or "").strip()
        if misi.jenis == Misi.Jenis.LOG and not log:
            raise ValidationError("Tulis LOG-mu dulu, satu baris saja.")
        baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI, log=log)
        return Response({"selesai": True, "hadiah_baru": baru})


class CetakMisiView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis != Misi.Jenis.CETAK:
            raise ValidationError("Misi ini tidak dicetak.")
        sudah = PemeriksaanLembar.objects.filter(
            profil=request.profil, misi=misi, status=PemeriksaanLembar.Status.MENUNGGU
        ).exists()
        if not sudah:
            PemeriksaanLembar.objects.create(profil=request.profil, lembar=misi.lembar, misi=misi)
            catat_hasil(request.profil, misi, status=HasilMisi.Status.MENUNGGU)
        return Response({"status": HasilMisi.Status.MENUNGGU, "lembar": misi.lembar.kode})


class UjianJawabView(PenulisView):
    def post(self, request, pk):
        soal = get_object_or_404(SoalUjian, pk=pk)
        if not modul_terbuka(request.profil, soal.modul):
            raise PermissionDenied(pesan_terkunci(soal.modul))
        pilihan = request.data.get("pilihan")
        if pilihan not in ("a", "b"):
            raise ValidationError("Pilih A atau B.")
        benar = pilihan == soal.jawaban
        HasilUjian.objects.create(profil=request.profil, soal=soal, pilihan=pilihan, benar=benar)
        return Response({"benar": benar, "jawaban": soal.jawaban, "alasan": soal.alasan})


class BertanyaJawabView(PenulisView):
    def post(self, request, nomor):
        modul = get_object_or_404(Modul, nomor=nomor)
        if not modul_terbuka(request.profil, modul):
            raise PermissionDenied(pesan_terkunci(modul))
        soal = getattr(modul, "bertanya", None)
        if soal is None:
            raise ValidationError("Modul ini tidak punya Latihan Bertanya.")
        pilihan = request.data.get("pilihan")
        if pilihan not in ("a", "b"):
            raise ValidationError("Pilih A atau B.")
        return Response({"benar": pilihan == soal.jawaban, "jawaban": soal.jawaban,
                         "bagian": soal.bagian, "penjelasan": soal.penjelasan})
