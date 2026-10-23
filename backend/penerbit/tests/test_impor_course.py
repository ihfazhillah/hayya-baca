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
            teks="keluar.cacing itu jahat", celah=True,
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

    def test_kesalahan_tanpa_kata_butuh_mode_celah(self):
        # Tanpa celah: spasi tidak bisa diklik dan tanda baca tidak bisa diklik → misi mustahil.
        data = modul(teks="Dia di rumah .", kesalahan=[{"cari": " ."}], versi_benar="Dia di rumah.")
        with pytest.raises(CommandError, match="tidak bisa diklik"):
            impor_folder(tulis(self.tmp, data))
        data = modul(teks="Dia di rumah .", kesalahan=[{"cari": " ."}], celah=True,
                     versi_benar="Dia di rumah.")
        impor_folder(tulis(self.tmp, data))

    def test_rekam_hanya_dari_misi_yang_punya_versi_benar(self):
        data = modul()
        data["misi"].append({"urutan": 3, "judul": "Rekam", "tahap": "bonus", "jenis": "tandai",
                             "rekam": {"dari_misi": [2]}})
        with pytest.raises(CommandError, match="misi 3: rekam"):
            impor_folder(tulis(self.tmp, data))
        data["misi"][2]["rekam"] = {"dari_misi": [1]}
        impor_folder(tulis(self.tmp, data))

    def test_kembar_kata_terbanyak_harus_diterima(self):
        data = modul(jenis="kembar", teks="Oren makan. Oren minum. Lalu Oren tidur. Lalu pulang.",
                     kata=["lalu"])
        data["misi"][0].pop("kesalahan")
        with pytest.raises(CommandError, match="oren"):
            impor_folder(tulis(self.tmp, data))

    def test_contoh_oren_sorotan_jadi_indeks_token_dan_alasan_tersimpan(self):
        impor_folder(tulis(self.tmp, modul(
            bantuan_memudar=True,
            kesalahan=[{"cari": "di di", "alasan": "Kata \"di\" ada dua."}],
            contoh=[{"sorot": [{"cari": "di di"}], "pikir": "Lidahku tersandung di sini."},
                    {"pikir": "Sekarang giliranmu."}],
        )))
        data = Misi.objects.get(modul__nomor=91, urutan=1).data
        assert data["contoh"] == [{"sorot": [2, 3, 4], "pikir": "Lidahku tersandung di sini."},
                                  {"sorot": [], "pikir": "Sekarang giliranmu."}]
        assert data["bantuan_memudar"] is True
        assert data["alasan"] == ["Kata \"di\" ada dua."]

    def test_sorotan_contoh_harus_ada_di_teks(self):
        with pytest.raises(CommandError, match="misi 1: contoh"):
            impor_folder(tulis(self.tmp, modul(
                contoh=[{"sorot": [{"cari": "tidak ada"}], "pikir": "Hmm."}])))
        with pytest.raises(CommandError, match="pikir"):
            impor_folder(tulis(self.tmp, modul(contoh=[{"sorot": [{"cari": "di di"}]}])))

    def test_bantuan_memudar_butuh_alasan_di_setiap_kesalahan(self):
        with pytest.raises(CommandError, match="alasan"):
            impor_folder(tulis(self.tmp, modul(bantuan_memudar=True)))

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

    def test_misi_di_luar_layar_punya_langkah_dan_tujuan(self):
        for m in Misi.objects.filter(jenis__in=["tandai", "log"]):
            assert m.data.get("kenapa") and len(m.data.get("langkah", [])) >= 3, m
            assert m.data.get("petunjuk_ortu", "").startswith("Tujuannya"), m
            if m.jenis == "log":
                assert m.data.get("contoh"), m

    def test_misi_cetak_selalu_punya_lembar(self):
        for m in Misi.objects.filter(jenis="cetak"):
            assert m.lembar_id, m

    def test_modul_1_misi_1_contoh_dari_oren_tanpa_ayah(self):
        m = Misi.objects.get(modul__nomor=1, urutan=1)
        assert m.tahap == "bersama"  # stiker Perunggu tetap dari misi 1 + 2
        assert m.data["bantuan_memudar"] is True
        assert len(m.data["contoh"]) >= 2
        assert any(langkah["sorot"] for langkah in m.data["contoh"])
        assert len(m.data["alasan"]) == len(m.data["kunci"]) and all(m.data["alasan"])
        assert "Ayah" not in m.petunjuk and "Ayah" not in m.judul
        # Bahasa untuk anak 8 tahun: kalimat pendek.
        from penerbit.teks import kalimat_teks
        for teks in [x["pikir"] for x in m.data["contoh"]] + m.data["alasan"] + [m.petunjuk]:
            for k in kalimat_teks(teks):
                assert len(k.split()) <= 12, k
