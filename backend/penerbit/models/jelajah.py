"""Jelajah (Spec 075 K4): Buat soal untuk Ayah.

Soal milik ProfilPenulis (profil simulasi orang tua terpisah dari anak) dan tidak terikat ke isi
course selain alatnya, jadi re-impor course tidak menghapusnya.
"""
from django.conf import settings
from django.db import models

from .course import Alat
from .progres import ProfilPenulis


class SoalBuatan(models.Model):
    """Teks Si Ceroboh buatan anak. `data` = {"tokens", "kunci", "celah", "kenapa"}, bentuknya
    sama dengan data misi klik supaya penilaiannya memakai `penilaian.nilai_klik`."""

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="soal_buatan")
    alat = models.ForeignKey(Alat, on_delete=models.CASCADE, related_name="+")
    teks = models.TextField()
    data = models.JSONField(default=dict)
    dibuat = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-dibuat", "-id"]
        verbose_name_plural = "soal buatan"


class JawabanSoalBuatan(models.Model):
    """Satu anggota keluarga mengerjakan satu soal (satu kali). Field-nya sama dengan Percobaan
    (ditemukan, diklik, celah, meleset, selesai) supaya `proses_klik` bisa dipakai."""

    soal = models.ForeignKey(SoalBuatan, on_delete=models.CASCADE, related_name="jawaban")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    ditemukan = models.JSONField(default=list)
    diklik = models.JSONField(default=list)
    celah = models.JSONField(default=list)
    meleset = models.PositiveSmallIntegerField(default=0)
    selesai = models.BooleanField(default=False)
    tanggal = models.DateTimeField(auto_now_add=True)
    diubah = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["soal", "user"]
        ordering = ["tanggal", "id"]
        verbose_name_plural = "jawaban soal buatan"
