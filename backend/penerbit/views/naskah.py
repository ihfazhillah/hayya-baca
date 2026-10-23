"""Ruang Penulis: Bank Ide, naskah, Versi, Laci, Jejak."""
from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .. import hadiah, jejak
from ..models import (
    LAPIS_STEMPEL, DrafKerja, Ide, Jejak, Naskah, Stempel, Versi,
)
from .base import PenulisView
from .sampul import url_sampul

LACI_JAM = 48
LAPIS_REVISI = ["peta", "kamera", "gunting", "kaca"]
NAMA_LAPIS = {"peta": "Peta", "kamera": "Kamera", "gunting": "Gunting", "kaca": "Kaca",
              "pembaca": "Pembaca"}


def ide_json(i):
    return {"id": i.id, "teks": i.teks, "sumur": i.sumur, "bintang": i.bintang,
            "tanggal": i.tanggal}


class IdeListView(PenulisView):
    def get(self, request):
        return Response([ide_json(i) for i in Ide.objects.filter(profil=request.profil)])

    def post(self, request):
        teks = (request.data.get("teks") or "").strip()
        if not teks:
            raise ValidationError("Tulis idenya dulu.")
        sumur = request.data.get("sumur") or ""
        if sumur and sumur not in Ide.Sumur.values:
            raise ValidationError("Sumur tidak dikenal.")
        i = Ide.objects.create(profil=request.profil, teks=teks[:300], sumur=sumur)
        return Response(ide_json(i), status=status.HTTP_201_CREATED)


class IdeView(PenulisView):
    def patch(self, request, pk):
        i = get_object_or_404(Ide, pk=pk, profil=request.profil)
        if "bintang" in request.data:
            b = request.data["bintang"]
            if not isinstance(b, list) or len(b) > 3:
                raise ValidationError("Bintang berisi 3 pilihan.")
            i.bintang = [bool(x) for x in b]
        if "teks" in request.data:
            i.teks = str(request.data["teks"])[:300]
        i.save()
        return Response(ide_json(i))

    def delete(self, request, pk):
        get_object_or_404(Ide, pk=pk, profil=request.profil).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def laci_json(n):
    if not n.laci_buka:
        return None
    sisa = max(0, int((n.laci_buka - timezone.now()).total_seconds()))
    return {"buka": n.laci_buka, "terkunci": sisa > 0 and not n.laci_dibuka,
            "sisa_detik": 0 if n.laci_dibuka else sisa, "dibuka": n.laci_dibuka}


def stempel_json(n):
    ada = {s.lapis: s for s in n.stempel.all()}
    out = []
    for lapis in LAPIS_STEMPEL:
        s = ada.get(lapis)
        out.append({"lapis": lapis, "nama": NAMA_LAPIS[lapis], "punya": s is not None,
                    "tanggal": s.tanggal if s else None, "catatan": s.catatan if s else ""})
    return out


def lapis_berikutnya(n):
    ada = set(n.stempel.values_list("lapis", flat=True))
    return next((lapis for lapis in LAPIS_STEMPEL if lapis not in ada), None)


def versi_ringkas(v):
    return {"nomor": v.nomor, "lapis": v.lapis, "tanggal": v.tanggal,
            "jumlah_kata": len(v.teks.split())}


def naskah_ringkas(n):
    return {"id": n.id, "judul": n.judul, "tahap": n.tahap, "tahap_label": n.get_tahap_display(),
            "laci": laci_json(n), "stempel": [s["lapis"] for s in stempel_json(n) if s["punya"]],
            "nomor_terbitan": n.nomor_terbitan, "stempel_diminta": n.stempel_diminta,
            "created_at": n.created_at}


def naskah_detail(n):
    versi = list(n.versi.all())
    draf = getattr(n, "draf", None)
    return {
        **naskah_ringkas(n),
        "peta": n.peta,
        "kartu_tebakan": n.kartu_tebakan,
        "stempel": stempel_json(n),
        "stempel_diminta": n.stempel_diminta,
        "lapis_berikutnya": lapis_berikutnya(n),
        "versi": [versi_ringkas(v) for v in versi],
        "jumlah_kata_v1": len(versi[0].teks.split()) if versi else None,
        "draf": {"isi": draf.isi, "teks": draf.teks, "sorotan": draf.sorotan, "lapis": draf.lapis,
                 "waktu_klien": draf.waktu_klien,
                 "menulis_tambahan_dari": draf.menulis_tambahan_dari} if draf else None,
        "catatan": [{"teks": c.teks, "oleh": c.penulis.first_name or c.penulis.username,
                     "tanggal": c.tanggal} for c in n.catatan.select_related("penulis")],
        "ulasan": [{"favorit": u.favorit, "membingungkan": u.membingungkan,
                    "pertanyaan": u.pertanyaan, "versi": u.versi.nomor,
                    "oleh": u.penulis.first_name or u.penulis.username, "tanggal": u.tanggal}
                   for u in n.ulasan.select_related("penulis", "versi")],
        "paragraf_favorit": n.paragraf_favorit,
        "sampul": url_sampul(n),
        "tentang_penulis": n.tentang_penulis,
    }


