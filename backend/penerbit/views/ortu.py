"""Area Pemeriksa (Ayah dan Ummah) di bawah /ortu/."""
import re
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import is_child_account

from .. import hadiah, jadwal
from ..models import (
    LAPIS_STEMPEL, Alat, BagiNaskah, CatatanNaskah, Hadiah, HasilLatihan, HasilMisi, Jejak,
    KartuUlasan, Modul, Naskah, PemeriksaanLembar, Penukaran, Poin, Prompt, Stempel,
    Stiker, Tingkat, Versi,
)
from ..peran import profil_diperiksa
from ..progres import modul_selesai, modul_terbuka
from .base import OrtuView
from .belajar import jumlah_kartu_tanpa_reaksi, jumlah_pertanyaan_terbuka
from .jelajah import jumlah_soal_belum_dikerjakan
from .naskah import naskah_detail, naskah_ringkas, stempel_json
from .penulis import alat_json

User = get_user_model()
POIN_BERANI_HAPUS = 10
POIN_MANUAL = {"berani_hapus": (POIN_BERANI_HAPUS, "Berani Hapus"),
               "log": (2, "LOG yang menjelaskan alasan memakai alat")}


def nama(user):
    return (user.first_name or user.username) if user else None


def awal_minggu():
    """Senin 00.00 waktu rumah (WIB), bukan UTC."""
    hari = jadwal.hari_ini()
    return jadwal.awal_hari(hari - timedelta(days=hari.weekday()))


def modul_berikutnya(profil):
    for m in Modul.objects.all():
        if not modul_selesai(profil, m):
            return m if modul_terbuka(profil, m) else None
    return None


def aktivitas(profil, batas=10):
    kejadian = []
    for h in HasilMisi.objects.filter(profil=profil).select_related("misi__modul")[:batas]:
        teks = f"Misi {h.misi.modul.nomor}.{h.misi.urutan} {h.get_status_display().lower()}"
        if h.total:
            teks += f", {h.benar} dari {h.total}"
        kejadian.append((h.tanggal, teks))
    for s in Stiker.objects.filter(profil=profil).select_related("alat")[:batas]:
        kejadian.append((s.tanggal, f"Stiker {s.get_tingkat_display()} {s.alat.nama}"))
    for v in Versi.objects.filter(naskah__profil=profil).select_related("naskah").order_by(
            "-tanggal")[:batas]:
        kejadian.append((v.tanggal, f"\"{v.naskah.judul}\" Versi {v.nomor} disimpan"))
    kejadian.sort(key=lambda k: k[0], reverse=True)
    return [{"tanggal": t, "teks": teks} for t, teks in kejadian[:batas]]


class DasborView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        sejak = awal_minggu()
        hari_misi = HasilMisi.objects.filter(profil=profil, tanggal__gte=sejak).datetimes(
            "tanggal", "day", tzinfo=jadwal.zona())
        hari_latihan = HasilLatihan.objects.filter(profil=profil, tanggal__gte=sejak).datetimes(
            "tanggal", "day", tzinfo=jadwal.zona())
        kata = sum(len(v.teks.split()) for v in
                   Versi.objects.filter(naskah__profil=profil, tanggal__gte=sejak, nomor=1))
        berikut = modul_berikutnya(profil)
        return Response({
            "penulis": {"id": profil.id, "nama": profil.nama_panggilan},
            "perlu_tindakan": {
                "lembar": PemeriksaanLembar.objects.filter(
                    profil=profil, status=PemeriksaanLembar.Status.MENUNGGU).count(),
                "stempel": Naskah.objects.filter(profil=profil).exclude(stempel_diminta="").count(),
                "penukaran": Penukaran.objects.filter(
                    profil=profil, status=Penukaran.Status.DIAJUKAN).count(),
                "pertanyaan": jumlah_pertanyaan_terbuka(profil),
                "kartu_pamer": jumlah_kartu_tanpa_reaksi(profil),
                "soal_buatan": jumlah_soal_belum_dikerjakan(profil, request.user),
            },
            "minggu_ini": {
                "sesi": len(set(hari_misi) | set(hari_latihan)),
                "misi_selesai": HasilMisi.objects.filter(
                    profil=profil, tanggal__gte=sejak, status=HasilMisi.Status.SELESAI).count(),
                "kata_draf_nol": kata,
                "alat": berikut.alat.nama if berikut and berikut.alat else None,
            },
            "persiapan": {
                "modul": {"nomor": berikut.nomor, "judul": berikut.judul,
                          "petunjuk_lihat": berikut.petunjuk_lihat,
                          "lembar": list(berikut.lembar.values_list("kode", flat=True))}
                if berikut else None,
            },
            "aktivitas": aktivitas(profil),
        })


