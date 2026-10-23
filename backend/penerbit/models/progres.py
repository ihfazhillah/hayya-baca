"""Progres penulis (Spec 074). Semua data terikat ke ProfilPenulis."""
from django.conf import settings
from django.db import models

from .course import Alat, KalimatLatihan, Lembar, Misi, Modul, Pangkat, Tingkat


class ProfilPenulis(models.Model):
    child = models.OneToOneField(
        "accounts.Child", on_delete=models.CASCADE, related_name="profil_penulis"
    )
    nama_panggilan = models.CharField(max_length=60)
    pangkat = models.ForeignKey(Pangkat, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "profil penulis"

    def __str__(self):
        return self.nama_panggilan


class Percobaan(models.Model):
    """Satu percobaan misi atau kalimat latihan yang sedang berjalan (dinilai server per klik)."""

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="percobaan")
    misi = models.ForeignKey(Misi, null=True, blank=True, on_delete=models.CASCADE)
    kalimat = models.ForeignKey(KalimatLatihan, null=True, blank=True, on_delete=models.CASCADE)
    # Latihan campuran: alat yang dipilih anak sebelum mengerjakan.
    alat_dipilih = models.ForeignKey(
        Alat, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    alat_benar = models.BooleanField(default=False)
    ditemukan = models.JSONField(default=list)  # indeks grup kunci yang sudah ketemu
    diklik = models.JSONField(default=list)  # indeks token yang sudah diklik benar
    meleset = models.PositiveSmallIntegerField(default=0)
    pakai_petunjuk = models.BooleanField(default=False)
    selesai = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "percobaan"


class HasilMisi(models.Model):
    """Satu misi yang diselesaikan. Baris terbaru menentukan status misi."""

    class Status(models.TextChoices):
        SELESAI = "selesai", "Selesai"
        MENUNGGU = "menunggu", "Menunggu diperiksa"
        COBA_LAGI = "coba_lagi", "Coba lagi"

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="hasil_misi")
    misi = models.ForeignKey(Misi, on_delete=models.CASCADE, related_name="hasil")
    status = models.CharField(max_length=10, choices=Status.choices)
    benar = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    meleset = models.PositiveSmallIntegerField(default=0)
    pakai_petunjuk = models.BooleanField(default=False)
    log = models.TextField(blank=True)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal", "-id"]
        verbose_name_plural = "hasil misi"


class HasilUjian(models.Model):
    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="hasil_ujian")
    soal = models.ForeignKey("penerbit.SoalUjian", on_delete=models.CASCADE)
    pilihan = models.CharField(max_length=1)
    benar = models.BooleanField()
    tanggal = models.DateTimeField(auto_now_add=True)


class HasilLatihan(models.Model):
    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="hasil_latihan")
    kalimat = models.ForeignKey(KalimatLatihan, on_delete=models.CASCADE)
    alat = models.ForeignKey(Alat, on_delete=models.CASCADE)
    alat_dipilih = models.ForeignKey(
        Alat, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    benar = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal", "-id"]
        verbose_name_plural = "hasil latihan"


class JadwalUlang(models.Model):
    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="jadwal")
    alat = models.ForeignKey(Alat, on_delete=models.CASCADE)
    jatuh_tempo = models.DateField()
    putaran = models.PositiveSmallIntegerField(default=0)  # 0..3 → 1h, 3h, 1mg, 2mg; 4 = sesekali
    terakhir = models.DateField(null=True, blank=True)  # tanggal terakhir dilatih

    class Meta:
        unique_together = ["profil", "alat"]
        verbose_name_plural = "jadwal ulang"


class Stiker(models.Model):
    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="stiker")
    alat = models.ForeignKey(Alat, on_delete=models.CASCADE)
    tingkat = models.CharField(max_length=10, choices=Tingkat.choices)
    diberikan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    catatan = models.TextField(blank=True)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["profil", "alat", "tingkat"]
        ordering = ["-tanggal"]
        verbose_name_plural = "stiker"


class Poin(models.Model):
    """Ledger poin. Total = jumlah baris. kunci_sumber mencegah poin ganda."""

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="poin")
    jumlah = models.IntegerField()
    alasan = models.CharField(max_length=200)
    kunci_sumber = models.CharField(max_length=80)
    diberikan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["profil", "kunci_sumber"]
        ordering = ["-tanggal", "-id"]
        verbose_name_plural = "poin"


class PemeriksaanLembar(models.Model):
    class Status(models.TextChoices):
        MENUNGGU = "menunggu", "Menunggu"
        BAGUS = "bagus", "Sudah bagus"
        COBA_LAGI = "coba_lagi", "Coba lagi"

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="pemeriksaan")
    lembar = models.ForeignKey(Lembar, on_delete=models.CASCADE)
    misi = models.ForeignKey(Misi, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.MENUNGGU)
    catatan = models.TextField(blank=True)
    diperiksa_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    tanggal_cetak = models.DateTimeField(auto_now_add=True)
    tanggal_periksa = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-tanggal_cetak", "-id"]
        verbose_name_plural = "pemeriksaan lembar"


class Hadiah(models.Model):
    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="hadiah")
    nama = models.CharField(max_length=120)
    harga = models.PositiveIntegerField()
    aktif = models.BooleanField(default=True)

    class Meta:
        ordering = ["harga"]
        verbose_name_plural = "hadiah"


class Penukaran(models.Model):
    class Status(models.TextChoices):
        DIAJUKAN = "diajukan", "Diajukan"
        DISETUJUI = "disetujui", "Disetujui"
        DITUNDA = "ditunda", "Nanti dulu"

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="penukaran")
    hadiah = models.ForeignKey(Hadiah, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DIAJUKAN)
    diputuskan_oleh = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal"]
        verbose_name_plural = "penukaran"


class Prompt(models.Model):
    class Bantu(models.TextChoices):
        YA = "ya", "Ya"
        SEDIKIT = "sedikit", "Sedikit"
        TIDAK = "tidak", "Tidak"

    profil = models.ForeignKey(ProfilPenulis, on_delete=models.CASCADE, related_name="prompt")
    modul = models.ForeignKey(Modul, on_delete=models.CASCADE)
    tahap = models.CharField(max_length=10)
    bagian = models.JSONField(default=list)  # 4 string Rumus Bertanya
    teks = models.TextField()
    refleksi_bantu = models.CharField(max_length=10, choices=Bantu.choices, blank=True)
    refleksi_ubah = models.CharField(max_length=300, blank=True)
    catatan_ortu = models.TextField(blank=True)
    tanggal = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tanggal"]
        verbose_name_plural = "prompt"
