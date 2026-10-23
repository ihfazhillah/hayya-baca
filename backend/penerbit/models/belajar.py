"""Belajar mandiri (Spec 075): Tanya Ayah atau Ummah dan Kartu Pamer.

Keduanya milik ProfilPenulis, jadi data profil simulasi orang tua tidak tercampur dengan anak.
Tidak terikat ke isi course secara keras: re-impor course tidak menghapusnya.
"""
from django.conf import settings
from django.db import models

from .course import Misi, Modul
from .progres import ProfilPenulis

BATAS_PERTANYAAN = 300


class Pertanyaan(models.Model):
    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="pertanyaan")
    modul = models.ForeignKey(Modul, null=True, blank=True, on_delete=models.SET_NULL)
    misi = models.ForeignKey(Misi, null=True, blank=True, on_delete=models.SET_NULL)
    teks = models.CharField(max_length=BATAS_PERTANYAAN)
    dibuat = models.DateTimeField(auto_now_add=True)
    dijawab_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )
    dijawab_pada = models.DateTimeField(null=True, blank=True)
    catatan = models.TextField(blank=True)

    class Meta:
        ordering = ["-dibuat", "-id"]
        verbose_name_plural = "pertanyaan"


class KartuPamer(models.Model):
    """Penutup modul. Sebelum/sesudah tidak disimpan: dihitung dari misi yang selesai."""

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="kartu_pamer")
    modul = models.ForeignKey(Modul, on_delete=models.CASCADE, related_name="+")
    pelajaran = models.CharField(max_length=300)
    dibuat = models.DateTimeField(auto_now_add=True)
    diubah = models.DateTimeField(auto_now=True)
    reaksi_emoji = models.CharField(max_length=16, blank=True)
    reaksi = models.CharField(max_length=200, blank=True)  # satu kalimat dari orang tua
    reaksi_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )
    reaksi_pada = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["profil", "modul"]
        ordering = ["-diubah", "-id"]
        verbose_name_plural = "kartu pamer"
