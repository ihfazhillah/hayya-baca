"""Beranda, Modul, kotak prompt, dan Rak Buku untuk penulis."""
from penerbit.models import HasilMisi, Misi, Modul, Naskah, Prompt, Stempel, Versi

from .base import Keluarga, auth, impor_modul_1_5, selesaikan_modul


class Dasar(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()


class TestBeranda(Dasar):
    def test_pertama_kali(self):
        d = self.anak.get("/api/penerbit/beranda/").data
        assert d["lanjutkan"]["pertama_kali"] is True
        assert d["lanjutkan"]["modul"]["nomor"] == 1
        assert d["lanjutkan"]["misi"]["urutan"] == 1
        assert [m["status"] for m in d["peta"]] == ["aktif"] + ["terkunci"] * 4
        assert d["poin"] == 0 and d["pangkat"] is None

    def test_lanjut_ke_misi_berikutnya_dan_modul_berikutnya(self):
        m1 = Misi.objects.get(modul__nomor=1, urutan=1)
        HasilMisi.objects.create(profil=self.profil, misi=m1, status="selesai")
        d = self.anak.get("/api/penerbit/beranda/").data
        assert d["lanjutkan"]["misi"]["urutan"] == 2
        selesaikan_modul(self.profil, 1)
        d = self.anak.get("/api/penerbit/beranda/").data
        assert d["lanjutkan"]["modul"]["nomor"] == 2
        assert [m["status"] for m in d["peta"]][:2] == ["selesai", "aktif"]

    def test_alat_beranda_menyebut_terbuka_dan_modul_belajar(self):
        alat = {a["kode"]: a for a in self.anak.get("/api/penerbit/beranda/").data["alat"]}
        assert alat["pengeras"]["terbuka"] is True and alat["kamera"]["terbuka"] is False
        assert alat["kamera"]["modul_belajar"] == 4

    def test_pemanasan_hilang_setelah_semua_kartu_hari_ini_selesai(self):
        from penerbit import hadiah, jadwal
        from penerbit.impor import ubah_data_soal
        from penerbit.models import Alat, HasilLatihan, JadwalUlang, KalimatLatihan

        alat = Alat.objects.get(kode="pengeras")
        k = KalimatLatihan.objects.create(kode="p-1", alat=alat, jenis="klik", data=ubah_data_soal(
            "klik", {"teks": "di di", "kesalahan": [{"cari": "di di"}]}))
        hadiah.beri_stiker(self.profil, alat, "perunggu", oleh=self.ayah)
        JadwalUlang.objects.filter(profil=self.profil).update(jatuh_tempo=jadwal.hari_ini())
        assert self.anak.get("/api/penerbit/beranda/").data["pemanasan"]["ada"] is True
        HasilLatihan.objects.create(profil=self.profil, kalimat=k, alat=alat, benar=1, total=1)
        jadwal.majukan(self.profil, alat)
        assert self.anak.get("/api/penerbit/beranda/").data["pemanasan"]["ada"] is False

    def test_kabar_dari_ayah(self):
        from penerbit import hadiah
        from penerbit.models import Alat

        hadiah.beri_stiker(self.profil, Alat.objects.get(kode="pengeras"), "emas",
                           oleh=self.ayah, catatan="Kamu membaca keras tanpa disuruh!")
        kabar = self.anak.get("/api/penerbit/beranda/").data["kabar"]
        assert kabar[0]["catatan"] == "Kamu membaca keras tanpa disuruh!"


class TestModul(Dasar):
    def test_isi_modul_tanpa_kunci_jawaban(self):
        d = self.anak.get("/api/penerbit/modul/1/").data
        assert d["terkunci"] is False
        assert d["judul"] == "Pengeras Suara"
        assert len(d["misi"]) == 5
        assert d["mentor"]["tahap"] == "tanpa"
        assert "jawaban" not in d["ujian"][0]
        assert d["alat"]["slot"][0]["tingkat"] == "perunggu"

    def test_modul_terkunci(self):
        d = self.anak.get("/api/penerbit/modul/3/").data
        assert d["terkunci"] is True
        assert d["pesan"] == "Selesaikan Modul 2 dulu, ya."
        assert "misi" not in d


class TestPrompt(Dasar):
    def setUp(self):
        super().setUp()
        Modul.objects.filter(nomor=5).update(tahap_mentor="isian", kartu_prompt="Kartu.")
        Modul.objects.filter(nomor=4).update(tahap_mentor="contoh", kartu_prompt="Kartu contoh.")
        for n in range(1, 5):
            selesaikan_modul(self.profil, n)

    def test_contoh_memakai_kartu_dengan_pembuka(self):
        r = self.anak.post("/api/penerbit/prompt/", {"modul": 4}, format="json")
        assert r.status_code == 201
        assert r.data["teks"].startswith("Kamu editor untuk penulis anak usia SD.")
        assert r.data["teks"].endswith("Kartu contoh.")

    def test_pembuka_memakai_umur_anak_bila_ada(self):
        self.child.age = 8
        self.child.save()
        r = self.anak.post("/api/penerbit/prompt/", {"modul": 4}, format="json")
        assert r.data["teks"].startswith("Kamu editor untuk penulis anak umur 8 tahun.")
        assert self.anak.get("/api/penerbit/modul/4/").data["mentor"]["pembuka"].startswith(
            "Kamu editor untuk penulis anak umur 8 tahun.")

    def test_isian_butuh_empat_bagian_lalu_refleksi(self):
        url = "/api/penerbit/prompt/"
        assert self.anak.post(url, {"modul": 5, "bagian": ["a", "", "c", ""]},
                              format="json").status_code == 400
        r = self.anak.post(url, {"modul": 5, "bagian": [
            "Aku sedang di Lapis 4.", "Aku bingung soal di/ke.", "Tolong beri 2 pertanyaan.",
            "Setelah itu aku akan memperbaiki sendiri."]}, format="json")
        pid = r.data["id"]
        assert "Aku bingung soal di/ke." in r.data["teks"]
        r = self.anak.patch(f"/api/penerbit/prompt/{pid}/",
                            {"refleksi_bantu": "sedikit", "refleksi_ubah": "Lebih spesifik."},
                            format="json")
        assert r.status_code == 200
        assert Prompt.objects.get(id=pid).refleksi_ubah == "Lebih spesifik."

    def test_modul_tanpa_ai(self):
        assert self.anak.post("/api/penerbit/prompt/", {"modul": 1},
                              format="json").status_code == 400


class TestRak(Dasar):
    def test_buku_terbit_untuk_penulis_dan_pemeriksa(self):
        n = Naskah.objects.create(profil=self.profil, judul="Sandal", tahap="terbit",
                                  nomor_terbitan="PR-001", tentang_penulis="Fatih kelas 4.")
        Versi.objects.create(naskah=n, nomor=1, teks="Versi satu.")
        Versi.objects.create(naskah=n, nomor=2, teks="Versi terbit.", lapis="kaca")
        Naskah.objects.create(profil=self.profil, judul="Belum", tahap="revisi")
        rak = self.anak.get("/api/penerbit/rak/").data
        assert [b["judul"] for b in rak["buku"]] == ["Sandal"]
        buku = self.anak.get(f"/api/penerbit/rak/{n.id}/").data
        assert buku["teks"] == "Versi terbit."
        assert self.ortu.get(f"/api/penerbit/rak/{n.id}/?penulis={self.profil.id}").status_code == 200
        assert auth(self.ayah_lain).get(f"/api/penerbit/rak/{n.id}/").status_code == 404
        assert auth(self.kakak).get("/api/penerbit/rak/").status_code == 403
        assert Stempel.objects.count() == 0
