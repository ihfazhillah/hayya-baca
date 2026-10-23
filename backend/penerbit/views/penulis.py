from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import hadiah, jadwal
from ..models import (
    Alat, Hadiah, HasilLatihan, HasilMisi, Lembar, Misi, Modul, Naskah, PemeriksaanLembar, Penukaran, Prompt,
    Stempel, Stiker, TahapMentor,
)
from ..peran import profil_diperiksa, profil_untuk_pemeriksa, profil_untuk_request
from ..progres import modul_selesai, modul_terbuka, pesan_terkunci, status_misi
from .base import PenulisView
from .belajar import kabar_belajar
from .sampul import url_sampul


def alat_json(alat, profil, stiker=None, terbuka=None):
    """Satu alat untuk Kartu Alat, termasuk tiga slot stiker dan kemajuannya."""
    if stiker is None:
        stiker = {(s.alat_id, s.tingkat): s for s in Stiker.objects.filter(profil=profil, alat=alat)}
    if terbuka is None:
        modul = Modul.objects.filter(nomor=alat.modul_belajar).first()
        terbuka = modul is not None and modul_terbuka(profil, modul)
    slot = []
    for tingkat in hadiah.URUTAN_TINGKAT:
        s = stiker.get((alat.id, tingkat))
        slot.append({
            "tingkat": tingkat,
            "punya": s is not None,
            "tanggal": s.tanggal if s else None,
            "syarat_teks": alat.syarat_teks.get(tingkat, ""),
            "oleh_pemeriksa": alat.syarat.get(tingkat, {}).get("jenis") == "pemeriksa",
            "kemajuan": None if s else hadiah.kemajuan(profil, alat, tingkat),
        })
    return {
        "kode": alat.kode, "nama": alat.nama, "emoji": alat.emoji,
        "pertanyaan": alat.pertanyaan, "cara_pakai": alat.cara_pakai,
        "contoh_sebelum": alat.contoh_sebelum, "contoh_sesudah": alat.contoh_sesudah,
        "warna": alat.warna, "pola_cetak": alat.pola_cetak,
        "modul_belajar": alat.modul_belajar, "terbuka": terbuka, "slot": slot,
    }


class KartuAlatView(PenulisView):
    def get(self, request):
        profil = request.profil
        stiker = {(s.alat_id, s.tingkat): s for s in Stiker.objects.filter(profil=profil)}
        return Response({"alat": [alat_json(a, profil, stiker) for a in Alat.objects.all()]})


# ---- Beranda dan Modul ---------------------------------------------------

def peta_perjalanan(profil):
    peta, aktif_ditemukan = [], False
    for m in Modul.objects.all():
        if modul_selesai(profil, m):
            s = "selesai"
        elif not aktif_ditemukan and modul_terbuka(profil, m):
            s, aktif_ditemukan = "aktif", True
        elif modul_terbuka(profil, m):
            s = "terbuka"  # simulasi orang tua: semua modul terbuka
        else:
            s = "terkunci"
        peta.append({"nomor": m.nomor, "judul": m.judul, "level": m.level, "emoji": m.emoji,
                     "status": s})
    return peta


def lanjutkan(profil):
    for m in Modul.objects.all():
        if modul_selesai(profil, m):
            continue
        if not modul_terbuka(profil, m):
            return None
        status = status_misi(profil, m.misi.all())
        misi = next((x for x in m.misi.exclude(tahap=Misi.Tahap.BONUS) if x.id not in status),
                    None)
        return {"modul": {"nomor": m.nomor, "judul": m.judul, "emoji": m.emoji},
                "misi": {"id": misi.id, "urutan": misi.urutan, "judul": misi.judul}
                if misi else None,
                "pertama_kali": not HasilMisi.objects.filter(profil=profil).exists(),
                "perkiraan_menit": 15}
    return None


def kabar(profil, batas=5):
    out = []
    for s in Stiker.objects.filter(profil=profil, diberikan_oleh__isnull=False).select_related(
            "alat", "diberikan_oleh")[:batas]:
        out.append({"tanggal": s.tanggal, "jenis": "stiker", "emoji": s.alat.emoji,
                    "teks": f"Stiker {s.get_tingkat_display()} {s.alat.nama}",
                    "catatan": s.catatan, "oleh": s.diberikan_oleh.first_name or
                    s.diberikan_oleh.username})
    for st in Stempel.objects.filter(naskah__profil=profil).select_related(
            "naskah", "diberikan_oleh").order_by("-tanggal")[:batas]:
        out.append({"tanggal": st.tanggal, "jenis": "stempel", "emoji": "",
                    "teks": f"Stempel {st.lapis} untuk \"{st.naskah.judul}\"",
                    "catatan": st.catatan,
                    "oleh": (st.diberikan_oleh.first_name or st.diberikan_oleh.username)
                    if st.diberikan_oleh else None})
    out += kabar_belajar(profil, batas)
    out.sort(key=lambda k: k["tanggal"], reverse=True)
    return out[:batas]


