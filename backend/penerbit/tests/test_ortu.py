"""Area Pemeriksa /ortu/ (Rancangan Situs §Area Pemeriksa)."""
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from penerbit.hadiah import total_poin
from penerbit.models import (
    LAPIS_STEMPEL, Alat, BagiNaskah, Hadiah, HasilMisi, Jejak, Misi, Naskah, PemeriksaanLembar,
    Penukaran, Poin, Prompt, Stempel, Stiker, Versi,
)

from .base import Keluarga, auth, impor_modul_1_5, selesaikan_modul


class Dasar(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        self.q = f"?penulis={self.profil.id}"

    def naskah(self, tahap="revisi", **kw):
        n = Naskah.objects.create(profil=self.profil, judul="Sandal Jepit", tahap=tahap,
                                  laci_dibuka=True, **kw)
        Versi.objects.create(naskah=n, nomor=1, teks="Fatih sedih.")
        return n

    def cetak(self, modul, urutan):
        m = Misi.objects.get(modul__nomor=modul, urutan=urutan)
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/cetak/")
        assert r.status_code == 200, r.data
        return PemeriksaanLembar.objects.get(profil=self.profil, misi=m)


class TestDasbor(Dasar):
    def test_angka_perlu_tindakan(self):
        selesaikan_modul(self.profil, 1)
        self.cetak(2, 5)
        self.naskah(stempel_diminta="peta")
        Penukaran.objects.create(profil=self.profil,
                                 hadiah=Hadiah.objects.create(profil=self.profil, nama="Es krim",
                                                              harga=10))
        r = self.ortu.get("/api/penerbit/ortu/dasbor/" + self.q)
        assert r.data["perlu_tindakan"] == {"lembar": 1, "stempel": 1, "penukaran": 1, "pertanyaan": 0,
                                            "kartu_pamer": 0}
        assert r.data["minggu_ini"]["misi_selesai"] == 5
        assert r.data["persiapan"]["modul"]["nomor"] == 2
        assert r.data["aktivitas"]


    def test_minggu_ini_menurut_wib(self):
        from datetime import datetime, timezone as tz
        from unittest import mock

        m = Misi.objects.get(modul__nomor=1, urutan=1)
        # Minggu 25 Okt 17.00 WIB = 10.00 UTC: masih minggu lalu.
        with mock.patch("django.utils.timezone.now",
                        return_value=datetime(2026, 10, 25, 10, 0, tzinfo=tz.utc)):
            HasilMisi.objects.create(profil=self.profil, misi=m, status="selesai")
        # Senin 26 Okt 01.00 WIB = Minggu 25 Okt 18.00 UTC.
        with mock.patch("django.utils.timezone.now",
                        return_value=datetime(2026, 10, 25, 18, 0, tzinfo=tz.utc)):
            r = self.ortu.get("/api/penerbit/ortu/dasbor/" + self.q)
        assert r.data["minggu_ini"]["misi_selesai"] == 0
        assert r.data["minggu_ini"]["sesi"] == 0


class TestPemeriksaanLembar(Dasar):
    def setUp(self):
        super().setUp()
        for n in (1, 2, 3):
            selesaikan_modul(self.profil, n)
        self.p = self.cetak(4, 3)  # lembar M4-3 (Kamera, tanpa petunjuk)

    def test_daftar_dan_cari_kode(self):
        r = self.ortu.get("/api/penerbit/ortu/lembar/" + self.q + "&kode=m4-3")
        assert [x["kode"] for x in r.data] == ["M4-3"]
        d = self.ortu.get(f"/api/penerbit/ortu/lembar/{self.p.id}/").data
        assert d["lembar"]["kriteria"].startswith("Jawaban benar")
        assert d["lembar"]["contoh_jawaban"]

    def test_sudah_bagus_dengan_stiker_perak(self):
        r = self.ortu.post(f"/api/penerbit/ortu/lembar/{self.p.id}/", {
            "status": "bagus", "stiker": "perak"}, format="json")
        assert r.status_code == 200
        self.p.refresh_from_db()
        assert (self.p.status, self.p.diperiksa_oleh) == ("bagus", self.ayah)
        assert HasilMisi.objects.filter(misi=self.p.misi).first().status == "selesai"
        s = Stiker.objects.get(profil=self.profil, alat__kode="kamera", tingkat="perak")
        assert s.diberikan_oleh == self.ayah
        assert Poin.objects.filter(kunci_sumber=f"misi:{self.p.misi_id}").exists()

    def test_coba_lagi_dengan_catatan(self):
        self.ortu.post(f"/api/penerbit/ortu/lembar/{self.p.id}/", {
            "status": "coba_lagi", "catatan": "Kalimat kedua masih bilang senang."}, format="json")
        h = HasilMisi.objects.filter(misi=self.p.misi).first()
        assert h.status == "coba_lagi"
        beranda = self.anak.get("/api/penerbit/beranda/").data
        assert beranda["coba_lagi"][0]["catatan"] == "Kalimat kedua masih bilang senang."

    def test_simpan_ulang_tanpa_perubahan_tidak_menggandakan_hasil(self):
        url = f"/api/penerbit/ortu/lembar/{self.p.id}/"
        self.ortu.post(url, {"status": "bagus"}, format="json")
        self.ortu.post(url, {"status": "bagus"}, format="json")
        assert HasilMisi.objects.filter(misi=self.p.misi, status="selesai").count() == 1

    def test_lembar_keluarga_lain_404(self):
        assert auth(self.ayah_lain).get(f"/api/penerbit/ortu/lembar/{self.p.id}/").status_code == 404


class TestNaskahPemeriksa(Dasar):
    def test_stempel_catatan_dan_tidak_bisa_mengubah_teks(self):
        n = self.naskah(stempel_diminta="peta")
        url = f"/api/penerbit/ortu/naskah/{n.id}/"
        d = self.ortu.get(url).data
        assert d["versi_terakhir"]["teks"] == "Fatih sedih."
        r = self.ortu.post(url + "stempel/", {"lapis": "peta", "catatan": "Bagus!"}, format="json")
        assert r.status_code == 201
        n.refresh_from_db()
        assert n.stempel_diminta == ""
        assert Stempel.objects.get(naskah=n).diberikan_oleh == self.ayah
        self.ortu.post(url + "catatan/", {"teks": "Bagian kakek lucu."}, format="json")
        assert self.anak.get(f"/api/penerbit/naskah/{n.id}/").data["catatan"][0]["teks"] == \
            "Bagian kakek lucu."
        assert self.ortu.post(f"/api/penerbit/naskah/{n.id}/simpan/", {"teks": "x"},
                              format="json").status_code == 403

    def test_stempel_pembaca_butuh_kartu_ulasan(self):
        n = self.naskah()
        url = f"/api/penerbit/ortu/naskah/{n.id}/"
        assert self.ortu.post(url + "stempel/", {"lapis": "pembaca"},
                              format="json").status_code == 400
        self.ortu.post(url + "ulasan/", {"favorit": "kakek", "membingungkan": "sandal",
                                         "pertanyaan": "kenapa hijau?"}, format="json")
        assert self.ortu.post(url + "stempel/", {"lapis": "pembaca"},
                              format="json").status_code == 201

    def test_buka_laci_lebih_awal(self):
        n = self.naskah(tahap="laci", laci_buka=timezone.now() + timedelta(days=1))
        Naskah.objects.filter(id=n.id).update(laci_dibuka=False)
        self.ortu.post(f"/api/penerbit/ortu/naskah/{n.id}/buka-laci/")
        n.refresh_from_db()
        assert (n.tahap, n.laci_dibuka) == ("revisi", True)

    def test_terbitkan_hanya_bila_lima_stempel(self):
        n = self.naskah()
        url = f"/api/penerbit/ortu/naskah/{n.id}/terbitkan/"
        assert self.ortu.post(url, {"tentang_penulis": "Fatih kelas 4."}).status_code == 400
        for lapis in LAPIS_STEMPEL:
            Stempel.objects.create(naskah=n, lapis=lapis, diberikan_oleh=self.ayah)
        sampul = SimpleUploadedFile("sampul.png", b"\x89PNG\r\n\x1a\n" + b"0" * 10,
                                    content_type="image/png")
        r = self.ortu.post(url, {"tentang_penulis": "Fatih kelas 4.", "sampul": sampul})
        assert r.status_code == 200, r.data
        n.refresh_from_db()
        assert (n.tahap, n.nomor_terbitan) == ("terbit", "PR-001")
        assert Poin.objects.filter(kunci_sumber=f"terbit:{n.id}").exists()
        self.profil.refresh_from_db()
        assert self.profil.pangkat.kode == "penulis"

    def test_sampul_harus_gambar(self):
        n = self.naskah()
        for lapis in LAPIS_STEMPEL:
            Stempel.objects.create(naskah=n, lapis=lapis)
        html = SimpleUploadedFile("sampul.html", b"<script>alert(1)</script>",
                                  content_type="text/html")
        r = self.ortu.post(f"/api/penerbit/ortu/naskah/{n.id}/terbitkan/",
                           {"sampul": html}, format="multipart")
        assert r.status_code == 400
        n.refresh_from_db()
        assert n.tahap == "revisi"

    def test_bagikan_ke_editor_tamu_yang_sudah_ada(self):
        n = self.naskah()
        url = f"/api/penerbit/ortu/naskah/{n.id}/bagikan/"
        assert self.ortu.post(url, {"username": "tidakada"}, format="json").status_code == 400
        assert self.ortu.post(url, {"username": "kakak"}, format="json").status_code == 201
        assert BagiNaskah.objects.get(naskah=n).user == self.kakak

    def test_berani_hapus_dan_ejaan_jejak(self):
        n = self.naskah()
        v = n.versi.get(nomor=1)
        Jejak.objects.create(versi=v, jumlah_kata=100, kalimat_terpanjang=10)
        url = f"/api/penerbit/ortu/naskah/{n.id}/"
        self.ortu.post(url + "berani-hapus/", {"catatan": "Menghapus kalimat favorit."},
                       format="json")
        self.ortu.post(url + "berani-hapus/", {}, format="json")
        assert total_poin(self.profil) == 20
        self.ortu.patch(url + "ejaan/", {"kesalahan_ejaan": 4}, format="json")
        assert Jejak.objects.get(versi=v).ejaan == 4
        for salah in (-1, "abc"):
            r = self.ortu.patch(url + "ejaan/", {"kesalahan_ejaan": salah}, format="json")
            assert r.status_code == 400, salah
        assert Jejak.objects.get(versi=v).ejaan == 4

    def test_daftar_naskah_menunjukkan_stempel_diminta(self):
        self.naskah(stempel_diminta="kamera")
        r = self.ortu.get("/api/penerbit/ortu/naskah/" + self.q)
        assert r.data[0]["stempel_diminta"] == "kamera"

    def test_naskah_keluarga_lain_404(self):
        n = Naskah.objects.create(profil=self.profil_lain, judul="Rara")
        assert self.ortu.get(f"/api/penerbit/ortu/naskah/{n.id}/").status_code == 404


class TestStikerHadiahPoin(Dasar):
    def test_tabel_stiker_dan_beri_manual(self):
        r = self.ortu.get("/api/penerbit/ortu/stiker/" + self.q)
        assert [a["kode"] for a in r.data["alat"]][:2] == ["pengeras", "gunting"]
        r = self.ortu.post("/api/penerbit/ortu/stiker/" + self.q,
                           {"alat": "pengeras", "tingkat": "emas"}, format="json")
        assert r.status_code == 201
        s = Stiker.objects.get(alat=Alat.objects.get(kode="pengeras"), tingkat="emas")
        assert s.diberikan_oleh == self.ayah

    def test_hadiah_dan_penukaran(self):
        r = self.ortu.post("/api/penerbit/ortu/hadiah/" + self.q,
                           {"nama": "Pilih menu makan malam", "harga": 20}, format="json")
        hid = r.data["id"]
        Poin.objects.create(profil=self.profil, jumlah=25, alasan="x", kunci_sumber="uji")
        r = self.anak.post("/api/penerbit/penukaran/", {"hadiah": hid}, format="json")
        assert r.status_code == 201
        pid = r.data["id"]
        r = self.ortu.post(f"/api/penerbit/ortu/penukaran/{pid}/", {"status": "disetujui"},
                           format="json")
        assert r.status_code == 200
        assert total_poin(self.profil) == 5
        riwayat = self.ortu.get("/api/penerbit/ortu/hadiah/" + self.q).data["riwayat_poin"]
        assert riwayat[0]["minggu"]

    def test_ubah_hadiah_divalidasi(self):
        h = Hadiah.objects.create(profil=self.profil, nama="Buku baru", harga=100)
        url = f"/api/penerbit/ortu/hadiah/{h.id}/"
        for body in ({"harga": -5}, {"harga": "abc"}, {"harga": 0}, {"nama": " "}):
            assert self.ortu.patch(url, body, format="json").status_code == 400, body
        r = self.ortu.patch(url, {"harga": "120", "aktif": False}, format="json")
        assert r.status_code == 200
        assert (r.data["harga"], r.data["aktif"]) == (120, False)
        assert self.ortu.patch(url, {"aktif": "false"}, format="json").data["aktif"] is False

    def test_pengajuan_menunggu_ikut_mengurangi_saldo(self):
        h = Hadiah.objects.create(profil=self.profil, nama="Es krim", harga=20)
        Poin.objects.create(profil=self.profil, jumlah=30, alasan="x", kunci_sumber="uji")
        assert self.anak.post("/api/penerbit/penukaran/", {"hadiah": h.id},
                              format="json").status_code == 201
        # 30 poin, 20 sudah diajukan: pengajuan kedua (20) melebihi sisa.
        assert self.anak.post("/api/penerbit/penukaran/", {"hadiah": h.id},
                              format="json").status_code == 400

    def test_penukaran_tanpa_poin_cukup_ditolak(self):
        h = Hadiah.objects.create(profil=self.profil, nama="Buku baru", harga=100)
        assert self.anak.post("/api/penerbit/penukaran/", {"hadiah": h.id},
                              format="json").status_code == 400


class TestCetakDanPrompt(Dasar):
    def test_cetak_per_modul_urut_alami(self):
        from penerbit.models import Lembar, Modul

        m = Modul.objects.get(nomor=4)
        Lembar.objects.create(kode="M4-10", modul=m, judul="x", petunjuk="x")
        r = self.ortu.get("/api/penerbit/ortu/cetak/?modul=4")
        assert [x["kode"] for x in r.data["lembar"]] == ["M4-2", "M4-3", "M4-5", "M4-10"]

    def test_cetak_per_modul(self):
        r = self.ortu.get("/api/penerbit/ortu/cetak/?modul=4")
        assert [x["kode"] for x in r.data["lembar"]] == ["M4-2", "M4-3", "M4-5"]
        r = self.ortu.get("/api/penerbit/cetak/M4-3/")
        assert r.data["contoh_jawaban"]

    def test_prompt_anak_dan_catatan(self):
        p = Prompt.objects.create(profil=self.profil, modul_id=1, tahap="contoh",
                                  bagian=["a", "b", "c", "d"], teks="x", refleksi_bantu="ya")
        r = self.ortu.get("/api/penerbit/ortu/prompt/" + self.q)
        assert r.data[0]["bagian"] == ["a", "b", "c", "d"]
        self.ortu.patch(f"/api/penerbit/ortu/prompt/{p.id}/", {"catatan_ortu": "Bagus!"},
                        format="json")
        p.refresh_from_db()
        assert p.catatan_ortu == "Bagus!"
