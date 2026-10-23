"""Ruang Penulis: Bank Ide, naskah, simpan otomatis, Versi, Laci, revisi (plan 074 keputusan 6–9)."""
from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from penerbit.models import Ide, Naskah, Versi

from .base import Keluarga, auth

ISI = {"ops": [{"insert": "Fatih sedih. Lalu dia pulang.\n"}]}


class Dasar(Keluarga):
    def naskah_baru(self, judul="Sandal Jepit yang Hilang"):
        r = self.anak.post("/api/penerbit/naskah/", {
            "judul": judul,
            "peta": {"siapa": "Fatih", "mau_apa": "pulang", "masalah": "sandal hilang",
                     "akhir": "dipakai kakek"},
        }, format="json")
        assert r.status_code == 201, r.data
        return r.data["id"]

    def simpan(self, nid, teks="Fatih sedih. Lalu dia pulang.", waktu=1000, **kw):
        return self.anak.post(f"/api/penerbit/naskah/{nid}/simpan/", {
            "isi": {"ops": [{"insert": teks + "\n"}]}, "teks": teks, "sorotan": [],
            "waktu_klien": waktu, **kw,
        }, format="json")

    def versi(self, nid, **kw):
        return self.anak.post(f"/api/penerbit/naskah/{nid}/versi/", kw, format="json")

    def ke_revisi(self, nid):
        self.simpan(nid)
        self.versi(nid)
        Naskah.objects.filter(id=nid).update(laci_buka=timezone.now() - timedelta(minutes=1))
        assert self.anak.post(f"/api/penerbit/naskah/{nid}/buka-laci/").status_code == 200


class TestBankIde(Dasar):
    def test_tambah_dan_beri_bintang(self):
        r = self.anak.post("/api/penerbit/ide/", {"teks": "Sandal hilang di masjid",
                                                   "sumur": "kenangan"}, format="json")
        assert r.status_code == 201
        iid = r.data["id"]
        r = self.anak.patch(f"/api/penerbit/ide/{iid}/", {"bintang": [True, True, True]},
                            format="json")
        assert r.data["bintang"] == [True, True, True]
        assert [i["teks"] for i in self.anak.get("/api/penerbit/ide/").data] == [
            "Sandal hilang di masjid"]

    def test_ide_penulis_lain_404(self):
        ide = Ide.objects.create(profil=self.profil_lain, teks="rahasia")
        assert self.anak.patch(f"/api/penerbit/ide/{ide.id}/", {"bintang": []},
                               format="json").status_code == 404


class TestDrafNolDanLaci(Dasar):
    def test_naskah_baru_langsung_draf_nol(self):
        nid = self.naskah_baru()
        n = Naskah.objects.get(id=nid)
        assert (n.profil, n.tahap) == (self.profil, "draf_nol")
        assert n.peta["siapa"] == "Fatih"

    def test_simpan_otomatis_menolak_antrean_yang_lebih_tua(self):
        nid = self.naskah_baru()
        assert self.simpan(nid, "baru", waktu=2000).status_code == 200
        r = self.simpan(nid, "lama dari antrean offline", waktu=1000)
        assert r.status_code == 409
        assert Naskah.objects.get(id=nid).draf.teks == "baru"

    def test_versi_1_menghitung_jejak_dan_mengunci_laci_48_jam(self):
        nid = self.naskah_baru()
        self.simpan(nid)
        r = self.versi(nid)
        assert r.status_code == 201
        assert r.data["nomor"] == 1
        assert r.data["jejak"]["kalimat_perasaan"] == 1
        assert "hadiah_baru" in r.data
        n = Naskah.objects.get(id=nid)
        assert n.tahap == "laci"
        sisa = n.laci_buka - timezone.now()
        assert timedelta(hours=47, minutes=59) < sisa <= timedelta(hours=48)
        assert self.simpan(nid, waktu=5000).status_code == 400  # di laci: tidak bisa diubah

    def test_versi_tidak_bisa_diubah(self):
        nid = self.naskah_baru()
        self.simpan(nid)
        self.versi(nid)
        v = Versi.objects.get(naskah_id=nid, nomor=1)
        v.teks = "diubah"
        with pytest.raises(ValidationError):
            v.save()
        r = self.anak.put(f"/api/penerbit/naskah/{nid}/versi/1/", {"teks": "x"}, format="json")
        assert r.status_code == 405

    def test_laci_belum_waktunya(self):
        nid = self.naskah_baru()
        self.simpan(nid)
        self.versi(nid)
        r = self.anak.post(f"/api/penerbit/naskah/{nid}/buka-laci/")
        assert r.status_code == 400
        assert r.data["sisa_detik"] > 0

    def test_buka_laci_menampilkan_kartu_tebakan(self):
        nid = self.naskah_baru()
        self.anak.patch(f"/api/penerbit/naskah/{nid}/", {"kartu_tebakan": "Fatih kesal."},
                        format="json")
        self.simpan(nid)
        self.versi(nid)
        Naskah.objects.filter(id=nid).update(laci_buka=timezone.now() - timedelta(minutes=1))
        r = self.anak.post(f"/api/penerbit/naskah/{nid}/buka-laci/")
        assert r.data["kartu_tebakan"] == "Fatih kesal."
        assert Naskah.objects.get(id=nid).tahap == "revisi"


