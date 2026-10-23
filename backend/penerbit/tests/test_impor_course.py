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

    def test_gunting_contoh_bisa_menyorot_spasi_saja_dan_bantuan_butuh_alasan_potong_pertama(self):
        gunting = dict(jenis="gunting", teks="Oren makan dan dia tidur.",
                       potong=[{"cari": "makan dan dia", "alasan": "Potong di sini."}],
                       versi_benar="Oren makan. Dia tidur.")
        data = modul(**gunting, bantuan_memudar=True,
                     contoh=[{"sorot": [{"cari": "makan dan", "spasi": True}], "pikir": "Aku potong."}])
        data["misi"][0].pop("kesalahan")
        impor_folder(tulis(self.tmp, data))
        d = Misi.objects.get(modul__nomor=91, urutan=1).data
        assert d["contoh"] == [{"sorot": [3], "pikir": "Aku potong."}]  # spasi "makan dan"
        assert d["bantuan_memudar"] is True
        assert d["alasan"] == ["Potong di sini."]
        data["misi"][0]["potong"] = [{"cari": "makan dan dia"}]
        with pytest.raises(CommandError, match="alasan"):
            impor_folder(tulis(self.tmp, data))

    def test_kembar_contoh_dan_bantuan_tahap_bersama_butuh_alasan(self):
        data = modul(jenis="kembar", tahap="bersama", teks="Terus makan. Terus minum. Terus tidur.",
                     kata=["terus"], bantuan_memudar=True, versi_benar="Makan. Lalu minum.",
                     contoh=[{"sorot": [{"cari": "Terus"}, {"cari": "Terus", "ke": 2}],
                              "pikir": "Kata ini muncul lagi."}])
        data["misi"][0].pop("kesalahan")
        with pytest.raises(CommandError, match="alasan"):
            impor_folder(tulis(self.tmp, data))
        data["misi"][0]["alasan"] = "Kata \"terus\" muncul tiga kali."
        impor_folder(tulis(self.tmp, data))
        d = Misi.objects.get(modul__nomor=91, urutan=1).data
        assert d["contoh"] == [{"sorot": [0, 5], "pikir": "Kata ini muncul lagi."}]
        assert d["alasan"] == "Kata \"terus\" muncul tiga kali."
        # Tahap petunjuk: hanya petunjuk hitungan, alasan tidak wajib.
        data["misi"][0].pop("alasan")
        data["misi"][0]["tahap"] = "petunjuk"
        impor_folder(tulis(self.tmp, data))

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


# ---- Kamera: pilih perasaan + klik bukti (spec 075 K1, Fase B) ----------------

def modul_perasaan(**extra):
    misi = {
        "urutan": 1, "judul": "Tebak perasaan", "tahap": "bersama", "jenis": "perasaan",
        "bantuan_memudar": True,
        "contoh": [{"sorot": [{"cari": "Bahunya turun"}], "pikir": "Bahunya turun.",
                    "pilih": "sedih"},
                   {"pikir": "Sekarang giliranmu."}],
        "soal": [
            {"teks": "Oren pulang. Bahunya turun.", "pilihan": ["senang", "sedih", "kaget"],
             "jawaban": "sedih", "bukti": [{"cari": "Bahunya turun"}], "alasan": "Itu sedih."},
            {"teks": "Ibu masuk. Tangannya mengepal. Dia membanting pintu.",
             "pilihan": ["marah", "senang"], "jawaban": "marah",
             "bukti": [{"cari": "Tangannya mengepal"}, {"cari": "membanting pintu"}],
             "alasan": "Itu marah."},
        ],
    }
    misi.update(extra)
    data = modul()
    data["misi"][0] = misi
    return data