def coba_lagi(profil):
    terbaru = {}
    for h in HasilMisi.objects.filter(profil=profil).select_related("misi__modul").order_by(
            "tanggal", "id"):
        terbaru[h.misi_id] = h
    return [{"misi": h.misi_id, "judul": h.misi.judul, "modul": h.misi.modul.nomor,
             "catatan": h.log} for h in terbaru.values() if h.status == HasilMisi.Status.COBA_LAGI]


class BerandaView(PenulisView):
    def get(self, request):
        profil = request.profil
        stiker = {(s.alat_id, s.tingkat): s for s in Stiker.objects.filter(profil=profil)}
        due = [a for a in jadwal.alat_jatuh_tempo(profil)]
        sudah = set(HasilLatihan.objects.filter(
            profil=profil, tanggal__gte=jadwal.awal_hari()).values_list("kalimat_id", flat=True))
        modul_terbuka_set = {m.nomor for m in Modul.objects.all() if modul_terbuka(profil, m)}
        sisa_kartu = [k for k in jadwal.kartu_hari_ini(profil) if k.id not in sudah]
        return Response({
            "nama": profil.nama_panggilan,
            "lanjutkan": lanjutkan(profil),
            "pemanasan": {"alat": [a.nama for a in due], "ada": bool(sisa_kartu)},
            "peta": peta_perjalanan(profil),
            "alat": [{"kode": a.kode, "nama": a.nama, "emoji": a.emoji, "warna": a.warna,
                      "modul_belajar": a.modul_belajar,
                      "terbuka": a.modul_belajar in modul_terbuka_set,
                      "stiker": [t for t in hadiah.URUTAN_TINGKAT if (a.id, t) in stiker]}
                     for a in Alat.objects.all()],
            "pangkat": profil.pangkat.nama if profil.pangkat else None,
            "poin": hadiah.total_poin(profil),
            "kabar": kabar(profil),
            "coba_lagi": coba_lagi(profil),
            "menunggu": PemeriksaanLembar.objects.filter(
                profil=profil, status=PemeriksaanLembar.Status.MENUNGGU).count(),
        })


ATURAN_PROMPT = (
    "Aturanmu: jangan pernah menulis ulang kalimatku dan jangan memberi contoh kalimat "
    "pengganti. Kamu hanya boleh bertanya atau menunjuk bagian yang perlu diperbaiki. "
    "Pakai bahasa yang mudah dan singkat."
)


def pembuka_prompt(profil):
    """Umur dari profil anak bila diisi; profil simulasi atau umur kosong → usia SD."""
    umur = profil.child.age if profil.child_id else None
    siapa = f"penulis anak umur {umur} tahun" if umur else "penulis anak usia SD"
    return f"Kamu editor untuk {siapa}. {ATURAN_PROMPT}"


def mentor_json(m, profil):
    out = {"tahap": m.tahap_mentor, "kartu_prompt": m.kartu_prompt, "pembuka": pembuka_prompt(profil)}
    if m.tahap_mentor == TahapMentor.ISIAN:
        out["isian_awal"] = [
            f"Aku sedang di {m.judul}" + (f" (alat {m.alat.nama})." if m.alat else "."),
            "",
            "Tolong beri aku 2 pertanyaan. Jangan tulis kalimatnya untukku.",
            "",
        ]
    return out


class ModulView(PenulisView):
    def get(self, request, nomor):
        profil = request.profil
        m = get_object_or_404(Modul.objects.select_related("alat"), nomor=nomor)
        dasar = {"nomor": m.nomor, "judul": m.judul, "emoji": m.emoji, "level": m.level}
        if not modul_terbuka(profil, m):
            return Response({**dasar, "terkunci": True, "pesan": pesan_terkunci(m),
                             "modul_sebelumnya": m.nomor - 1})
        status = status_misi(profil, m.misi.all())
        bertanya = getattr(m, "bertanya", None)
        return Response({
            **dasar, "terkunci": False, "tujuan": m.tujuan, "kenapa": m.kenapa,
            "langkah": m.langkah, "resep": m.resep, "mengapa": m.mengapa, "kamus": m.kamus,
            "lapis": m.lapis, "petunjuk_lihat": m.petunjuk_lihat,
            "mentor": mentor_json(m, profil),
            "bertanya": {"a": bertanya.pilihan_a, "b": bertanya.pilihan_b} if bertanya else None,
            "misi": [{"id": x.id, "urutan": x.urutan, "judul": x.judul, "tahap": x.tahap,
                      "tahap_label": x.label_tahap(), "jenis": x.jenis,
                      "jenis_label": x.get_jenis_display(), "status": status.get(x.id),
                      "tautan": x.data.get("tautan")} for x in m.misi.all()],
            "ujian": [{"id": u.id, "soal": u.soal, "a": u.pilihan_a, "b": u.pilihan_b}
                      for u in m.ujian.all()],
            "lembar": [{"kode": lb.kode, "judul": lb.judul} for lb in m.lembar.order_by("kode")],
            "alat": alat_json(m.alat, profil) if m.alat else None,
        })