class TestRevisi(Dasar):
    def test_versi_berikutnya_per_lapis(self):
        nid = self.naskah_baru()
        self.ke_revisi(nid)
        assert self.simpan(nid, "Mata Fatih panas.", waktu=3000, lapis="kamera").status_code == 200
        r = self.versi(nid, lapis="kamera")
        assert r.status_code == 201
        assert r.data["nomor"] == 2
        assert "jejak" not in r.data  # Jejak hanya untuk Versi 1
        r = self.anak.get(f"/api/penerbit/naskah/{nid}/versi/2/")
        assert r.data["teks"] == "Mata Fatih panas."
        assert r.data["lapis"] == "kamera"

    def test_simpan_versi_dua_kali_tanpa_perubahan_tidak_menggandakan(self):
        # Tombol "Simpan sebagai Versi n" ditekan dua kali (atau dikirim ulang setelah timeout).
        nid = self.naskah_baru()
        self.ke_revisi(nid)
        self.simpan(nid, "Mata Fatih panas.", waktu=3000, lapis="kamera")
        r1 = self.versi(nid, lapis="kamera")
        r2 = self.versi(nid, lapis="kamera")
        assert r1.data["nomor"] == r2.data["nomor"] == 2
        assert r2.status_code == 200
        assert Versi.objects.filter(naskah_id=nid).count() == 2
        self.simpan(nid, "Mata Fatih panas sekali.", waktu=4000, lapis="kamera")
        assert self.versi(nid, lapis="kamera").data["nomor"] == 3

    def test_versi_revisi_butuh_lapis_yang_dikenal(self):
        nid = self.naskah_baru()
        self.ke_revisi(nid)
        assert self.versi(nid, lapis="sembarang").status_code == 400

    def test_minta_stempel_butuh_versi_lapis_itu(self):
        nid = self.naskah_baru()
        self.ke_revisi(nid)
        url = f"/api/penerbit/naskah/{nid}/minta-stempel/"
        assert self.anak.post(url, {"lapis": "peta"}, format="json").status_code == 400
        self.simpan(nid, waktu=3000)
        self.versi(nid, lapis="peta")
        assert self.anak.post(url, {"lapis": "peta"}, format="json").status_code == 200
        assert Naskah.objects.get(id=nid).stempel_diminta == "peta"

    def test_sorotan_sistem(self):
        nid = self.naskah_baru()
        self.simpan(nid, "Lalu a. Lalu b. Lalu c. Lalu d.")
        r = self.anak.get(f"/api/penerbit/naskah/{nid}/sorotan-sistem/?alat=kembar,gunting")
        assert len(r.data) == 4
        assert r.data[0]["sumber"] == "sistem"

    def test_detail_dan_daftar(self):
        nid = self.naskah_baru()
        self.simpan(nid)
        self.versi(nid)
        d = self.anak.get(f"/api/penerbit/naskah/{nid}/").data
        assert d["tahap"] == "laci"
        assert d["laci"]["terkunci"] is True
        assert [v["nomor"] for v in d["versi"]] == [1]
        assert [s["lapis"] for s in d["stempel"]] == ["peta", "kamera", "gunting", "kaca", "pembaca"]
        daftar = self.anak.get("/api/penerbit/naskah/").data
        assert daftar[0]["judul"] == "Sandal Jepit yang Hilang"
        assert daftar[0]["laci"]["sisa_detik"] > 0


class TestBatas(Dasar):
    def test_naskah_penulis_lain_404(self):
        n = Naskah.objects.create(profil=self.profil_lain, judul="Rahasia Rara")
        for url in (f"/api/penerbit/naskah/{n.id}/", f"/api/penerbit/naskah/{n.id}/versi/1/"):
            assert self.anak.get(url).status_code == 404
        assert self.simpan(n.id).status_code == 404

    def test_pemeriksa_tidak_bisa_menulis_naskah_anak(self):
        nid = self.naskah_baru()
        r = auth(self.ayah).post(f"/api/penerbit/naskah/{nid}/simpan/", {"teks": "x"},
                                 format="json")
        assert r.status_code == 403