def ambil_naskah(request, pk):
    return get_object_or_404(Naskah, pk=pk, profil=request.profil)


class NaskahListView(PenulisView):
    def get(self, request):
        return Response([naskah_ringkas(n) for n in Naskah.objects.filter(profil=request.profil)])

    @transaction.atomic
    def post(self, request):
        judul = (request.data.get("judul") or "").strip()
        if not judul:
            raise ValidationError("Beri judul sementara dulu.")
        ide = None
        if request.data.get("ide"):
            ide = get_object_or_404(Ide, pk=request.data["ide"], profil=request.profil)
        peta = request.data.get("peta") or {}
        n = Naskah.objects.create(profil=request.profil, judul=judul[:150], ide=ide,
                                  peta=peta, tahap=Naskah.Tahap.DRAF_NOL)
        DrafKerja.objects.create(naskah=n)
        return Response(naskah_detail(n), status=status.HTTP_201_CREATED)


class NaskahView(PenulisView):
    def get(self, request, pk):
        return Response(naskah_detail(ambil_naskah(request, pk)))

    def patch(self, request, pk):
        n = ambil_naskah(request, pk)
        for f in ("judul", "kartu_tebakan"):
            if f in request.data:
                setattr(n, f, str(request.data[f])[:500])
        if "peta" in request.data and isinstance(request.data["peta"], dict):
            n.peta = request.data["peta"]
        n.save()
        return Response(naskah_detail(n))


def boleh_menulis(n):
    if n.tahap == Naskah.Tahap.DRAF_NOL:
        return True
    return n.tahap == Naskah.Tahap.REVISI and n.laci_dibuka


class SimpanView(PenulisView):
    """Simpan otomatis isi editor (DrafKerja). Antrean offline yang lebih tua ditolak."""

    @transaction.atomic
    def post(self, request, pk):
        n = ambil_naskah(request, pk)
        if not boleh_menulis(n):
            raise ValidationError("Naskah ini sedang tidak bisa ditulis.")
        draf, _ = DrafKerja.objects.select_for_update().get_or_create(naskah=n)
        waktu = int(request.data.get("waktu_klien") or 0)
        if waktu < draf.waktu_klien:
            return Response({"detail": "Ada versi yang lebih baru di server.",
                             "waktu_klien": draf.waktu_klien}, status=status.HTTP_409_CONFLICT)
        draf.isi = request.data.get("isi") or {}
        draf.teks = request.data.get("teks") or ""
        draf.sorotan = request.data.get("sorotan") or []
        draf.lapis = request.data.get("lapis") or draf.lapis
        draf.waktu_klien = waktu
        if request.data.get("menulis_tambahan_dari") is not None:
            draf.menulis_tambahan_dari = request.data["menulis_tambahan_dari"]
        draf.save()
        return Response({"tersimpan": draf.diperbarui, "waktu_klien": draf.waktu_klien})


class VersiBaruView(PenulisView):
    @transaction.atomic
    def post(self, request, pk):
        n = ambil_naskah(request, pk)
        draf = getattr(n, "draf", None)
        if draf is None or not draf.teks.strip():
            raise ValidationError("Belum ada tulisan untuk disimpan.")
        nomor = n.versi.count() + 1
        if n.tahap == Naskah.Tahap.DRAF_NOL:
            lapis = ""
        elif n.tahap == Naskah.Tahap.REVISI and n.laci_dibuka:
            lapis = request.data.get("lapis") or ""
            if lapis not in LAPIS_REVISI + ["bengkel"]:
                raise ValidationError("Pilih lapis revisi.")
        else:
            raise ValidationError("Naskah ini belum bisa disimpan sebagai versi baru.")
        v = Versi.objects.create(
            naskah=n, nomor=nomor, isi=draf.isi, teks=draf.teks, sorotan=draf.sorotan,
            lapis=lapis, menulis_tambahan_dari=draf.menulis_tambahan_dari,
        )
        out = {"nomor": nomor, "lapis": lapis}
        if nomor == 1:
            angka = jejak.hitung(v.teks)
            Jejak.objects.create(versi=v, **angka)
            out["jejak"] = angka
            n.tahap = Naskah.Tahap.LACI
            n.laci_buka = timezone.now() + timedelta(hours=LACI_JAM)
            n.save()
        out["hadiah_baru"] = hadiah.evaluasi(request.profil)
        return Response(out, status=status.HTTP_201_CREATED)


