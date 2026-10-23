"""Ruang Penulis (Spec 074): ide, naskah, versi, stempel, ulasan."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .progres import ProfilPenulis

LAPIS_STEMPEL = ["peta", "kamera", "gunting", "kaca", "pembaca"]


class Ide(models.Model):
    class Sumur(models.TextChoices):
        KENANGAN = "kenangan", "Sumur Kenangan"
        BAGAIMANA = "bagaimana", "Sumur Bagaimana Kalau"
        ACAK = "acak", "Sumur Acak"

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="ide")
    teks = models.CharField(max_length=300)
    sumur = models.CharField(max_length=10, choices=Sumur.choices, blank=True)
    # Tes 3 Bintang: senang menulisnya, ada masalahnya, tahu akhirnya
    bintang = models.JSONField(default=list)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal"]
        verbose_name_plural = "ide"


class Naskah(models.Model):
    class Tahap(models.TextChoices):
        PETA = "peta", "Peta 4 Kotak"
        DRAF_NOL = "draf_nol", "Draf Nol"
        LACI = "laci", "Di laci"
        REVISI = "revisi", "Revisi"
        TERBIT = "terbit", "Terbit"

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="naskah")
    judul = models.CharField(max_length=150)
    ide = models.ForeignKey(Ide, null=True, blank=True, on_delete=models.SET_NULL)
    peta = models.JSONField(default=dict)  # {siapa, mau_apa, masalah, akhir}
    # Nama tokoh untuk kata kembar: nama tambahan anak, dan kata nama otomatis yang diabaikan.
    tokoh_tambah = models.JSONField(default=list)  # ["Bu Siti", ...]
    tokoh_abaikan = models.JSONField(default=list)  # ["fatih", ...] huruf kecil
    tahap = models.CharField(max_length=10, choices=Tahap.choices, default=Tahap.PETA)
    laci_buka = models.DateTimeField(null=True, blank=True)
    laci_dibuka = models.BooleanField(default=False)
    kartu_tebakan = models.TextField(blank=True)
    stempel_diminta = models.CharField(max_length=20, blank=True)
    nomor_terbitan = models.CharField(max_length=20, blank=True)
    sampul = models.FileField(upload_to="penerbit/sampul/", blank=True)
    tentang_penulis = models.TextField(blank=True)
    paragraf_favorit = models.JSONField(default=dict)  # {sebelum, sesudah}
    tanggal_terbit = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "naskah"

    def __str__(self):
        return self.judul


class DrafKerja(models.Model):
    """Isi editor yang sedang dikerjakan (simpan otomatis). Bisa diubah."""

    naskah = models.OneToOneField(Naskah, on_delete=models.CASCADE, related_name="draf")
    isi = models.JSONField(default=dict)  # Quill Delta
    teks = models.TextField(blank=True)
    sorotan = models.JSONField(default=list)
    lapis = models.CharField(max_length=20, blank=True)
    # Waktu klien (ms) saat isi ini dibuat; antrean offline yang lebih tua ditolak.
    waktu_klien = models.BigIntegerField(default=0)
    menulis_tambahan_dari = models.PositiveIntegerField(null=True, blank=True)
    diperbarui = models.DateTimeField(auto_now=True)


class Versi(models.Model):
    """Versi naskah yang sudah disimpan. Immutable."""

    naskah = models.ForeignKey(Naskah, on_delete=models.CASCADE, related_name="versi")
    nomor = models.PositiveSmallIntegerField()
    isi = models.JSONField(default=dict)
    teks = models.TextField()
    sorotan = models.JSONField(default=list)
    lapis = models.CharField(max_length=20, blank=True)  # kosong = Draf Nol
    menulis_tambahan_dari = models.PositiveIntegerField(null=True, blank=True)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["naskah", "nomor"]
        unique_together = ["naskah", "nomor"]
        verbose_name_plural = "versi"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("Versi tidak bisa diubah setelah disimpan.")
        super().save(*args, **kwargs)


class Jejak(models.Model):
    versi = models.OneToOneField(Versi, on_delete=models.CASCADE, related_name="jejak")
    jumlah_kata = models.PositiveIntegerField()
    kalimat_terpanjang = models.PositiveIntegerField()
    kata_kembar = models.CharField(max_length=60, blank=True)
    kata_kembar_jumlah = models.PositiveIntegerField(default=0)
    kalimat_perasaan = models.PositiveIntegerField(default=0)
    kesalahan_ejaan = models.PositiveIntegerField(default=0)
    # Diisi orang tua bila deteksi otomatis kurang; dipakai menggantikan nilai otomatis.
    kesalahan_ejaan_ortu = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "jejak"

    @property
    def ejaan(self):
        if self.kesalahan_ejaan_ortu is not None:
            return self.kesalahan_ejaan_ortu
        return self.kesalahan_ejaan


class Stempel(models.Model):
    naskah = models.ForeignKey(Naskah, on_delete=models.CASCADE, related_name="stempel")
    lapis = models.CharField(max_length=20)
    diberikan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    catatan = models.TextField(blank=True)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["naskah", "lapis"]
        verbose_name_plural = "stempel"


class CatatanNaskah(models.Model):
    naskah = models.ForeignKey(Naskah, on_delete=models.CASCADE, related_name="catatan")
    penulis = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    teks = models.TextField()
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal"]
        verbose_name_plural = "catatan naskah"


class BagiNaskah(models.Model):
    naskah = models.ForeignKey(Naskah, on_delete=models.CASCADE, related_name="dibagikan")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="naskah_dibagikan"
    )
    versi = models.ForeignKey(Versi, on_delete=models.CASCADE)
    dibagikan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["naskah", "user"]
        verbose_name_plural = "naskah dibagikan"


class KartuUlasan(models.Model):
    naskah = models.ForeignKey(Naskah, on_delete=models.CASCADE, related_name="ulasan")
    versi = models.ForeignKey(Versi, on_delete=models.CASCADE)
    penulis = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    favorit = models.TextField()
    membingungkan = models.TextField()
    pertanyaan = models.TextField()
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal"]
        verbose_name_plural = "kartu ulasan"