class TestImporPerasaan(TestCase):
    @pytest.fixture(autouse=True)
    def _tmp(self, tmp_path):
        self.tmp = tmp_path

    def test_soal_perasaan_bukti_jadi_indeks_kata_dan_contoh_memilih(self):
        impor_folder(tulis(self.tmp, modul_perasaan()))
        m = Misi.objects.get(modul__nomor=91, urutan=1)
        assert m.jenis == "perasaan"
        s0, s1 = m.data["soal"]
        assert [t["t"] for t in s1["tokens"]][:3] == ["Ibu", " ", "masuk"]
        # Hanya token kata di dalam bukti: "Tangannya mengepal" = 5 dan 7, "membanting pintu" = 12, 14.
        assert s1["bukti"] == [[5, 7], [12, 14]]
        assert (s1["jawaban"], s1["pilihan"], s1["alasan"]) == ("marah", ["marah", "senang"], "Itu marah.")
        assert "teks" not in s1
        assert m.data["contoh"][0] == {"sorot": [5, 6, 7], "pikir": "Bahunya turun.", "pilih": "sedih"}
        assert m.data["contoh"][1] == {"sorot": [], "pikir": "Sekarang giliranmu.", "pilih": None}
        assert m.label_tahap() == "Contoh dari Oren"

    def test_jawaban_harus_salah_satu_pilihan(self):
        data = modul_perasaan()
        data["misi"][0]["soal"][1]["jawaban"] = "takut"
        with pytest.raises(CommandError, match="misi 1: soal 2: jawaban"):
            impor_folder(tulis(self.tmp, data))

    def test_bukti_harus_ada_di_teks_dan_berisi_kata(self):
        data = modul_perasaan()
        data["misi"][0]["soal"][1]["bukti"] = [{"cari": "menangis"}]
        with pytest.raises(CommandError, match="soal 2"):
            impor_folder(tulis(self.tmp, data))
        data["misi"][0]["soal"][1]["bukti"] = []
        with pytest.raises(CommandError, match="soal 2: tanpa bukti"):
            impor_folder(tulis(self.tmp, data))

    def test_pilihan_contoh_harus_jawaban_soal_pertama(self):
        data = modul_perasaan()
        data["misi"][0]["contoh"][0]["pilih"] = "kaget"
        with pytest.raises(CommandError, match="contoh"):
            impor_folder(tulis(self.tmp, data))

    def test_bantuan_memudar_butuh_alasan_dan_contoh_butuh_soal_kedua(self):
        data = modul_perasaan()
        data["misi"][0]["soal"][1]["alasan"] = ""
        with pytest.raises(CommandError, match="alasan"):
            impor_folder(tulis(self.tmp, data))
        data = modul_perasaan()
        data["misi"][0]["soal"] = data["misi"][0]["soal"][:1]
        with pytest.raises(CommandError, match="soal"):
            impor_folder(tulis(self.tmp, data))


def _kalimat_anak(data):
    """Semua kalimat yang dibaca anak di satu file modul (panduan bahasa, spec 075 K5)."""
    out = [data["judul"], data["tujuan"], data.get("kenapa", ""), data.get("mengapa", "")]
    out += data.get("langkah", []) + data.get("resep", [])
    out += [k["arti"] for k in data.get("kamus", [])]
    for u in data.get("ujian", []):
        out += [u["soal"], u["a"], u["b"], u.get("alasan", "")]
    if data.get("bertanya"):
        b = data["bertanya"]
        out += [b["a"], b["b"], b.get("penjelasan", "")]
    for lb in data.get("lembar", []):
        out += [lb["judul"], lb["petunjuk"], lb.get("pertanyaan_bantu", ""),
                lb.get("contoh_jawaban", "")] + lb.get("cek_sendiri", [])
    for m in data["misi"]:
        out += [m["judul"], m.get("petunjuk", ""), m.get("kenapa", ""), m.get("pertanyaan", "")]
        out += m.get("langkah", [])
        if isinstance(m.get("contoh"), str):
            out.append(m["contoh"])
        else:
            out += [x["pikir"] for x in m.get("contoh", [])]
        out += [k.get("alasan", "") for k in m.get("kesalahan", [])]
        out += [s["teks"] for s in m.get("soal", [])] + [s["alasan"] for s in m.get("soal", [])]
    return [t for t in out if t]


class TestIsiModul4dan5(TestCase):
    """Fase B: Kamera dan Kaca Pembesar tanpa misi "Bersama Ayah"."""

    def setUp(self):
        impor_folder(ISI)

    def test_modul_4_misi_1_pilih_perasaan_dengan_contoh_oren(self):
        m = Misi.objects.get(modul__nomor=4, urutan=1)
        assert (m.jenis, m.tahap) == ("perasaan", "bersama")  # Perunggu tetap misi 1 + 2
        assert m.label_tahap() == "Contoh dari Oren"
        assert 3 <= len(m.data["soal"]) <= 5
        assert m.data["bantuan_memudar"] is True
        assert any(x["pilih"] for x in m.data["contoh"])
        assert "Ayah" not in m.petunjuk and "Ayah" not in m.judul
        assert m.data["petunjuk_ortu"].startswith("Tujuannya")

    def test_modul_4_tebak_gaya_jadi_bonus_terakhir(self):
        misi = list(Misi.objects.filter(modul__nomor=4).order_by("urutan"))
        terakhir = misi[-1]
        assert terakhir.judul == "Tebak gaya"
        assert (terakhir.tahap, terakhir.jenis) == ("bonus", "tandai")
        assert terakhir.data["petunjuk_ortu"].startswith("Tujuannya")
        # Urutan misi lain tidak bergeser (progres yang sudah ada tetap di misi yang sama).
        assert [m.judul for m in misi[1:5]] == [
            "Oren lapar", "Ibu marah, Oren senang", "Tubuh yang kesal", "Tiga cara ngantuk"]

    def test_modul_5_misi_1_contoh_oren_tiga_kalimat(self):
        m = Misi.objects.get(modul__nomor=5, urutan=1)
        assert (m.jenis, m.tahap) == ("klik", "bersama")
        assert m.label_tahap() == "Contoh dari Oren"
        assert m.data["celah"] is True and m.data["bantuan_memudar"] is True
        assert len(m.data["kunci"]) == 3 and all(m.data["alasan"])
        assert any(x["sorot"] for x in m.data["contoh"])
        assert "Ayah" not in m.petunjuk

    def test_bahasa_modul_4_dan_5_untuk_anak_8_tahun(self):
        from penerbit.teks import kalimat_teks

        panjang = []
        for nama in ("modul-04.json", "modul-05.json"):
            for teks in _kalimat_anak(json.loads((ISI / nama).read_text())):
                panjang += [k for k in kalimat_teks(teks) if len(k.split()) > 15]
        assert panjang == []


