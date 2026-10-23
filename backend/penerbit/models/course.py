"""Isi course (Spec 074): ditulis di JSON, diimpor lewat `impor_course`.

Semua yang berbeda per alat (warna, emoji, pola cetak, syarat stiker) disimpan
sebagai data, supaya musim baru cukup ditambah lewat JSON tanpa mengubah kode.
"""
from django.db import models


class Musim(models.Model):
    nomor = models.PositiveSmallIntegerField(unique=True)
    nama = models.CharField(max_length=100)
    genre = models.CharField(max_length=200, blank=True)
    deskripsi = models.TextField(blank=True)

    class Meta:
        ordering = ["nomor"]
        verbose_name_plural = "musim"

    def __str__(self):
        return f"Musim {self.nomor}: {self.nama}"


class Tingkat(models.TextChoices):
    PERUNGGU = "perunggu", "Perunggu"
    PERAK = "perak", "Perak"
    EMAS = "emas", "Emas"


class Alat(models.Model):
    kode = models.SlugField(max_length=30, unique=True)
    nama = models.CharField(max_length=60)
    emoji = models.CharField(max_length=16)
    pertanyaan = models.CharField(max_length=200)
    cara_pakai = models.CharField(max_length=300, blank=True)
    contoh_sebelum = models.CharField(max_length=300, blank=True)
    contoh_sesudah = models.CharField(max_length=300, blank=True)
    # Token warna dari shared.css (mis. "--color-actor-1") atau hex.
    warna = models.CharField(max_length=40)
    # Pola sorotan saat dicetak hitam putih: gelombang|putus|lingkaran|tebal|titik
    pola_cetak = models.CharField(max_length=20)
    urutan = models.PositiveSmallIntegerField(default=0)
    musim = models.ForeignKey(Musim, on_delete=models.PROTECT, related_name="alat")
    # Nomor modul tempat alat ini dipelajari ("Terbuka di Modul 4").
    modul_belajar = models.PositiveSmallIntegerField()
    # {"perunggu": {...}, "perak": {...}, "emas": {...}} — lihat hadiah.py
    syarat = models.JSONField(default=dict)
    # Kalimat syarat dalam bahasa anak, per tingkat.
    syarat_teks = models.JSONField(default=dict)

    class Meta:
        ordering = ["urutan"]
        verbose_name_plural = "alat"

    def __str__(self):
        return self.nama


class Pangkat(models.Model):
    kode = models.SlugField(max_length=30, unique=True)
    nama = models.CharField(max_length=60)
    urutan = models.PositiveSmallIntegerField()
    # {"jenis": "perunggu_semua"} atau {"jenis": "buku_terbit", "jumlah": 3}
    syarat = models.JSONField(default=dict)
    syarat_teks = models.CharField(max_length=200, blank=True)
    hak_istimewa = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["urutan"]
        verbose_name_plural = "pangkat"

    def __str__(self):
        return self.nama


class TahapMentor(models.TextChoices):
    TANPA = "tanpa", "Tanpa AI"
    CONTOH = "contoh", "Contoh"
    ISIAN = "isian", "Isian"
    MANDIRI = "mandiri", "Mandiri"


class Modul(models.Model):
    nomor = models.PositiveSmallIntegerField(unique=True)
    musim = models.ForeignKey(Musim, on_delete=models.PROTECT, related_name="modul")
    level = models.PositiveSmallIntegerField()
    judul = models.CharField(max_length=100)
    tujuan = models.CharField(max_length=300)
    emoji = models.CharField(max_length=16, blank=True)
    kenapa = models.TextField(blank=True)
    langkah = models.JSONField(default=list)
    resep = models.JSONField(default=list)
    mengapa = models.TextField(blank=True)
    kamus = models.JSONField(default=list)  # [{"istilah", "arti"}]
    alat = models.ForeignKey(
        Alat, null=True, blank=True, on_delete=models.PROTECT, related_name="modul"
    )
    # Lapis revisi untuk Level 3 (kode stempel: peta|kamera|gunting|kaca|pembaca|bengkel|terbit)
    lapis = models.CharField(max_length=20, blank=True)
    tahap_mentor = models.CharField(
        max_length=10, choices=TahapMentor.choices, default=TahapMentor.TANPA
    )
    kartu_prompt = models.TextField(blank=True)
    petunjuk_lihat = models.TextField(blank=True)

    class Meta:
        ordering = ["nomor"]
        verbose_name_plural = "modul"

    def __str__(self):
        return f"Modul {self.nomor}: {self.judul}"


