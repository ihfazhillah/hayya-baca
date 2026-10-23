"""Belajar mandiri (Spec 075 K2, K3): Tanya Ayah atau Ummah dan Kartu Pamer."""
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from ..models import BATAS_PERTANYAAN, HasilMisi, KartuPamer, Misi, Modul, Pertanyaan, Stiker
from ..peran import bisa_simulasi, profil_diperiksa, profil_simulasi
from ..progres import modul_selesai, modul_terbuka, pesan_terkunci, status_misi
from .base import OrtuView, PenulisView

# Jawaban yang sudah lewat dari sini tidak lagi ditampilkan ke anak.
JAWABAN_BARU = timedelta(days=14)
EMOJI_REAKSI = ["👏", "❤️", "🌟", "😄", "💪"]
JENIS_SI_CEROBOH = {Misi.Jenis.KLIK, Misi.Jenis.GUNTING, Misi.Jenis.KEMBAR}


def nama(user):
    return (user.first_name or user.username) if user else None


# ---- Tanya Ayah atau Ummah ---------------------------------------------------

def pertanyaan_json(p):
    return {
        "id": p.id, "teks": p.teks, "dibuat": p.dibuat,
        "modul": {"nomor": p.modul.nomor, "judul": p.modul.judul} if p.modul else None,
        "misi": {"id": p.misi.id, "urutan": p.misi.urutan, "judul": p.misi.judul}
        if p.misi else None,
        "dijawab": p.dijawab_pada is not None, "dijawab_pada": p.dijawab_pada,
        "dijawab_oleh": nama(p.dijawab_oleh), "catatan": p.catatan,
    }


def profil_ortu(view, request):
    """Anak yang diperiksa, atau profil simulasi orang tua itu sendiri bila ?simulasi=1
    (supaya orang tua bisa mencoba sisi menjawab dan memberi reaksi)."""
    if request.query_params.get("simulasi") == "1" and bisa_simulasi(request.user):
        return profil_simulasi(request.user)
    return view.profil(request)


def profil_boleh_ortu(user):
    """Profil yang boleh dijawab/diberi reaksi: anak yang diperiksa + simulasi miliknya."""
    from django.db.models import Q

    return Q(profil__in=profil_diperiksa(user)) | Q(profil__simulasi_oleh=user)


def _pertanyaan_qs():
    return Pertanyaan.objects.select_related("modul", "misi", "dijawab_oleh")


class PertanyaanView(PenulisView):
    def get(self, request):
        """Pertanyaan milik anak: yang masih terbuka dan yang baru dijawab."""
        batas = timezone.now() - JAWABAN_BARU
        qs = _pertanyaan_qs().filter(profil=request.profil)
        qs = qs.filter(dijawab_pada__isnull=True) | qs.filter(dijawab_pada__gte=batas)
        misi = request.query_params.get("misi", "")
        if misi.isdigit():
            qs = qs.filter(misi_id=int(misi))
        return Response([pertanyaan_json(p) for p in qs])

    def post(self, request):
        teks = " ".join(str(request.data.get("teks") or "").split())
        if not teks:
            raise ValidationError("Tulis pertanyaanmu dulu, ya.")
        if len(teks) > BATAS_PERTANYAAN:
            raise ValidationError("Pertanyaannya terlalu panjang. Coba pakai satu kalimat saja.")
        misi = modul = None
        if request.data.get("misi"):
            misi = get_object_or_404(Misi.objects.select_related("modul"),
                                     pk=request.data["misi"])
            modul = misi.modul
        elif request.data.get("modul"):
            modul = get_object_or_404(Modul, nomor=request.data["modul"])
        if modul and not modul_terbuka(request.profil, modul):
            raise PermissionDenied(pesan_terkunci(modul))
        p = Pertanyaan.objects.create(profil=request.profil, modul=modul, misi=misi, teks=teks)
        return Response({**pertanyaan_json(p),
                         "pesan": "Pertanyaanmu sudah dikirim. Kamu boleh lanjut dulu."},
                        status=status.HTTP_201_CREATED)


class PertanyaanOrtuView(OrtuView):
    def get(self, request):
        profil = profil_ortu(self, request)
        qs = _pertanyaan_qs().filter(profil=profil)
        terbuka = [pertanyaan_json(p) for p in qs if p.dijawab_pada is None]
        dijawab = [pertanyaan_json(p) for p in qs if p.dijawab_pada is not None]
        return Response(terbuka + dijawab)


class PertanyaanDijawabView(OrtuView):
    def post(self, request, pk):
        p = get_object_or_404(_pertanyaan_qs().filter(profil_boleh_ortu(request.user)), pk=pk)
        p.catatan = str(request.data.get("catatan") or "").strip()
        p.dijawab_oleh = request.user
        p.dijawab_pada = timezone.now()
        p.save()
        return Response(pertanyaan_json(p))


def jumlah_pertanyaan_terbuka(profil):
    return Pertanyaan.objects.filter(profil=profil, dijawab_pada__isnull=True).count()


def jumlah_kartu_tanpa_reaksi(profil):
    return KartuPamer.objects.filter(profil=profil, reaksi_pada__isnull=True).count()


# ---- Kartu Pamer ---------------------------------------------------------------

