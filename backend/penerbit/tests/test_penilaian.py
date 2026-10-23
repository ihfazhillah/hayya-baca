"""Penilaian misi di server (plan 074 keputusan 2): klik per klik, gunting, kembar, cetak."""
from penerbit.models import HasilMisi, Misi, PemeriksaanLembar, SoalUjian

from .base import Keluarga, impor_modul_1_5, selesaikan_modul


def tok(misi, teks, ke=1):
    """Indeks token ke-`ke` dengan teks tertentu."""
    cocok = [t["i"] for t in misi.data["tokens"] if t["t"] == teks]
    return cocok[ke - 1]


class Dasar(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()

    def misi(self, modul, urutan):
        return Misi.objects.get(modul__nomor=modul, urutan=urutan)

    def klik(self, misi, **kw):
        return self.anak.post(f"/api/penerbit/misi/{misi.id}/klik/", kw, format="json")


class TestKlikKesalahan(Dasar):
    def test_misi_dikirim_tanpa_kunci(self):
        m = self.misi(1, 2)
        r = self.anak.get(f"/api/penerbit/misi/{m.id}/")
        assert r.status_code == 200
        assert r.data["tokens"][0]["t"] == "Oren"
        assert r.data["jumlah"] == 3  # tahap petunjuk: jumlah boleh ditampilkan
        for rahasia in ("kunci", "versi_benar", "potong", "kata"):
            assert rahasia not in r.data

    def test_klik_benar_meleset_dan_ulang(self):
        m = self.misi(1, 2)
        r = self.klik(m, token=tok(m, "sangat"))
        assert r.data["hasil"] == "ketemu"
        assert r.data["ditemukan"] == 1
        r = self.klik(m, token=tok(m, "sangat", 2))  # bagian dari kesalahan yang sama
        assert r.data["hasil"] == "sudah"
        r = self.klik(m, token=tok(m, "Oren"))
        assert r.data["hasil"] == "meleset"
        assert r.data["meleset"] == 1

    def test_semua_ketemu_selesai_dan_versi_benar_terbuka(self):
        m = self.misi(1, 2)
        self.klik(m, token=tok(m, "sangat"))
        self.klik(m, token=tok(m, "di"))
        r = self.klik(m, token=tok(m, "sekali"))
        assert r.data["selesai"] is True
        assert r.data["versi_benar"].startswith("Oren sangat suka")
        h = HasilMisi.objects.get(profil=self.profil, misi=m)
        assert (h.status, h.benar, h.total, h.meleset) == ("selesai", 3, 3, 0)

    def test_kunci_ganda_nanti_kedua_juga_benar(self):
        m = self.misi(1, 1)
        assert self.klik(m, token=tok(m, "nanti", 2)).data["hasil"] == "ketemu"
        assert self.klik(m, token=tok(m, "nanti", 1)).data["hasil"] == "sudah"

    def test_celah_titik_hilang_di_akhir(self):
        for n in range(1, 5):
            selesaikan_modul(self.profil, n)
        m = self.misi(5, 2)  # "kemarin oren pergi kepasar bersama ibu"
        n = len(m.data["tokens"])
        assert self.klik(m, token=tok(m, "ibu")).data["hasil"] == "ketemu"
        # Mengklik "ibu" lagi tidak dihitung sebagai titik yang hilang.
        assert self.klik(m, token=tok(m, "ibu")).data["hasil"] == "sudah"
        assert self.klik(m, celah=n).data["hasil"] == "ketemu"

    def test_petunjuk_baru_boleh_setelah_tiga_meleset(self):
        m = self.misi(1, 2)
        url = f"/api/penerbit/misi/{m.id}/petunjuk/"
        assert self.anak.post(url).status_code == 400
        for _ in range(3):
            self.klik(m, token=tok(m, "Oren"))
        r = self.anak.post(url)
        assert r.status_code == 200
        assert len(r.data["kalimat"]) == 3  # setiap kalimat masih berisi kesalahan
        self.klik(m, token=tok(m, "sangat"))
        self.klik(m, token=tok(m, "di"))
        self.klik(m, token=tok(m, "sekali"))
        assert HasilMisi.objects.get(misi=m).pakai_petunjuk is True

    def test_berhenti_mencatat_yang_ditemukan(self):
        m = self.misi(1, 2)
        self.klik(m, token=tok(m, "sangat"))
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/berhenti/")
        assert r.data["selesai"] is True
        h = HasilMisi.objects.get(misi=m)
        assert (h.benar, h.total) == (1, 3)

    def test_percobaan_berlanjut_setelah_halaman_dimuat_ulang(self):
        m = self.misi(1, 2)
        self.klik(m, token=tok(m, "sangat"))
        r = self.anak.get(f"/api/penerbit/misi/{m.id}/")
        assert tok(m, "sangat") in r.data["percobaan"]["diklik"]


class TestGuntingKembar(Dasar):
    def setUp(self):
        super().setUp()
        selesaikan_modul(self.profil, 1)
        selesaikan_modul(self.profil, 2)

    def spasi_setelah(self, m, kata):
        i = tok(m, kata)
        assert m.data["tokens"][i + 1]["j"] == "spasi"
        return i + 1

    def test_gunting_tepat_dan_tidak_perlu(self):
        m = self.misi(2, 2)  # potong jadi 3
        potong = [self.spasi_setelah(m, "pintu"), self.spasi_setelah(m, "kuyup"),
                  self.spasi_setelah(m, "handuk")]
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/periksa/", {"potong": potong},
                           format="json")
        assert r.data["tepat"] == potong[:2]
        assert r.data["tidak_perlu"] == potong[2:]
        assert r.data["kurang"] == 0
        assert "versi_benar" in r.data
        h = HasilMisi.objects.filter(misi=m).first()  # terbaru
        assert (h.benar, h.total) == (2, 2)

    def test_kembar_salah_lalu_benar(self):
        m = self.misi(3, 3)
        url = f"/api/penerbit/misi/{m.id}/periksa/"
        assert self.anak.post(url, {"kata": "Ibu"}, format="json").data["hasil"] == "belum"
        r = self.anak.post(url, {"kata": "Kue"}, format="json")
        assert r.data["hasil"] == "benar"
        h = HasilMisi.objects.filter(misi=m).first()
        assert (h.benar, h.total, h.meleset) == (0, 1, 1)