def urut_kode(lb):
    """M4-2 sebelum M4-10: bagian angka dibandingkan sebagai angka."""
    return [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", lb.kode)]


def lembar_json(lb):
    return {
        "kode": lb.kode, "judul": lb.judul, "petunjuk": lb.petunjuk, "soal": lb.soal,
        "baris_tulis": lb.baris_tulis, "pertanyaan_bantu": lb.pertanyaan_bantu,
        "cek_sendiri": lb.cek_sendiri, "kriteria": lb.kriteria,
        "contoh_jawaban": lb.contoh_jawaban, "saran_stiker": lb.saran_stiker,
        "modul": {"nomor": lb.modul.nomor, "judul": lb.modul.judul},
    }


def pemeriksaan_ringkas(p):
    return {"id": p.id, "kode": p.lembar.kode, "judul": p.lembar.judul,
            "modul": p.lembar.modul.nomor, "status": p.status, "catatan": p.catatan,
            "tanggal_cetak": p.tanggal_cetak, "diperiksa_oleh": nama(p.diperiksa_oleh)}


def ambil_pemeriksaan(request, pk):
    return get_object_or_404(
        PemeriksaanLembar.objects.select_related("lembar__modul__alat", "misi"),
        pk=pk, profil__in=profil_diperiksa(request.user),
    )


class LembarListView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        qs = PemeriksaanLembar.objects.filter(profil=profil).select_related("lembar__modul")
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        if request.query_params.get("kode"):
            qs = qs.filter(lembar__kode__icontains=request.query_params["kode"])
        return Response([pemeriksaan_ringkas(p) for p in qs])


class LembarView(OrtuView):
    def get(self, request, pk):
        p = ambil_pemeriksaan(request, pk)
        alat = p.lembar.modul.alat
        return Response({**pemeriksaan_ringkas(p), "lembar": lembar_json(p.lembar),
                         "misi": p.misi.judul if p.misi else None,
                         "alat": alat.kode if alat else None})

    @transaction.atomic
    def post(self, request, pk):
        p = ambil_pemeriksaan(request, pk)
        hasil = request.data.get("status")
        if hasil not in (PemeriksaanLembar.Status.BAGUS, PemeriksaanLembar.Status.COBA_LAGI):
            raise ValidationError("Pilih Sudah bagus atau Coba lagi.")
        p.status = hasil
        p.catatan = (request.data.get("catatan") or "").strip()
        p.diperiksa_oleh = request.user
        p.tanggal_periksa = timezone.now()
        p.save()
        if p.misi:
            status_baru = (HasilMisi.Status.SELESAI if hasil == "bagus"
                           else HasilMisi.Status.COBA_LAGI)
            terakhir = HasilMisi.objects.filter(profil=p.profil, misi=p.misi).first()
            # Simpan ulang dengan hasil yang sama tidak menambah baris hasil misi.
            if terakhir is None or terakhir.status != status_baru or terakhir.log != p.catatan:
                HasilMisi.objects.create(profil=p.profil, misi=p.misi, status=status_baru,
                                         log=p.catatan)
        baru = []
        tingkat = request.data.get("stiker")
        alat = p.lembar.modul.alat
        if tingkat:
            if tingkat not in Tingkat.values or alat is None:
                raise ValidationError("Stiker tidak bisa diberikan untuk lembar ini.")
            baru += hadiah.beri_stiker(p.profil, alat, tingkat, oleh=request.user,
                                       catatan=p.catatan)
        baru += hadiah.evaluasi(p.profil)
        return Response({**pemeriksaan_ringkas(p), "hadiah_baru": baru})


def ambil_naskah_ortu(request, pk):
    return get_object_or_404(Naskah, pk=pk, profil__in=profil_diperiksa(request.user))


class NaskahListView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        return Response([naskah_ringkas(n) for n in Naskah.objects.filter(profil=profil)])


class NaskahView(OrtuView):
    def get(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        v = n.versi.last()
        out = naskah_detail(n)
        out["versi_terakhir"] = {"nomor": v.nomor, "teks": v.teks, "isi": v.isi,
                                 "sorotan": v.sorotan, "lapis": v.lapis} if v else None
        out["dibagikan"] = [nama(b.user) for b in n.dibagikan.select_related("user")]
        jejak = Jejak.objects.filter(versi__naskah=n, versi__nomor=1).first()
        out["jejak"] = {"kesalahan_ejaan": jejak.kesalahan_ejaan,
                        "kesalahan_ejaan_ortu": jejak.kesalahan_ejaan_ortu} if jejak else None
        return Response(out)


class StempelView(OrtuView):
    @transaction.atomic
    def post(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        lapis = request.data.get("lapis")
        if lapis not in LAPIS_STEMPEL:
            raise ValidationError("Lapis tidak dikenal.")
        if lapis == "pembaca" and not n.ulasan.exists():
            raise ValidationError("Stempel Pembaca butuh Kartu Ulasan dulu.")
        s, dibuat = Stempel.objects.get_or_create(
            naskah=n, lapis=lapis,
            defaults={"diberikan_oleh": request.user, "catatan": request.data.get("catatan", "")},
        )
        if not dibuat:
            raise ValidationError("Stempel ini sudah diberikan.")
        if n.stempel_diminta == lapis:
            n.stempel_diminta = ""
            n.save(update_fields=["stempel_diminta"])
        return Response({"stempel": stempel_json(n)}, status=status.HTTP_201_CREATED)


class CatatanView(OrtuView):
    def post(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        teks = (request.data.get("teks") or "").strip()
        if not teks:
            raise ValidationError("Catatan kosong.")
        c = CatatanNaskah.objects.create(naskah=n, penulis=request.user, teks=teks)
        return Response({"id": c.id, "teks": c.teks}, status=status.HTTP_201_CREATED)


def simpan_ulasan(request, naskah, versi):
    isi = {k: (request.data.get(k) or "").strip()
           for k in ("favorit", "membingungkan", "pertanyaan")}
    if not all(isi.values()):
        raise ValidationError("Isi ketiga bagian Kartu Ulasan.")
    u = KartuUlasan.objects.create(naskah=naskah, versi=versi, penulis=request.user, **isi)
    return Response({"id": u.id, **isi}, status=status.HTTP_201_CREATED)


class UlasanOrtuView(OrtuView):
    def post(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        v = n.versi.last()
        if v is None:
            raise ValidationError("Belum ada versi untuk diulas.")
        return simpan_ulasan(request, n, v)


class BukaLaciOrtuView(OrtuView):
    def post(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        if n.tahap != Naskah.Tahap.LACI:
            raise ValidationError("Naskah ini tidak sedang di laci.")
        n.laci_dibuka = True
        n.tahap = Naskah.Tahap.REVISI
        n.save()
        return Response({"tahap": n.tahap})


class BagikanView(OrtuView):
    def post(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        tamu = User.objects.filter(username=request.data.get("username")).first()
        if tamu is None or is_child_account(tamu):
            raise ValidationError("Akun itu tidak ditemukan.")
        v = n.versi.last()
        if v is None:
            raise ValidationError("Belum ada versi untuk dibagikan.")
        BagiNaskah.objects.update_or_create(
            naskah=n, user=tamu, defaults={"versi": v, "dibagikan_oleh": request.user}
        )
        return Response({"dibagikan": nama(tamu), "versi": v.nomor},
                        status=status.HTTP_201_CREATED)


EKSTENSI_SAMPUL = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def sampul_aman(berkas):
    """Hanya gambar raster: sampul disajikan dari origin yang sama dengan token login, jadi
    HTML/SVG yang diunggah bisa menjalankan skrip."""
    ext = ("." + berkas.name.rsplit(".", 1)[-1].lower()) if "." in berkas.name else ""
    jenis = (getattr(berkas, "content_type", "") or "").lower()
    if ext not in EKSTENSI_SAMPUL or not jenis.startswith("image/") or "svg" in jenis:
        raise ValidationError("Sampul harus berupa gambar PNG, JPG, WEBP, atau GIF.")
    return berkas


class TerbitkanView(OrtuView):
    @transaction.atomic
    def post(self, request, pk):
        # Kunci baris: tombol Terbitkan yang ditekan dua kali tidak menerbitkan dua kali.
        n = Naskah.objects.select_for_update().get(pk=ambil_naskah_ortu(request, pk).pk)
        ada = set(n.stempel.values_list("lapis", flat=True))
        if not set(LAPIS_STEMPEL) <= ada:
            raise ValidationError("Cerita bisa terbit setelah 5 stempel lengkap.")
        if n.tahap == Naskah.Tahap.TERBIT:
            raise ValidationError("Cerita ini sudah terbit.")
        terbit = Naskah.objects.filter(profil=n.profil, tahap=Naskah.Tahap.TERBIT).count()
        n.nomor_terbitan = f"PR-{terbit + 1:03d}"
        n.tahap = Naskah.Tahap.TERBIT
        n.tanggal_terbit = timezone.now()
        n.tentang_penulis = request.data.get("tentang_penulis", n.tentang_penulis)
        if request.data.get("judul"):
            n.judul = request.data["judul"][:150]
        if request.FILES.get("sampul"):
            n.sampul = sampul_aman(request.FILES["sampul"])
        n.save()
        baru = hadiah.evaluasi(n.profil)
        return Response({"nomor_terbitan": n.nomor_terbitan, "hadiah_baru": baru})


class PoinManualView(OrtuView):
    """Berani Hapus (10) dan LOG yang menjelaskan alasan (2), diberikan Pemeriksa."""

    jenis = "berani_hapus"

    def post(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        jumlah, alasan = POIN_MANUAL[self.jenis]
        catatan = (request.data.get("catatan") or "").strip()
        hadiah.tambah_poin(n.profil, jumlah, f"{alasan}: {catatan or n.judul}",
                           f"{self.jenis}:{n.id}:{uuid.uuid4().hex[:8]}", oleh=request.user)
        return Response({"total_poin": hadiah.total_poin(n.profil)}, status=status.HTTP_201_CREATED)


class EjaanJejakView(OrtuView):
    def patch(self, request, pk):
        n = ambil_naskah_ortu(request, pk)
        j = get_object_or_404(Jejak, versi__naskah=n, versi__nomor=1)
        nilai = request.data.get("kesalahan_ejaan")
        if nilai in (None, ""):
            j.kesalahan_ejaan_ortu = None
        else:
            try:
                j.kesalahan_ejaan_ortu = int(nilai)
            except (TypeError, ValueError):
                raise ValidationError("Kesalahan ejaan berupa angka.")
            if j.kesalahan_ejaan_ortu < 0:
                raise ValidationError("Kesalahan ejaan tidak boleh negatif.")
        j.save()
        hadiah.evaluasi(n.profil)
        return Response({"kesalahan_ejaan": j.ejaan})


class StikerOrtuView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        stiker = {(s.alat_id, s.tingkat): s for s in
                  Stiker.objects.filter(profil=profil).select_related("diberikan_oleh")}
        alat = []
        for a in Alat.objects.all():
            data = alat_json(a, profil, stiker)
            for slot in data["slot"]:
                s = stiker.get((a.id, slot["tingkat"]))
                slot["diberikan_oleh"] = nama(s.diberikan_oleh) if s and s.diberikan_oleh else (
                    "otomatis" if s else None)
            alat.append(data)
        stempel = [{"naskah": n.judul, "id": n.id, "stempel": stempel_json(n)}
                   for n in Naskah.objects.filter(profil=profil)]
        return Response({"alat": alat, "stempel": stempel})

    def post(self, request):
        profil = self.profil(request)
        alat = get_object_or_404(Alat, kode=request.data.get("alat"))
        tingkat = request.data.get("tingkat")
        if tingkat not in Tingkat.values:
            raise ValidationError("Tingkat tidak dikenal.")
        baru = hadiah.beri_stiker(profil, alat, tingkat, oleh=request.user,
                                  catatan=request.data.get("catatan", ""))
        if not baru:
            raise ValidationError("Stiker ini sudah ada.")
        return Response({"hadiah_baru": baru}, status=status.HTTP_201_CREATED)


def hadiah_json(h):
    return {"id": h.id, "nama": h.nama, "harga": h.harga, "aktif": h.aktif}


def penukaran_json(p):
    return {"id": p.id, "hadiah": p.hadiah.nama, "harga": p.hadiah.harga, "status": p.status,
            "tanggal": p.tanggal}


class HadiahOrtuView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        minggu = {}
        for p in Poin.objects.filter(profil=profil):
            tahun, no, _ = timezone.localtime(p.tanggal, jadwal.zona()).isocalendar()
            kunci = f"{tahun}-W{no:02d}"
            m = minggu.setdefault(kunci, {"minggu": kunci, "total": 0, "baris": []})
            m["total"] += p.jumlah
            m["baris"].append({"jumlah": p.jumlah, "alasan": p.alasan, "tanggal": p.tanggal})
        return Response({
            "total": hadiah.total_poin(profil),
            "hadiah": [hadiah_json(h) for h in Hadiah.objects.filter(profil=profil)],
            "penukaran": [penukaran_json(p) for p in
                          Penukaran.objects.filter(profil=profil).select_related("hadiah")],
            "riwayat_poin": sorted(minggu.values(), key=lambda m: m["minggu"], reverse=True),
        })

    def post(self, request):
        profil = self.profil(request)
        nama_hadiah = (request.data.get("nama") or "").strip()
        try:
            harga = int(request.data.get("harga"))
        except (TypeError, ValueError):
            raise ValidationError("Harga berupa angka poin.")
        if not nama_hadiah or harga <= 0:
            raise ValidationError("Isi nama dan harga hadiah.")
        h = Hadiah.objects.create(profil=profil, nama=nama_hadiah, harga=harga)
        return Response(hadiah_json(h), status=status.HTTP_201_CREATED)


def _bool(nilai):
    if isinstance(nilai, str):
        return nilai.strip().lower() in ("1", "true", "ya", "on")
    return bool(nilai)


class HadiahItemOrtuView(OrtuView):
    def patch(self, request, pk):
        h = get_object_or_404(Hadiah, pk=pk, profil__in=profil_diperiksa(request.user))
        if "nama" in request.data:
            h.nama = str(request.data["nama"] or "").strip()[:120]
            if not h.nama:
                raise ValidationError("Isi nama hadiah.")
        if "harga" in request.data:
            try:
                h.harga = int(request.data["harga"])
            except (TypeError, ValueError):
                raise ValidationError("Harga berupa angka poin.")
            if h.harga <= 0:
                raise ValidationError("Harga minimal 1 poin.")
        if "aktif" in request.data:
            h.aktif = _bool(request.data["aktif"])
        h.save()
        return Response(hadiah_json(h))


class PenukaranOrtuView(OrtuView):
    @transaction.atomic
    def post(self, request, pk):
        p = get_object_or_404(Penukaran.objects.select_related("hadiah", "profil"), pk=pk,
                              profil__in=profil_diperiksa(request.user))
        keputusan = request.data.get("status")
        if p.status != Penukaran.Status.DIAJUKAN and keputusan != Penukaran.Status.DISETUJUI:
            raise ValidationError("Penukaran ini sudah diputuskan.")
        if keputusan == Penukaran.Status.DISETUJUI:
            if p.status == Penukaran.Status.DISETUJUI:
                raise ValidationError("Sudah disetujui.")
            if hadiah.total_poin(p.profil) < p.hadiah.harga:
                raise ValidationError("Poinnya belum cukup.")
            hadiah.tambah_poin(p.profil, -p.hadiah.harga, f"Ditukar: {p.hadiah.nama}",
                               f"tukar:{p.id}", oleh=request.user)
        elif keputusan != Penukaran.Status.DITUNDA:
            raise ValidationError("Pilih Setujui atau Nanti dulu.")
        p.status = keputusan
        p.diputuskan_oleh = request.user
        p.save()
        return Response(penukaran_json(p))


class CetakOrtuView(OrtuView):
    def get(self, request):
        modul = get_object_or_404(Modul, nomor=request.query_params.get("modul") or 0)
        return Response({"modul": {"nomor": modul.nomor, "judul": modul.judul},
                         "lembar": [lembar_json(lb) for lb in
                                    sorted(modul.lembar.all(), key=urut_kode)]})


def prompt_json(p):
    return {"id": p.id, "modul": p.modul.nomor, "tahap": p.tahap, "bagian": p.bagian,
            "teks": p.teks, "refleksi_bantu": p.refleksi_bantu, "refleksi_ubah": p.refleksi_ubah,
            "catatan_ortu": p.catatan_ortu, "tanggal": p.tanggal}


class PromptOrtuView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        return Response([prompt_json(p) for p in
                         Prompt.objects.filter(profil=profil).select_related("modul")])


class PromptItemOrtuView(OrtuView):
    def patch(self, request, pk):
        p = get_object_or_404(Prompt, pk=pk, profil__in=profil_diperiksa(request.user))
        p.catatan_ortu = request.data.get("catatan_ortu", "")
        p.save(update_fields=["catatan_ortu"])
        return Response(prompt_json(p))

