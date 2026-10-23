"""Jelajah (spec 075 K4): Ruang Latihan per alat dan Misi Jelajah (pilih 1 dari 3 tantangan)."""
from penerbit import hadiah
from penerbit.impor import ubah_data_soal
from penerbit.jadwal import hari_ini
from penerbit.models import Alat, HasilLatihan, HasilMisi, JadwalUlang, KalimatLatihan, Misi

from .base import Keluarga, impor_modul_1_5, selesaikan_modul


class DasarRuang(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        self.pengeras = Alat.objects.get(kode="pengeras")
        self.gunting = Alat.objects.get(kode="gunting")
        for i in range(4):
            KalimatLatihan.objects.create(
                kode=f"pengeras-{i}", alat=self.pengeras, jenis="klik",
                data=ubah_data_soal("klik", {
                    "teks": f"Oren makan makan ikan {i}.", "kesalahan": [{"cari": "makan makan"}],
                    "versi_benar": f"Oren makan ikan {i}.",
                }),
            )
        KalimatLatihan.objects.create(
            kode="gunting-0", alat=self.gunting, jenis="gunting",
            data=ubah_data_soal("gunting", {
                "teks": "Oren makan dan dia tidur.", "potong": [{"cari": "makan dan dia"}],
            }),
        )

    def ruang(self, kode="pengeras"):
        return self.anak.get(f"/api/penerbit/alat/{kode}/latihan/")

    def jawab_benar(self, kartu_id):
        k = KalimatLatihan.objects.get(id=kartu_id)
        token = k.data["kunci"][0][0]["token"][0]
        return self.anak.post(f"/api/penerbit/latihan/{k.id}/klik/", {"token": token},
                              format="json")


class TestRuangLatihan(DasarRuang):
    def test_alat_tanpa_perunggu_terkunci(self):
        r = self.ruang()
        assert r.status_code == 403
        assert "Perunggu" in r.data["detail"]
        assert self.ruang("tidak-ada").status_code == 404

    def test_semua_teks_alat_itu_saja_yang_belum_dicoba_lebih_dulu(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        d = self.ruang().data
        assert d["alat"]["kode"] == "pengeras"
        assert (d["dicoba"], d["jumlah"]) == (0, 4)
        assert [k["kode"] for k in d["kartu"]] == ["pengeras-0", "pengeras-1", "pengeras-2",
                                                    "pengeras-3"]
        assert "kunci" not in d["kartu"][0] and d["kartu"][0]["tokens"]
        assert d["perak"]["punya"] is False and d["perak"]["syarat_teks"]
        assert d["perak"]["kemajuan"] == {"sekarang": 0, "target": 2}

        r = self.jawab_benar(d["kartu"][0]["id"])
        assert r.data["selesai"] is True
        d = self.ruang().data
        assert d["dicoba"] == 1
        # Yang sudah dicoba pindah ke belakang; yang belum dicoba didahulukan.
        assert [k["kode"] for k in d["kartu"]][-1] == "pengeras-0"
        assert d["kartu"][-1]["dicoba"] is True and d["kartu"][0]["dicoba"] is False
        assert d["perak"]["kemajuan"] == {"sekarang": 1, "target": 2}

    def test_teks_baru_dari_ruang_latihan_memberi_perak(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        kartu = self.ruang().data["kartu"]
        self.jawab_benar(kartu[0]["id"])
        r = self.jawab_benar(kartu[1]["id"])
        assert any(h["jenis"] == "stiker" and h["tingkat"] == "perak" for h in r.data["hadiah_baru"])
        assert self.ruang().data["perak"]["punya"] is True

    def test_setelah_semua_dicoba_diulang_dari_yang_paling_jarang(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        for k in self.ruang().data["kartu"]:
            self.jawab_benar(k["id"])
        d = self.ruang().data
        assert d["dicoba"] == 4
        self.jawab_benar(d["kartu"][0]["id"])  # pengeras-0 dicoba dua kali
        assert self.ruang().data["kartu"][0]["kode"] == "pengeras-1"
        assert HasilLatihan.objects.filter(profil=self.profil).count() == 5

    def test_ruang_latihan_tidak_memajukan_jadwal_pemanasan(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        JadwalUlang.objects.filter(profil=self.profil).update(jatuh_tempo=hari_ini())
        # Pemanasan hari ini: pengeras-0..2. pengeras-3 hanya dari Ruang Latihan.
        k3 = next(k for k in self.ruang().data["kartu"] if k["kode"] == "pengeras-3")
        self.jawab_benar(k3["id"])
        j = JadwalUlang.objects.get(profil=self.profil, alat=self.pengeras)
        assert (j.putaran, j.jatuh_tempo) == (0, hari_ini())
        # Kartu pemanasan hari ini tetap memajukan jadwal, dari mana pun dikerjakan.
        kartu = self.anak.get("/api/penerbit/latihan/").data["kartu"]
        self.jawab_benar(kartu[0]["id"])
        j.refresh_from_db()
        assert j.putaran == 1


class TestMisiJelajah(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        self.misi = Misi.objects.get(modul__nomor=1, urutan=5)
        self.url = f"/api/penerbit/misi/{self.misi.id}/"

    def judul_pilihan(self, i):
        return self.misi.data["pilihan"][i]["judul"]

    def test_tiga_tantangan_rekam_memakai_teks_yang_sudah_dibetulkan(self):
        d = self.anak.get(self.url).data
        assert len(d["pilihan"]) == 3 and d["dipilih"] is None
        rekam = next(p for p in d["pilihan"] if p["judul"] == "Rekam suaramu")
        assert "rekam" not in rekam and rekam["teks_rekam"] == []
        m1 = Misi.objects.get(modul__nomor=1, urutan=1)
        HasilMisi.objects.create(profil=self.profil, misi=m1, status="selesai")
        rekam = next(p for p in self.anak.get(self.url).data["pilihan"]
                     if p["judul"] == "Rekam suaramu")
        assert rekam["teks_rekam"] == [{"judul": m1.judul, "teks": m1.data["versi_benar"]}]

    def test_pilih_lalu_tandai_selesai_dan_pilihan_tersimpan(self):
        assert self.anak.post(self.url + "tandai/").status_code == 400  # belum memilih
        i = next(n for n, p in enumerate(self.misi.data["pilihan"]) if "pertanyaan" not in p)
        r = self.anak.post(self.url + "pilih/", {"pilihan": i}, format="json")
        assert r.status_code == 200 and r.data["dipilih"] == i
        assert self.anak.get(self.url).data["dipilih"] == i
        r = self.anak.post(self.url + "tandai/")
        assert r.data["selesai"] is True
        d = self.anak.get(self.url).data
        assert d["status"] == "selesai" and d["dipilih"] == i

    def test_tantangan_satu_baris_wajib_diisi(self):
        i = next(n for n, p in enumerate(self.misi.data["pilihan"]) if "pertanyaan" in p)
        self.anak.post(self.url + "pilih/", {"pilihan": i}, format="json")
        assert self.anak.post(self.url + "tandai/", {"log": " "}, format="json").status_code == 400
        r = self.anak.post(self.url + "tandai/", {"log": "Aku tersandung di kata panjang."},
                           format="json")
        assert r.status_code == 200
        assert HasilMisi.objects.get(misi=self.misi).log == "Aku tersandung di kata panjang."

    def test_pilihan_tidak_sah_ditolak(self):
        assert self.anak.post(self.url + "pilih/", {"pilihan": 3}, format="json").status_code == 400
        assert self.anak.post(self.url + "pilih/", {"pilihan": "a"}, format="json").status_code == 400
        m = Misi.objects.get(modul__nomor=1, urutan=4)  # LOG biasa, tanpa pilihan
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/pilih/", {"pilihan": 0}, format="json")
        assert r.status_code == 400

    def test_pilihan_milik_masing_masing_penulis(self):
        from .base import auth

        self.anak.post(self.url + "pilih/", {"pilihan": 2}, format="json")
        assert auth(self.akun_anak_lain).get(self.url).data["dipilih"] is None

    def test_tantangan_cetak_menyebut_lembarnya(self):
        selesaikan_modul(self.profil, 1)
        m = Misi.objects.get(modul__nomor=2, urutan=5)
        d = self.anak.get(f"/api/penerbit/misi/{m.id}/").data
        cetak = next(p for p in d["pilihan"] if p["judul"] == "Hariku dalam 5 kalimat")
        assert cetak["lembar"]["kode"] == "M2-5" and cetak["lembar"]["judul"]