class TestMisiLain(Dasar):
    def test_log_wajib_diisi(self):
        m = self.misi(1, 4)
        url = f"/api/penerbit/misi/{m.id}/tandai/"
        assert self.anak.post(url, {"log": " "}, format="json").status_code == 400
        assert self.anak.post(url, {"log": "Tidak, enak dibaca."}, format="json").status_code == 200
        assert HasilMisi.objects.get(misi=m).log == "Tidak, enak dibaca."

    def test_cetak_menunggu_pemeriksaan(self):
        selesaikan_modul(self.profil, 1)
        m = self.misi(2, 5)
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/cetak/")
        assert r.data["status"] == "menunggu"
        assert PemeriksaanLembar.objects.get(profil=self.profil).lembar.kode == "M2-5"

    def test_tandai_tidak_untuk_misi_klik(self):
        m = self.misi(1, 2)
        assert self.anak.post(f"/api/penerbit/misi/{m.id}/tandai/").status_code == 400

    def test_ujian(self):
        s = SoalUjian.objects.get(modul__nomor=1, urutan=1)
        r = self.anak.post(f"/api/penerbit/ujian/{s.id}/jawab/", {"pilihan": "a"}, format="json")
        assert r.data["benar"] is False
        assert "tapi tapi" in r.data["alasan"]

    def test_modul_terkunci_sebelum_modul_sebelumnya_selesai(self):
        m = self.misi(2, 1)
        r = self.anak.get(f"/api/penerbit/misi/{m.id}/")
        assert r.status_code == 403
        assert "Modul 1" in r.data["detail"]
        selesaikan_modul(self.profil, 1)
        assert self.anak.get(f"/api/penerbit/misi/{m.id}/").status_code == 200

    def test_misi_bonus_tidak_mengunci_modul_berikutnya(self):
        for m in Misi.objects.filter(modul__nomor=1).exclude(tahap="bonus"):
            HasilMisi.objects.create(profil=self.profil, misi=m, status="selesai")
        assert self.anak.get(f"/api/penerbit/misi/{self.misi(2, 1).id}/").status_code == 200

    def test_percobaan_terpisah_per_penulis(self):
        from .base import auth

        m = self.misi(1, 2)
        self.klik(m, token=tok(m, "sangat"))
        r = auth(self.akun_anak_lain).post(
            f"/api/penerbit/misi/{m.id}/klik/", {"token": tok(m, "sangat")}, format="json"
        )
        assert r.data["hasil"] == "ketemu"
