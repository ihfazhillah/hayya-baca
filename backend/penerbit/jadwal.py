"""Pemanasan Alat Lama (Roadmap: 1 hari, 3 hari, 1 minggu, 2 minggu, lalu sesekali)."""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from .models import Alat, JadwalUlang, KalimatLatihan, Stiker, Tingkat

JARAK_HARI = [1, 3, 7, 14]
JARAK_SESEKALI = 30
KARTU_PER_HARI = 3
MIN_ALAT_CAMPURAN = 2


def zona():
    """Zona waktu keluarga. Server memakai UTC; "hari ini" anak mengikuti jam rumah (WIB)."""
    return ZoneInfo(getattr(settings, "PENERBIT_TIME_ZONE", "Asia/Jakarta"))


def hari_ini():
    return timezone.localdate(timezone=zona())


def awal_hari(tanggal=None):
    """Pukul 00.00 waktu rumah, sebagai datetime aware (untuk filter tanggal di database)."""
    return datetime.combine(tanggal or hari_ini(), time.min, tzinfo=zona())


def mulai_jadwal(profil, alat):
    JadwalUlang.objects.get_or_create(
        profil=profil, alat=alat,
        defaults={"putaran": 0, "jatuh_tempo": hari_ini() + timedelta(days=JARAK_HARI[0])},
    )


def majukan(profil, alat):
    """Dipanggil setelah kalimat latihan alat ini selesai. Maju sekali per hari jatuh tempo."""
    j = JadwalUlang.objects.filter(profil=profil, alat=alat).first()
    if j is None or j.jatuh_tempo > hari_ini():
        return
    j.putaran = min(j.putaran + 1, len(JARAK_HARI))
    jarak = JARAK_HARI[j.putaran] if j.putaran < len(JARAK_HARI) else JARAK_SESEKALI
    j.jatuh_tempo = hari_ini() + timedelta(days=jarak)
    j.terakhir = hari_ini()
    j.save()


def alat_dipelajari(profil):
    ids = Stiker.objects.filter(profil=profil, tingkat=Tingkat.PERUNGGU).values_list("alat_id")
    return Alat.objects.filter(id__in=ids)


def alat_jatuh_tempo(profil):
    """Alat yang dilatih hari ini: jatuh tempo, atau sudah dilatih hari ini (supaya kartu tetap)."""
    return [
        j.alat for j in JadwalUlang.objects.filter(profil=profil)
        .filter(Q(jatuh_tempo__lte=hari_ini()) | Q(terakhir=hari_ini()))
        # Urut per alat saja: jatuh_tempo berubah setelah kartu pertama dikerjakan, dan urutan
        # kartu (serta kartu mana yang "campuran") harus tetap sepanjang hari.
        .select_related("alat").order_by("alat__urutan", "alat_id")
    ]


def kartu_hari_ini(profil):
    """Sampai 3 kalimat, bergiliran antar alat jatuh tempo. Stabil sepanjang hari."""
    awal = awal_hari()
    antrean = []
    for alat in alat_jatuh_tempo(profil):
        qs = (
            KalimatLatihan.objects.filter(alat=alat)
            .annotate(n=Count("hasillatihan", filter=Q(
                hasillatihan__profil=profil, hasillatihan__tanggal__lt=awal)))
            .order_by("n", "kode")
        )
        antrean.append(list(qs))
    kartu = []
    while len(kartu) < KARTU_PER_HARI and any(antrean):
        for daftar in antrean:
            if daftar and len(kartu) < KARTU_PER_HARI:
                kartu.append(daftar.pop(0))
    return kartu