class Misi(models.Model):
    class Tahap(models.TextChoices):
        BERSAMA = "bersama", "Bersama orang tua"
        PETUNJUK = "petunjuk", "Dengan petunjuk"
        MANDIRI = "mandiri", "Tanpa petunjuk"
        DUNIA_NYATA = "dunia_nyata", "Dunia nyata"
        BONUS = "bonus", "Bonus"

    class Jenis(models.TextChoices):
        TANDAI = "tandai", "Tandai selesai"
        KLIK = "klik", "Klik kesalahan"
        GUNTING = "gunting", "Gunting"
        KEMBAR = "kembar", "Detektor Kembar"
        CETAK = "cetak", "Lembar cetak"
        LOG = "log", "LOG singkat"
        PERASAAN = "perasaan", "Pilih perasaan"

    modul = models.ForeignKey(Modul, on_delete=models.CASCADE, related_name="misi")
    urutan = models.PositiveSmallIntegerField()
    judul = models.CharField(max_length=120)
    tahap = models.CharField(max_length=12, choices=Tahap.choices)
    jenis = models.CharField(max_length=10, choices=Jenis.choices)
    petunjuk = models.TextField(blank=True)
    # Lihat course/schema.md. Untuk klik/gunting/kembar berisi teks, token dan kunci.
    data = models.JSONField(default=dict)
    lembar = models.ForeignKey(
        "Lembar", null=True, blank=True, on_delete=models.SET_NULL, related_name="misi"
    )

    class Meta:
        ordering = ["modul__nomor", "urutan"]
        unique_together = ["modul", "urutan"]
        verbose_name_plural = "misi"

    def __str__(self):
        return f"{self.modul.nomor}.{self.urutan} {self.judul}"

    def label_tahap(self):
        """Label tahap untuk anak. Misi dengan Contoh dari Oren (spec 075) tetap bertahap
        `bersama` (syarat stiker), tetapi anak mengerjakannya tanpa orang tua."""
        if self.jenis in (self.Jenis.KLIK, self.Jenis.GUNTING, self.Jenis.KEMBAR) \
                and self.data.get("contoh"):
            return "Contoh dari Oren"
        if self.jenis == self.Jenis.PERASAAN and self.data.get("contoh"):
            return "Contoh dari Oren"
        return self.get_tahap_display()


class SoalUjian(models.Model):
    modul = models.ForeignKey(Modul, on_delete=models.CASCADE, related_name="ujian")
    urutan = models.PositiveSmallIntegerField()
    soal = models.CharField(max_length=300)
    pilihan_a = models.CharField(max_length=300)
    pilihan_b = models.CharField(max_length=300)
    jawaban = models.CharField(max_length=1, choices=[("a", "A"), ("b", "B")])
    alasan = models.TextField(blank=True)

    class Meta:
        ordering = ["modul__nomor", "urutan"]
        unique_together = ["modul", "urutan"]
        verbose_name_plural = "soal ujian"


class KalimatLatihan(models.Model):
    """Bank kalimat Latihan Harian: satu kalimat, satu alat."""

    kode = models.SlugField(max_length=40, unique=True)
    alat = models.ForeignKey(Alat, on_delete=models.CASCADE, related_name="kalimat")
    jenis = models.CharField(max_length=10, choices=Misi.Jenis.choices)
    data = models.JSONField(default=dict)

    class Meta:
        ordering = ["alat__urutan", "kode"]
        verbose_name_plural = "kalimat latihan"


class Lembar(models.Model):
    kode = models.CharField(max_length=20, unique=True)  # mis. "M4-3"
    modul = models.ForeignKey(Modul, on_delete=models.CASCADE, related_name="lembar")
    judul = models.CharField(max_length=120)
    petunjuk = models.TextField()
    soal = models.TextField(blank=True)
    baris_tulis = models.PositiveSmallIntegerField(default=6)
    pertanyaan_bantu = models.TextField(blank=True)
    cek_sendiri = models.JSONField(default=list)
    kriteria = models.TextField(blank=True)
    contoh_jawaban = models.TextField(blank=True)
    saran_stiker = models.TextField(blank=True)

    class Meta:
        ordering = ["kode"]
        verbose_name_plural = "lembar"

    def __str__(self):
        return self.kode


class SoalBertanya(models.Model):
    """Latihan Bertanya (modul 1–9): mana pertanyaan yang lebih baik?"""

    modul = models.OneToOneField(Modul, on_delete=models.CASCADE, related_name="bertanya")
    pilihan_a = models.TextField()
    pilihan_b = models.TextField()
    jawaban = models.CharField(max_length=1, choices=[("a", "A"), ("b", "B")])
    # Bagian Rumus Bertanya (1..4) yang ada di jawaban yang benar.
    bagian = models.JSONField(default=list)
    penjelasan = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "soal bertanya"