class TestJejakPenulis(Dasar):
    def test_jejak_per_cerita_dan_kalimat_utama(self):
        for judul, teks in (("Satu", "Fatih sedih karena sandalnya hilang di masjid kemarin sore."),
                            ("Dua", "Oren lari.")):
            nid = self.naskah_baru(judul)
            self.simpan(nid, teks)
            self.versi(nid)
        r = self.anak.get("/api/penerbit/jejak/")
        assert [c["judul"] for c in r.data["cerita"]] == ["Satu", "Dua"]
        assert "turun" in r.data["kalimat_utama"]


class TestSorotanVersiLama(Dasar):
    """Versi lama hanya bisa dibaca dan disorot dengan stabilo (Rancangan Situs §Aturan menulis)."""

    def test_sorotan_boleh_disimpan_teks_tidak(self):
        nid = self.naskah_baru()
        self.ke_revisi(nid)
        url = f"/api/penerbit/naskah/{nid}/versi/1/"
        sorotan = [{"alat": "kamera", "index": 0, "length": 12, "sumber": "anak", "diperbaiki": False}]
        r = self.anak.patch(url, {"sorotan": sorotan, "teks": "diubah"}, format="json")
        assert r.status_code == 200
        v = Versi.objects.get(naskah_id=nid, nomor=1)
        assert v.sorotan == sorotan
        assert v.teks == "Fatih sedih. Lalu dia pulang."

    def test_sorotan_harus_daftar(self):
        nid = self.naskah_baru()
        self.ke_revisi(nid)
        r = self.anak.patch(f"/api/penerbit/naskah/{nid}/versi/1/", {"sorotan": "x"}, format="json")
        assert r.status_code == 400

    def test_daftar_naskah_menyebut_jumlah_versi_dan_kata(self):
        nid = self.naskah_baru()
        self.simpan(nid)
        self.versi(nid)
        d = self.anak.get("/api/penerbit/naskah/").data[0]
        assert (d["jumlah_versi"], d["jumlah_kata"]) == (1, 5)


CERITA_FATIH = "Fatih lari. Fatih makan. Fatih tidur. Fatih bangun. Fatih senang."
SIM = {"HTTP_X_PENERBIT_SEBAGAI": "simulasi"}


