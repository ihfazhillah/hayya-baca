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