def hasil_terbaik(profil, modul):
    """Sebelum/sesudah dari misi Si Ceroboh terakhir yang SELESAI (bukan menunggu).

    Versi benar misi yang belum selesai tidak pernah dikirim, supaya kuncinya tidak bocor.
    """
    misi = [m for m in modul.misi.order_by("urutan") if m.jenis in JENIS_SI_CEROBOH]
    st = status_misi(profil, misi)
    selesai = [m for m in misi if st.get(m.id) == HasilMisi.Status.SELESAI
               and m.data.get("teks") and m.data.get("versi_benar")]
    if not selesai:
        return None
    m = selesai[-1]
    return {"misi": m.urutan, "judul": m.judul, "sebelum": m.data["teks"],
            "sesudah": m.data["versi_benar"]}


def kartu_json(k):
    if k is None:
        return None
    return {"id": k.id, "pelajaran": k.pelajaran, "dibuat": k.dibuat, "diubah": k.diubah,
            "reaksi_emoji": k.reaksi_emoji, "reaksi": k.reaksi,
            "reaksi_oleh": nama(k.reaksi_oleh), "reaksi_pada": k.reaksi_pada}


def ambil_modul(request, nomor):
    modul = get_object_or_404(Modul, nomor=nomor)
    if not modul_terbuka(request.profil, modul):
        raise PermissionDenied(pesan_terkunci(modul))
    return modul


class KartuPamerView(PenulisView):
    def get(self, request, nomor):
        modul = ambil_modul(request, nomor)
        tersedia = modul_selesai(request.profil, modul)
        k = KartuPamer.objects.select_related("reaksi_oleh").filter(
            profil=request.profil, modul=modul).first()
        return Response({"tersedia": tersedia,
                         "hasil": hasil_terbaik(request.profil, modul) if tersedia else None,
                         "kartu": kartu_json(k)})

    def post(self, request, nomor):
        modul = ambil_modul(request, nomor)
        if not modul_selesai(request.profil, modul):
            raise ValidationError("Selesaikan misi di modul ini dulu, ya.")
        pelajaran = " ".join(str(request.data.get("pelajaran") or "").split())
        if not pelajaran:
            raise ValidationError("Tulis satu kalimat tentang yang kamu pelajari.")
        if len(pelajaran) > 300:
            raise ValidationError("Kalimatnya terlalu panjang. Satu kalimat saja, ya.")
        k, baru = KartuPamer.objects.update_or_create(
            profil=request.profil, modul=modul, defaults={"pelajaran": pelajaran})
        return Response(kartu_json(k), status=status.HTTP_201_CREATED if baru else status.HTTP_200_OK)


class KartuPamerOrtuView(OrtuView):
    def get(self, request):
        profil = profil_ortu(self, request)
        stiker = {}
        for s in Stiker.objects.filter(profil=profil):
            stiker.setdefault(s.alat_id, []).append(s.tingkat)
        out = []
        for k in KartuPamer.objects.filter(profil=profil).select_related(
                "modul__alat", "reaksi_oleh"):
            a = k.modul.alat
            out.append({
                **kartu_json(k),
                "modul": {"nomor": k.modul.nomor, "judul": k.modul.judul, "emoji": k.modul.emoji},
                "hasil": hasil_terbaik(profil, k.modul),
                "alat": {"kode": a.kode, "nama": a.nama, "emoji": a.emoji,
                         "stiker": stiker.get(a.id, [])} if a else None,
            })
        return Response({"emoji": EMOJI_REAKSI, "kartu": out})


class ReaksiKartuView(OrtuView):
    def post(self, request, pk):
        k = get_object_or_404(KartuPamer.objects.filter(profil_boleh_ortu(request.user)), pk=pk)
        emoji = str(request.data.get("emoji") or "")
        kalimat = " ".join(str(request.data.get("kalimat") or "").split())[:200]
        if emoji and emoji not in EMOJI_REAKSI:
            raise ValidationError("Pilih salah satu emoji yang ada.")
        if not emoji and not kalimat:
            raise ValidationError("Pilih emoji atau tulis satu kalimat.")
        k.reaksi_emoji = emoji
        k.reaksi = kalimat
        k.reaksi_oleh = request.user
        k.reaksi_pada = timezone.now()
        k.save()
        return Response(kartu_json(k))


# ---- Kabar di Beranda anak -------------------------------------------------------

def kabar_belajar(profil, batas=5):
    out = []
    for p in Pertanyaan.objects.filter(profil=profil, dijawab_pada__isnull=False).exclude(
            catatan="").select_related("dijawab_oleh").order_by("-dijawab_pada")[:batas]:
        out.append({"tanggal": p.dijawab_pada, "jenis": "jawaban", "emoji": "💬",
                    "teks": f"jawaban untuk pertanyaanmu: \"{p.teks}\"",
                    "catatan": p.catatan, "oleh": nama(p.dijawab_oleh)})
    for k in KartuPamer.objects.filter(profil=profil, reaksi_pada__isnull=False).select_related(
            "modul", "reaksi_oleh").order_by("-reaksi_pada")[:batas]:
        out.append({"tanggal": k.reaksi_pada, "jenis": "reaksi", "emoji": k.reaksi_emoji or "💌",
                    "teks": f"reaksi untuk Kartu Pamer Modul {k.modul.nomor}",
                    "catatan": k.reaksi, "oleh": nama(k.reaksi_oleh)})
    return out