class TestNamaTokoh(Dasar):
    """Nama tokoh (Kotak Siapa + tambahan anak) tidak dihitung sebagai kata kembar."""

    def draf_nol(self, teks=CERITA_FATIH, siapa="Fatih", judul="Sandal"):
        r = self.anak.post("/api/penerbit/naskah/", {"judul": judul, "peta": {"siapa": siapa}},
                           format="json")
        nid = r.data["id"]
        self.simpan(nid, teks)
        return nid, self.versi(nid)

    def tokoh(self, nid, client=None, **body):
        return (client or self.anak).post(f"/api/penerbit/naskah/{nid}/tokoh/", body,
                                          format="json")

    def jejak(self, nid):
        from penerbit.models import Jejak

        return Jejak.objects.get(versi__naskah_id=nid, versi__nomor=1)

    def test_nama_dari_kotak_siapa_tidak_dihitung_di_jejak(self):
        nid, r = self.draf_nol()
        assert r.data["jejak"]["kata_kembar"] != "fatih"
        assert r.data["jejak"]["kata_kembar_jumlah"] <= 1
        d = self.anak.get(f"/api/penerbit/naskah/{nid}/").data
        assert d["tokoh"]["nama"] == ["Fatih"]
        assert d["tokoh"]["otomatis"] == ["Fatih"]
        assert (d["tokoh"]["tambah"], d["tokoh"]["abaikan"]) == ([], [])

    def test_sorotan_sistem_tidak_menandai_nama_tokoh(self):
        nid, _ = self.draf_nol()
        r = self.anak.get(f"/api/penerbit/naskah/{nid}/sorotan-sistem/?alat=kembar")
        assert r.data == []

    def test_hapus_nama_otomatis_kembali_dihitung(self):
        nid, _ = self.draf_nol()
        r = self.tokoh(nid, hapus="Fatih")
        assert r.status_code == 200, r.data
        assert r.data["tokoh"]["nama"] == [] and r.data["tokoh"]["abaikan"] == ["fatih"]
        j = self.jejak(nid)
        assert (j.kata_kembar, j.kata_kembar_jumlah) == ("fatih", 5)
        assert len(self.anak.get(f"/api/penerbit/naskah/{nid}/sorotan-sistem/?alat=kembar").data) == 5
        # ditambah lagi: kembali tidak dihitung
        r = self.tokoh(nid, tambah="fatih")
        assert r.data["tokoh"]["nama"] == ["Fatih"] and r.data["tokoh"]["abaikan"] == []
        assert self.jejak(nid).kata_kembar_jumlah == 1

    def test_kotak_siapa_kosong_nama_ditambah_sendiri_per_kata(self):
        teks = "Bu Siti datang. Bu Siti duduk. Bu Siti makan. Bu Siti pulang. Kucing tidur."
        nid, r = self.draf_nol(teks, siapa="")
        assert r.data["jejak"]["kata_kembar_jumlah"] == 4
        assert self.anak.get(f"/api/penerbit/naskah/{nid}/").data["tokoh"]["otomatis"] == []
        r = self.tokoh(nid, tambah="  Bu Siti ")
        assert r.data["tokoh"]["tambah"] == ["Bu Siti"]
        assert r.data["tokoh"]["nama"] == ["Bu Siti"]
        assert self.jejak(nid).kata_kembar_jumlah == 1
        r = self.tokoh(nid, hapus="Bu Siti")
        assert r.data["tokoh"]["tambah"] == [] and r.data["tokoh"]["abaikan"] == []
        assert self.jejak(nid).kata_kembar_jumlah == 4

    def test_kata_umum_di_kotak_siapa_bukan_nama(self):
        nid, _ = self.draf_nol("Dia lari. Dia makan.", siapa="Dia, anak kelas 4")
        assert self.anak.get(f"/api/penerbit/naskah/{nid}/").data["tokoh"]["nama"] == []

    def test_nama_kosong_ditolak(self):
        nid, _ = self.draf_nol()
        assert self.tokoh(nid, tambah="  ").status_code == 400

    def test_mengubah_kotak_siapa_menghitung_ulang_jejak(self):
        nid, _ = self.draf_nol(siapa="")
        assert self.jejak(nid).kata_kembar == "fatih"
        self.anak.patch(f"/api/penerbit/naskah/{nid}/", {"peta": {"siapa": "Fatih"}},
                        format="json")
        assert self.jejak(nid).kata_kembar_jumlah == 1

    def test_emas_detektor_kembar_setelah_nama_tokoh_diatur(self):
        from penerbit import hadiah
        from penerbit.models import Alat, Stiker

        from .base import impor_modul_1_5

        impor_modul_1_5()
        kembar = Alat.objects.get(kode="kembar")
        hadiah.beri_stiker(self.profil, kembar, "perunggu", oleh=self.ayah)
        teks = "Siti lari. Siti makan. Siti tidur. Siti bangun."
        a, _ = self.draf_nol(teks, siapa="", judul="Satu")
        b, _ = self.draf_nol(teks, siapa="", judul="Dua")
        assert not Stiker.objects.filter(profil=self.profil, alat=kembar, tingkat="emas").exists()
        self.tokoh(a, tambah="Siti")
        r = self.tokoh(b, tambah="Siti")
        assert Stiker.objects.filter(profil=self.profil, alat=kembar, tingkat="emas").exists()
        assert any(h.get("alat") == "kembar" for h in r.data["hadiah_baru"])

    def test_pemeriksa_bisa_membaca_tidak_bisa_mengubah(self):
        nid, _ = self.draf_nol()
        d = self.ortu.get(f"/api/penerbit/ortu/naskah/{nid}/?penulis={self.profil.id}").data
        assert d["tokoh"]["nama"] == ["Fatih"]
        assert self.tokoh(nid, client=self.ortu, hapus="Fatih").status_code == 403

    def test_keluarga_lain_404(self):
        nid, _ = self.draf_nol()
        anak_lain = auth(self.akun_anak_lain)
        assert self.tokoh(nid, client=anak_lain, hapus="Fatih").status_code == 404
        assert self.jejak(nid).kata_kembar_jumlah == 1

    def test_halaman_jejak_menyebut_nama_tokoh_per_cerita(self):
        nid, _ = self.draf_nol()
        self.tokoh(nid, tambah="Kakek Darto")
        c = self.anak.get("/api/penerbit/jejak/").data["cerita"][0]
        assert c["tokoh"] == ["Fatih", "Kakek Darto"]

    def test_profil_simulasi_bisa_mengatur_nama(self):
        r = self.ortu.post("/api/penerbit/naskah/", {"judul": "Sim", "peta": {"siapa": "Oren"}},
                           format="json", **SIM)
        nid = r.data["id"]
        r = self.ortu.post(f"/api/penerbit/naskah/{nid}/tokoh/", {"tambah": "Kiki"},
                           format="json", **SIM)
        assert r.status_code == 200
        assert r.data["tokoh"]["nama"] == ["Oren", "Kiki"]
