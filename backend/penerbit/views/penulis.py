from rest_framework.response import Response

from .. import hadiah
from ..models import Alat, Modul, Stiker
from ..progres import modul_terbuka
from .base import PenulisView


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


class BerandaView(PenulisView):
    def get(self, request):
        return Response({"nama": request.profil.nama_panggilan})


class KartuAlatView(PenulisView):
    def get(self, request):
        profil = request.profil
        stiker = {(s.alat_id, s.tingkat): s for s in Stiker.objects.filter(profil=profil)}
        return Response({"alat": [alat_json(a, profil, stiker) for a in Alat.objects.all()]})
