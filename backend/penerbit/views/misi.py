"""Misi, ujian, dan Latihan Bertanya untuk penulis."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .. import hadiah, penilaian
from ..kata_umum import KATA_UMUM
from ..models import (
    HasilMisi, HasilUjian, Lembar, Misi, Modul, PemeriksaanLembar, Percobaan, SoalUjian,
)
from ..progres import modul_terbuka, pesan_terkunci, status_misi
from .base import PenulisView

JENIS_INTERAKTIF = {Misi.Jenis.KLIK, Misi.Jenis.GUNTING, Misi.Jenis.KEMBAR}


def ambil_misi(request, pk):
    misi = get_object_or_404(Misi.objects.select_related("modul", "lembar"), pk=pk)
    if not modul_terbuka(request.profil, misi.modul):
        raise PermissionDenied(pesan_terkunci(misi.modul))
    return misi


def teks_rekam(profil, misi, rekam=None):
    """Teks yang dibaca keras untuk misi rekam: versi benar misi yang sudah selesai saja,
    supaya kunci misi yang belum dikerjakan tidak terbuka. `rekam`: milik satu tantangan Jelajah."""
    rekam = rekam or misi.data["rekam"]
    sumber = misi.modul.misi.filter(urutan__in=rekam["dari_misi"]).order_by("urutan")
    selesai = set(HasilMisi.objects.filter(
        profil=profil, misi__in=sumber, status=HasilMisi.Status.SELESAI
    ).values_list("misi_id", flat=True))
    return [{"judul": m.judul, "teks": m.data["versi_benar"]} for m in sumber if m.id in selesai]


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


# ---- Misi Jelajah: misi bonus "pilih 1 dari 3 tantangan" (spec 075 K4) ----------------
#
# Pilihan anak disimpan di Percobaan.butir {"pilihan": i} (tanpa migrasi): percobaan yang masih
# berjalan = pilihan saat ini; setelah Tandai selesai, percobaan ditutup dan pilihannya tetap
# terbaca dari percobaan terakhir.

def tantangan_publik(profil, misi, t):
    out = {k: v for k, v in t.items() if k not in ("rekam", "lembar")}
    if "rekam" in t:
        out["teks_rekam"] = teks_rekam(profil, misi, t["rekam"])
    if t.get("lembar"):
        lb = Lembar.objects.filter(kode=t["lembar"]).first()
        out["lembar"] = {"kode": t["lembar"], "judul": lb.judul if lb else ""}
    return out


def pilihan_tersimpan(profil, misi):
    """Indeks tantangan yang dipilih: percobaan berjalan dulu, lalu yang terakhir selesai."""
    p = (Percobaan.objects.filter(profil=profil, misi=misi, selesai=False).last()
         or Percobaan.objects.filter(profil=profil, misi=misi, selesai=True).last())
    i = (p.butir or {}).get("pilihan") if p else None
    return i if isinstance(i, int) and 0 <= i < len(misi.data.get("pilihan", [])) else None


def indeks_pilihan(misi, nilai):
    if "pilihan" not in misi.data:
        raise ValidationError("Misi ini tidak punya tantangan untuk dipilih.")
    if isinstance(nilai, bool) or not isinstance(nilai, int) \
            or not 0 <= nilai < len(misi.data["pilihan"]):
        raise ValidationError("Pilih salah satu dari tiga tantangan.")
    return nilai


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
            "tahap_label": misi.label_tahap(),
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
        if "rekam" in misi.data:
            out.pop("rekam")
            out["teks_rekam"] = teks_rekam(request.profil, misi)
        if "pilihan" in misi.data:
            out["pilihan"] = [tantangan_publik(request.profil, misi, t)
                              for t in misi.data["pilihan"]]
            out["dipilih"] = pilihan_tersimpan(request.profil, misi)
        if misi.jenis in JENIS_INTERAKTIF:
            p = Percobaan.objects.filter(profil=request.profil, misi=misi, selesai=False).last()
            out["percobaan"] = {
                "diklik": p.diklik if p else [],
                "celah": p.celah if p else [],
                "ditemukan": len(p.ditemukan) if p else 0,
                "meleset": p.meleset if p else 0,
                "pakai_petunjuk": p.pakai_petunjuk if p else False,
            }
            if misi.data.get("bantuan_memudar") and status != HasilMisi.Status.SELESAI:
                if misi.jenis == Misi.Jenis.GUNTING:
                    out["bantuan"] = penilaian.bantuan_gunting(misi.data, [])
                elif misi.jenis == Misi.Jenis.KEMBAR:
                    out["bantuan"] = penilaian.bantuan_kembar(misi.data, misi.tahap)
                else:
                    out["bantuan"] = penilaian.bantuan(misi.data, p.ditemukan if p else [])
        if misi.jenis == Misi.Jenis.PERASAAN:
            p = Percobaan.objects.filter(profil=request.profil, misi=misi, selesai=False).last()
            out["percobaan"] = percobaan_perasaan(misi.data, p)
            if misi.data.get("bantuan_memudar") and status != HasilMisi.Status.SELESAI:
                out["bantuan"] = penilaian.bantuan_perasaan(misi.data, p.butir if p else {})
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
    out = {"hasil": hasil, "ditemukan": len(p.ditemukan), "total": total,
           "meleset": p.meleset,
           "boleh_petunjuk": p.meleset >= penilaian.BATAS_MELESET_PETUNJUK,
           "selesai": False}
    if data.get("bantuan_memudar"):
        out["bantuan"] = penilaian.bantuan(data, p.ditemukan)
    return out


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


def percobaan_perasaan(data, p):
    """Keadaan misi perasaan untuk dilanjutkan: soal sekarang, perasaan yang sudah tepat, kata
    bukti yang sudah diklik, dan kunci soal yang SUDAH selesai saja."""
    butir = p.butir if p else {}
    i = penilaian.soal_sekarang(data, butir)
    b = (butir.get(str(i)) or penilaian.butir_kosong()) if i is not None else None
    selesai = [
        {"soal": j, **penilaian.kunci_perasaan(data["soal"][j]),
         "salah": butir.get(str(j), {}).get("salah", 0)}
        for j in range(penilaian.soal_awal(data), i if i is not None else len(data["soal"]))
    ]
    return {"soal": i, "perasaan": b["perasaan"] if b else None,
            "diklik": b["diklik"] if b else [], "ditemukan": len(b["ditemukan"]) if b else 0,
            "meleset": p.meleset if p else 0, "selesai_soal": selesai}


class PerasaanView(PenulisView):
    """Kamera (spec 075 K1): {"soal": i, "perasaan": ".."} lalu {"soal": i, "token": n} per
    kata bukti. Soal dikerjakan berurutan; kunci soal dibuka setelah soal itu selesai."""

    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis != Misi.Jenis.PERASAAN:
            raise ValidationError("Misi ini bukan Pilih Perasaan.")
        data = misi.data
        p = percobaan_aktif(request.profil, misi)
        i = penilaian.soal_sekarang(data, p.butir)
        if request.data.get("soal") != i:
            raise ValidationError("Kerjakan soal yang sedang tampil, ya.")
        s = data["soal"][i]
        b = p.butir.get(str(i)) or penilaian.butir_kosong()
        perasaan, token = request.data.get("perasaan"), request.data.get("token")
        if perasaan is not None:
            if perasaan not in s["pilihan"]:
                raise ValidationError("Pilih salah satu perasaan yang ada.")
            hasil = penilaian.nilai_perasaan(s, b, perasaan)
            if hasil == "belum":
                p.meleset += 1
        elif token is not None:
            if b["perasaan"] is None:
                raise ValidationError("Pilih perasaannya dulu, ya.")
            hasil = penilaian.nilai_bukti(s, b, token)
            if hasil == "meleset":
                p.meleset += 1
        else:
            raise ValidationError("Kirim perasaan atau token.")
        p.butir = {**p.butir, str(i): b}
        butir_selesai = len(b["ditemukan"]) == len(s["bukti"])
        berikut = penilaian.soal_sekarang(data, p.butir)
        p.selesai = berikut is None
        p.save()
        out = {"hasil": hasil, "soal": berikut, "ditemukan": len(b["ditemukan"]),
               "total": len(s["bukti"]), "meleset": p.meleset, "butir_selesai": butir_selesai,
               "selesai": False}
        if butir_selesai:
            out.update(penilaian.kunci_perasaan(s))
        if data.get("bantuan_memudar"):
            out["bantuan"] = penilaian.bantuan_perasaan(data, p.butir)
        if p.selesai:
            benar, total = penilaian.hasil_perasaan(data, p.butir)
            baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI,
                               benar=benar, total=total, meleset=p.meleset)
            out.update(selesai_respons(misi, None, baru), ditemukan=len(b["ditemukan"]))
        return Response(out)


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


class BantuanGuntingView(PenulisView):
    """Bantuan memudar Gunting untuk garis potong anak saat ini. Tidak menilai dan tidak
    menyimpan apa pun: penilaian tetap lewat Periksa."""

    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        if misi.jenis != Misi.Jenis.GUNTING or not misi.data.get("bantuan_memudar"):
            raise ValidationError("Misi ini tidak memakai bantuan Oren.")
        potong = request.data.get("potong")
        if not isinstance(potong, list) or not all(isinstance(i, int) for i in potong):
            raise ValidationError("Kirim daftar potong.")
        return Response({"bantuan": penilaian.bantuan_gunting(misi.data, potong)})


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
        if "pilihan" in misi.data:
            p = percobaan_aktif(request.profil, misi)
            if request.data.get("pilihan") is not None:
                p.butir = {"pilihan": indeks_pilihan(misi, request.data.get("pilihan"))}
            i = (p.butir or {}).get("pilihan")
            if i is None:
                raise ValidationError("Pilih satu tantangan dulu, ya.")
            if misi.data["pilihan"][i].get("pertanyaan") and not log:
                raise ValidationError("Tulis jawabanmu dulu, satu baris saja.")
            p.selesai = True
            p.save()
        baru = catat_hasil(request.profil, misi, status=HasilMisi.Status.SELESAI, log=log)
        return Response({"selesai": True, "hadiah_baru": baru})


class PilihTantanganView(PenulisView):
    """Misi Jelajah: anak memilih satu dari tiga tantangan (boleh diganti sebelum selesai)."""

    @transaction.atomic
    def post(self, request, pk):
        misi = ambil_misi(request, pk)
        i = indeks_pilihan(misi, request.data.get("pilihan"))
        p = percobaan_aktif(request.profil, misi)
        p.butir = {"pilihan": i}
        p.save()
        return Response({"dipilih": i})


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