class TestIsiModul2dan3(TestCase):
    """Fase B: Gunting dan Detektor Kembar tanpa misi \"Bersama Ayah\"."""

    def setUp(self):
        impor_folder(ISI)

    def test_modul_2_3_misi_1_contoh_dari_oren_tanpa_ayah(self):
        for nomor in (2, 3):
            m = Misi.objects.get(modul__nomor=nomor, urutan=1)
            assert m.tahap == "bersama", m
            assert m.label_tahap() == "Contoh dari Oren", m
            assert m.data["bantuan_memudar"] is True, m
            assert len(m.data["contoh"]) >= 3, m
            assert any(x["sorot"] for x in m.data["contoh"]), m
            assert "Ayah" not in m.petunjuk and "Ayah" not in m.judul, m
            assert m.data["petunjuk_ortu"].startswith("Tujuannya"), m
            assert "Kalau dia bertanya" in m.data["petunjuk_ortu"], m
        gunting = Misi.objects.get(modul__nomor=2, urutan=1)
        assert gunting.data["alasan"][0]
        # Contoh Gunting menyorot celah tempat Oren memotong.
        spasi = {t["i"] for t in gunting.data["tokens"] if t["j"] == "spasi"}
        assert any(x["sorot"] and set(x["sorot"]) <= spasi for x in gunting.data["contoh"])
        kembar = Misi.objects.get(modul__nomor=3, urutan=1)
        assert kembar.data["alasan"]
        assert "pengganti" not in kembar.petunjuk  # tidak ada tempatnya di layar

    def test_gunting_modul_2_bisa_didengar(self):
        for urutan in (1, 2, 3):
            assert Misi.objects.get(modul__nomor=2, urutan=urutan).data.get("suara") is True

    def test_kembar_modul_3_punya_versi_benar(self):
        for m in Misi.objects.filter(modul__nomor=3, jenis="kembar"):
            assert m.data.get("versi_benar"), m

    def test_bahasa_anak_modul_2_3(self):
        """Panduan bahasa 8 tahun: semua kalimat untuk anak ≤ 15 kata; gelembung Oren,
        alasan, dan petunjuk misi ≤ 12 kata."""
        import json as _json

        from penerbit.teks import kalimat_teks

        def kalimat_panjang(teks, maks):
            return [k for k in kalimat_teks(teks) if len(k.split()) > maks]

        terlalu = []
        for nomor in (2, 3):
            d = _json.loads((ISI / f"modul-0{nomor}.json").read_text())
            umum = [d["judul"], d["tujuan"], d["kenapa"], d["mengapa"], *d["langkah"], *d["resep"],
                    *[k["arti"] for k in d["kamus"]]]
            for u in d["ujian"]:
                umum += [u["soal"], u["a"], u["b"], u.get("alasan", "")]
            if d.get("bertanya"):
                umum += [d["bertanya"]["a"], d["bertanya"]["b"], d["bertanya"]["penjelasan"]]
            for lb in d["lembar"]:
                umum += [lb["judul"], lb["petunjuk"], lb.get("pertanyaan_bantu", ""),
                         *lb.get("cek_sendiri", []), lb.get("contoh_jawaban", "")]
            pendek = []
            for m in d["misi"]:
                umum += [m["judul"], m.get("kenapa", ""), *m.get("langkah", []),
                         m.get("pertanyaan", ""), m.get("versi_benar", "")]
                pendek.append(m.get("petunjuk", ""))
                if isinstance(m.get("contoh"), str):
                    umum.append(m["contoh"])
                else:
                    pendek += [x["pikir"] for x in m.get("contoh", [])]
                pendek += [p.get("alasan", "") for p in m.get("potong", [])]
                if isinstance(m.get("alasan"), str):
                    pendek.append(m["alasan"])
            terlalu += [(nomor, k) for t in umum for k in kalimat_panjang(t, 15)]
            terlalu += [(nomor, k) for t in pendek for k in kalimat_panjang(t, 12)]
        assert terlalu == []