class VersiView(PenulisView):
    def get(self, request, pk, nomor):
        v = get_object_or_404(Versi, naskah=ambil_naskah(request, pk), nomor=nomor)
        return Response({**versi_ringkas(v), "isi": v.isi, "teks": v.teks, "sorotan": v.sorotan})


class BukaLaciView(PenulisView):
    def post(self, request, pk):
        n = ambil_naskah(request, pk)
        if n.tahap != Naskah.Tahap.LACI:
            raise ValidationError("Naskah ini tidak sedang di laci.")
        laci = laci_json(n)
        if laci["terkunci"]:
            return Response({"detail": "Laci belum boleh dibuka.",
                             "sisa_detik": laci["sisa_detik"]}, status=status.HTTP_400_BAD_REQUEST)
        n.laci_dibuka = True
        n.tahap = Naskah.Tahap.REVISI
        n.save()
        return Response({"kartu_tebakan": n.kartu_tebakan, "tahap": n.tahap})


class SorotanSistemView(PenulisView):
    def get(self, request, pk):
        n = ambil_naskah(request, pk)
        alat = [a for a in (request.query_params.get("alat") or "").split(",") if a]
        teks = n.draf.teks if hasattr(n, "draf") else ""
        return Response(jejak.sorotan_sistem(teks, alat))


class MintaStempelView(PenulisView):
    def post(self, request, pk):
        n = ambil_naskah(request, pk)
        lapis = request.data.get("lapis")
        if lapis not in LAPIS_REVISI or not n.versi.filter(lapis=lapis).exists():
            raise ValidationError("Simpan dulu versi untuk lapis ini.")
        if Stempel.objects.filter(naskah=n, lapis=lapis).exists():
            raise ValidationError("Stempel lapis ini sudah ada.")
        n.stempel_diminta = lapis
        n.save(update_fields=["stempel_diminta"])
        return Response({"stempel_diminta": lapis})


class FavoritView(PenulisView):
    def post(self, request, pk):
        n = ambil_naskah(request, pk)
        n.paragraf_favorit = {"sebelum": str(request.data.get("sebelum") or ""),
                              "sesudah": str(request.data.get("sesudah") or "")}
        n.save(update_fields=["paragraf_favorit"])
        return Response(n.paragraf_favorit)


ANGKA_JEJAK = [
    ("kalimat_terpanjang", "kalimat terpanjang", "kata"),
    ("kata_kembar_jumlah", "kata kembar terbanyak", "kali"),
    ("kalimat_perasaan", "kalimat \"bilang perasaan\"", "kalimat"),
]


def kalimat_utama(cerita):
    if not cerita:
        return "Jejakmu mulai tercatat setelah Draf Nol pertama."
    if len(cerita) == 1:
        return "Jejak pertamamu sudah tercatat. Cerita berikutnya akan dibandingkan dengan ini."
    awal, akhir = cerita[0], cerita[-1]
    for kunci, nama, satuan in ANGKA_JEJAK:
        if akhir[kunci] < awal[kunci]:
            return (f"Draf Nol-mu makin bersih: {nama} turun dari {awal[kunci]} "
                    f"ke {akhir[kunci]} {satuan}.")
    return f"Jejakmu sudah tercatat di {len(cerita)} cerita. Terus menulis, ya!"


def jejak_cerita(profil):
    out = []
    for j in Jejak.objects.filter(versi__naskah__profil=profil).select_related(
        "versi__naskah"
    ).order_by("versi__tanggal", "versi__id"):
        out.append({
            "naskah": j.versi.naskah_id, "judul": j.versi.naskah.judul,
            "tanggal": j.versi.tanggal, "jumlah_kata": j.jumlah_kata,
            "kalimat_terpanjang": j.kalimat_terpanjang, "kata_kembar": j.kata_kembar,
            "kata_kembar_jumlah": j.kata_kembar_jumlah, "kalimat_perasaan": j.kalimat_perasaan,
            "kesalahan_ejaan": j.ejaan,
            "ejaan_per_100": round(j.ejaan * 100 / j.jumlah_kata, 1) if j.jumlah_kata else 0,
        })
    return out


class JejakView(PenulisView):
    def get(self, request):
        cerita = jejak_cerita(request.profil)
        emas = [{"alat": s.alat.kode, "tanggal": s.tanggal}
                for s in request.profil.stiker.filter(tingkat="emas").select_related("alat")]
        return Response({"cerita": cerita, "kalimat_utama": kalimat_utama(cerita), "emas": emas})