# ---- Prompt ----------------------------------------------------------------

def teks_prompt(m, bagian, profil):
    if m.tahap_mentor == TahapMentor.CONTOH or not bagian:
        isi = m.kartu_prompt
    else:
        isi = " ".join(b.strip() for b in bagian)
    return f"{pembuka_prompt(profil)}\n\n{isi}"


class PromptListView(PenulisView):
    def post(self, request):
        m = get_object_or_404(Modul, nomor=request.data.get("modul"))
        if m.tahap_mentor == TahapMentor.TANPA:
            raise ValidationError("Modul ini tanpa AI.")
        bagian = request.data.get("bagian") or []
        if m.tahap_mentor in (TahapMentor.ISIAN, TahapMentor.MANDIRI):
            if len(bagian) != 4 or not all(str(b).strip() for b in bagian):
                raise ValidationError("Isi keempat bagian Rumus Bertanya dulu.")
        p = Prompt.objects.create(profil=request.profil, modul=m, tahap=m.tahap_mentor,
                                  bagian=[str(b) for b in bagian], teks=teks_prompt(m, bagian, request.profil))
        return Response({"id": p.id, "teks": p.teks}, status=status.HTTP_201_CREATED)


class PromptView(PenulisView):
    def patch(self, request, pk):
        p = get_object_or_404(Prompt, pk=pk, profil=request.profil)
        bantu = request.data.get("refleksi_bantu")
        if bantu not in Prompt.Bantu.values:
            raise ValidationError("Pilih: ya, sedikit, atau tidak.")
        p.refleksi_bantu = bantu
        p.refleksi_ubah = str(request.data.get("refleksi_ubah") or "")[:300]
        p.save()
        return Response({"id": p.id, "refleksi_bantu": p.refleksi_bantu})


# ---- Hadiah ---------------------------------------------------------------

class PenukaranView(PenulisView):
    def get(self, request):
        profil = request.profil
        return Response({
            "total": hadiah.total_poin(profil),
            "hadiah": [{"id": h.id, "nama": h.nama, "harga": h.harga}
                       for h in Hadiah.objects.filter(profil=profil, aktif=True)],
            "penukaran": [{"id": p.id, "hadiah": p.hadiah.nama, "status": p.status,
                           "tanggal": p.tanggal}
                          for p in Penukaran.objects.filter(profil=profil).select_related("hadiah")],
        })

    def post(self, request):
        profil = request.profil
        h = get_object_or_404(Hadiah, pk=request.data.get("hadiah"), profil=profil, aktif=True)
        diajukan = sum(Penukaran.objects.filter(
            profil=profil, status=Penukaran.Status.DIAJUKAN).values_list("hadiah__harga", flat=True))
        if hadiah.total_poin(profil) - diajukan < h.harga:
            raise ValidationError("Poinmu belum cukup. Terus berlatih, ya!")
        p = Penukaran.objects.create(profil=profil, hadiah=h)
        return Response({"id": p.id, "status": p.status}, status=status.HTTP_201_CREATED)


# ---- Rak Buku dan Lembar cetak ---------------------------------------------

def profil_rak(request):
    """Penulis melihat raknya sendiri; Pemeriksa melihat rak anaknya (?penulis=)."""
    profil = profil_untuk_request(request)
    if profil:
        return profil
    if profil_diperiksa(request.user).exists():
        return profil_untuk_pemeriksa(request)
    raise PermissionDenied("Rak ini untuk penulis dan Ayah atau Ummah.")


def buku_json(n):
    return {"id": n.id, "judul": n.judul, "nomor_terbitan": n.nomor_terbitan,
            "sampul": url_sampul(n), "tanggal_terbit": n.tanggal_terbit}


class RakView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profil = profil_rak(request)
        return Response({"penulis": profil.nama_panggilan, "buku": [
            buku_json(n) for n in Naskah.objects.filter(profil=profil, tahap=Naskah.Tahap.TERBIT)
            .order_by("tanggal_terbit")]})


class BukuView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        profil = profil_rak(request)
        n = get_object_or_404(Naskah, pk=pk, profil=profil, tahap=Naskah.Tahap.TERBIT)
        v = n.versi.last()
        return Response({**buku_json(n), "penulis": profil.nama_panggilan,
                         "teks": v.teks if v else "", "isi": v.isi if v else {},
                         "tentang_penulis": n.tentang_penulis,
                         "paragraf_favorit": n.paragraf_favorit})


class CetakLembarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, kode):
        if not (profil_untuk_request(request) or profil_diperiksa(request.user).exists()):
            raise PermissionDenied("Lembar ini untuk penulis dan Ayah atau Ummah.")
        from .ortu import lembar_json

        lb = get_object_or_404(Lembar.objects.select_related("modul"), kode=kode)
        return Response(lembar_json(lb))
