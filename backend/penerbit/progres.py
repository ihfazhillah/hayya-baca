"""Status misi dan modul untuk satu penulis."""
from .models import HasilMisi, Misi, Modul


def status_misi(profil, misi_qs=None):
    """{misi_id: status terbaru} untuk misi yang pernah dikerjakan."""
    qs = HasilMisi.objects.filter(profil=profil)
    if misi_qs is not None:
        qs = qs.filter(misi__in=misi_qs)
    status = {}
    for misi_id, s in qs.order_by("tanggal", "id").values_list("misi_id", "status"):
        status[misi_id] = s
    return status


def modul_selesai(profil, modul):
    """Semua misi non-bonus pernah dikerjakan (menunggu pemeriksaan tetap dihitung)."""
    wajib = modul.misi.exclude(tahap=Misi.Tahap.BONUS)
    dikerjakan = set(
        HasilMisi.objects.filter(profil=profil, misi__in=wajib).values_list("misi_id", flat=True)
    )
    return all(m.id in dikerjakan for m in wajib)


def modul_terbuka(profil, modul):
    """Modul pertama selalu terbuka; modul lain setelah modul sebelumnya selesai."""
    if profil.buka_semua:
        return True
    sebelumnya = Modul.objects.filter(nomor__lt=modul.nomor).order_by("-nomor").first()
    return sebelumnya is None or modul_selesai(profil, sebelumnya)


def pesan_terkunci(modul):
    sebelumnya = Modul.objects.filter(nomor__lt=modul.nomor).order_by("-nomor").first()
    return f"Selesaikan Modul {sebelumnya.nomor} dulu, ya."
