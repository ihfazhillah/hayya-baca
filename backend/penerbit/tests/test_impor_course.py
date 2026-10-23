"""impor_course: format JSON → database (course/schema.md)."""
import json
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command
from django.test import TestCase

from penerbit.impor import impor_folder
from penerbit.models import Alat, Lembar, Misi, Modul

MUSIM = {
    "musim": {"nomor": 9, "nama": "Uji"},
    "alat": [{
        "kode": "uji", "nama": "Alat Uji", "emoji": "🧪", "pertanyaan": "?",
        "warna": "--color-actor-1", "pola_cetak": "titik", "urutan": 1, "modul_belajar": 91,
        "syarat": {"perunggu": {"jenis": "pemeriksa"}, "perak": {"jenis": "pemeriksa"},
                   "emas": {"jenis": "pemeriksa"}},
        "syarat_teks": {"perunggu": "a", "perak": "b", "emas": "c"},
    }],
    "pangkat": [],
}


def modul(**misi_extra):
    misi = {"urutan": 1, "judul": "Uji", "tahap": "petunjuk", "jenis": "klik",
            "teks": "Dia di di rumah.", "kesalahan": [{"cari": "di di"}],
            "versi_benar": "Dia di rumah."}
    misi.update(misi_extra)
    return {
        "nomor": 91, "musim": 9, "level": 1, "judul": "Modul Uji", "alat": "uji",
        "tujuan": "uji", "ujian": [], "lembar": [
            {"kode": "U-1", "judul": "Lembar uji", "petunjuk": "Tulis."}
        ],
        "misi": [misi, {"urutan": 2, "judul": "Cetak", "tahap": "mandiri",
                        "jenis": "cetak", "lembar": "U-1"}],
    }


def tulis(folder, data_modul, musim=MUSIM):
    (folder / "musim.json").write_text(json.dumps(musim))
    (folder / "modul-91.json").write_text(json.dumps(data_modul))
    return folder


class TestImpor(TestCase):
    @pytest.fixture(autouse=True)
    def _tmp(self, tmp_path):
        self.tmp = tmp_path

    def test_impor_dan_kunci_jadi_indeks_token(self):
        impor_folder(tulis(self.tmp, modul()))
        m = Misi.objects.get(modul__nomor=91, urutan=1)
        assert [t["t"] for t in m.data["tokens"]][:5] == ["Dia", " ", "di", " ", "di"]
        assert m.data["kunci"] == [[{"token": [2, 3, 4], "celah": None}]]
        assert "kesalahan" not in m.data
        assert Misi.objects.get(modul__nomor=91, urutan=2).lembar.kode == "U-1"

    def test_impor_ulang_memperbarui_tanpa_duplikat(self):
        impor_folder(tulis(self.tmp, modul()))
        impor_folder(tulis(self.tmp, modul(judul="Judul baru")))
        assert Misi.objects.filter(modul__nomor=91).count() == 2
        assert Misi.objects.get(modul__nomor=91, urutan=1).judul == "Judul baru"
        assert Modul.objects.filter(nomor=91).count() == 1
        assert Lembar.objects.filter(kode="U-1").count() == 1
        assert Alat.objects.filter(kode="uji").count() == 1

    def test_kunci_yang_tidak_ada_menggagalkan_seluruh_impor(self):
        with pytest.raises(CommandError, match="modul-91.json misi 1"):
            impor_folder(tulis(self.tmp, modul(kesalahan=[{"cari": "tidak ada"}])))
        assert not Modul.objects.filter(nomor=91).exists()

    def test_jumlah_harus_cocok(self):
        with pytest.raises(CommandError, match="jumlah"):
            impor_folder(tulis(self.tmp, modul(jumlah=3)))

    def test_celah_tepi_hanya_celah_celah_tengah_terima_tanda(self):
        impor_folder(tulis(self.tmp, modul(
            teks="keluar.cacing itu jahat",
            kesalahan=[{"cari": ".|cacing"}, {"cari": "jahat|"}],
        )))
        kunci = Misi.objects.get(modul__nomor=91, urutan=1).data["kunci"]
        assert kunci[0] == [{"token": [1], "celah": 2}]  # "." boleh diklik, "cacing" tidak
        assert kunci[1] == [{"token": [], "celah": 7}]

    def test_gunting_potong_jadi_indeks_spasi(self):
        impor_folder(tulis(self.tmp, modul(
            jenis="gunting", teks="Oren makan dan dia tidur.",
            kesalahan=None, potong=[{"cari": "makan dan dia"}], boleh=[],
        )))
        data = Misi.objects.get(modul__nomor=91, urutan=1).data
        assert data["potong"] == [[3, 5]]

    def test_lembar_yang_tidak_ada(self):
        m = modul()
        m["misi"][1]["lembar"] = "X-9"
        with pytest.raises(CommandError, match="X-9"):
            impor_folder(tulis(self.tmp, m))

    def test_perintah_manage(self):
        call_command("impor_course", str(tulis(self.tmp, modul())))
        assert Modul.objects.filter(nomor=91).exists()


ISI = Path(__file__).resolve().parent.parent / "course" / "musim-1"


class TestIsiCourseMusim1(TestCase):
    """Isi asli: semua kunci valid dan sesuai Roadmap."""

    def setUp(self):
        impor_folder(ISI)

    def test_lima_alat_dengan_syarat_lengkap(self):
        alat = list(Alat.objects.order_by("urutan"))
        assert [a.kode for a in alat] == ["pengeras", "gunting", "kembar", "kamera", "kaca"]
        for a in alat:
            assert set(a.syarat) == {"perunggu", "perak", "emas"}
            assert set(a.syarat_teks) == {"perunggu", "perak", "emas"}

    def test_modul_1_teks_si_ceroboh_empat_kesalahan_dengan_kunci_ganda(self):
        m = Misi.objects.get(modul__nomor=1, urutan=1)
        assert len(m.data["kunci"]) == 4
        assert len(m.data["kunci"][3]) == 2  # "nanti" pertama atau kedua

    def test_modul_5_cacing_delapan_kesalahan(self):
        m = Misi.objects.get(modul__nomor=5, urutan=5)
        assert len(m.data["kunci"]) == 8
        assert m.data["celah"] is True

    def test_setiap_modul_punya_ujian_dan_misi(self):
        for modul_ in Modul.objects.all():
            assert modul_.ujian.count() >= 1, modul_
            assert 3 <= modul_.misi.count() <= 7, modul_

    def test_misi_cetak_selalu_punya_lembar(self):
        for m in Misi.objects.filter(jenis="cetak"):
            assert m.lembar_id, m
