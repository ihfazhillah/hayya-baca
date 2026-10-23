"""Musim baru cukup ditambah lewat data (spec 074 §4 Musim).

Musim 2 fiktif dengan alat keenam diimpor; alat itu harus ikut di semua tempat
tanpa perubahan kode.
"""
import json

import pytest

from penerbit import hadiah
from penerbit.impor import impor_folder
from penerbit.models import Alat, HasilMisi, Misi, Stiker

from .base import Keluarga, impor_modul_1_5, selesaikan_modul

MUSIM_2 = {
    "musim": {"nomor": 2, "nama": "Musim Kedua", "genre": "Kisah nyata dari wawancara"},
    "alat": [{
        "kode": "telinga", "nama": "Telinga", "emoji": "👂",
        "pertanyaan": "Apakah dialognya terdengar seperti yang benar-benar diucapkan?",
        "warna": "#0EA5E9", "pola_cetak": "titik", "urutan": 6, "modul_belajar": 17,
        "syarat": {
            "perunggu": {"jenis": "misi_tahap_selesai", "tahap": ["petunjuk"]},
            "perak": {"jenis": "skor_beruntun", "min_rasio": 1.0, "kali": 1, "tanpa_petunjuk": True},
            "emas": {"jenis": "pemeriksa"},
        },
        "syarat_teks": {"perunggu": "a", "perak": "b", "emas": "c"},
    }],
    "pangkat": [],
}

MODUL_17 = {
    "nomor": 17, "musim": 2, "level": 1, "judul": "Telinga", "alat": "telinga",
    "tujuan": "Dialog yang terdengar nyata.",
    "ujian": [{"soal": "?", "a": "a", "b": "b", "jawaban": "a"}],
    "misi": [
        {"urutan": 1, "judul": "Petunjuk", "tahap": "petunjuk", "jenis": "klik",
         "teks": "\"Wahai Ananda, marilah kita makan,\" kata Babah.",
         "kesalahan": [{"cari": "Wahai Ananda"}], "versi_benar": "\"Nak, ayo makan,\" kata Babah."},
        {"urutan": 2, "judul": "Mandiri", "tahap": "mandiri", "jenis": "klik",
         "teks": "\"Saudara Oren, silakan masuk,\" kata Ibu.",
         "kesalahan": [{"cari": "Saudara Oren"}], "versi_benar": "\"Oren, masuk,\" kata Ibu."},
    ],
}


class TestMusimBaruLewatData(Keluarga):
    @pytest.fixture(autouse=True)
    def _tmp(self, tmp_path):
        self.tmp = tmp_path

    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        (self.tmp / "musim.json").write_text(json.dumps(MUSIM_2))
        (self.tmp / "modul-17.json").write_text(json.dumps(MODUL_17))
        impor_folder(self.tmp)
        self.telinga = Alat.objects.get(kode="telinga")

    def test_stiker_alat_baru_dari_syarat_data(self):
        for urutan in (1, 2):
            m = Misi.objects.get(modul__nomor=17, urutan=urutan)
            HasilMisi.objects.create(profil=self.profil, misi=m, status="selesai", benar=1, total=1)
        hadiah.evaluasi(self.profil)
        tingkat = set(Stiker.objects.filter(profil=self.profil, alat=self.telinga)
                      .values_list("tingkat", flat=True))
        assert tingkat == {"perunggu", "perak"}

    def test_alat_baru_tampil_di_kartu_alat_dengan_warna_dari_data(self):
        r = self.anak.get("/api/penerbit/alat/")
        assert r.status_code == 200
        telinga = next(a for a in r.data["alat"] if a["kode"] == "telinga")
        assert telinga["emoji"] == "👂"
        assert telinga["warna"] == "#0EA5E9"
        assert telinga["terbuka"] is False
        assert telinga["modul_belajar"] == 17
        assert [s["tingkat"] for s in telinga["slot"]] == ["perunggu", "perak", "emas"]

    def test_magang_tetap_berdasarkan_musim_pertama(self):
        for alat in Alat.objects.filter(musim__nomor=1):
            hadiah.beri_stiker(self.profil, alat, "perunggu", oleh=self.ayah)
        self.profil.refresh_from_db()
        assert self.profil.pangkat.kode == "magang"


class TestKartuAlat(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()

    def test_alat_terbuka_setelah_modulnya_terbuka_dan_kemajuan(self):
        r = self.anak.get("/api/penerbit/alat/")
        alat = {a["kode"]: a for a in r.data["alat"]}
        assert alat["pengeras"]["terbuka"] is True
        assert alat["kamera"]["terbuka"] is False
        perunggu = alat["pengeras"]["slot"][0]
        assert perunggu["punya"] is False
        assert perunggu["kemajuan"] == {"sekarang": 0, "target": 2}
        assert perunggu["syarat_teks"].startswith("Menemukan kesalahan")
        selesaikan_modul(self.profil, 1)
        selesaikan_modul(self.profil, 2)
        selesaikan_modul(self.profil, 3)
        alat = {a["kode"]: a for a in self.anak.get("/api/penerbit/alat/").data["alat"]}
        assert alat["kamera"]["terbuka"] is True
