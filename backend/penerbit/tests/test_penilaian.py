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

    def test_celah_yang_ditemukan_tetap_ada_setelah_dimuat_ulang(self):
        for n in range(1, 5):
            selesaikan_modul(self.profil, n)
        m = self.misi(5, 2)
        n = len(m.data["tokens"])
        self.klik(m, celah=n)
        p = self.anak.get(f"/api/penerbit/misi/{m.id}/").data["percobaan"]
        assert p["celah"] == [n]
        assert p["ditemukan"] == 1

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


class TestBantuanMemudar(Dasar):
    """Spec 075 K1: misi 1 Modul 1 = Contoh dari Oren + bantuan yang memudar."""

    def get(self, m):
        return self.anak.get(f"/api/penerbit/misi/{m.id}/").data

    def test_label_tahap_contoh_dari_oren_tanpa_mengubah_tahap(self):
        m = self.misi(1, 1)
        d = self.get(m)
        assert (d["tahap"], d["tahap_label"]) == ("bersama", "Contoh dari Oren")
        daftar = self.anak.get("/api/penerbit/modul/1/").data["misi"]
        assert daftar[0]["tahap_label"] == "Contoh dari Oren"
        assert daftar[1]["tahap_label"] == "Dengan petunjuk"

    def test_contoh_dikirim_dengan_sorotan_dan_gelembung(self):
        d = self.get(self.misi(1, 1))
        assert d["contoh"][0]["pikir"]
        assert all(isinstance(i, int) for x in d["contoh"] for i in x["sorot"])

    def test_kesalahan_pertama_ditunjukkan_kedua_letaknya_sisanya_sendiri(self):
        m = self.misi(1, 1)
        d = self.get(m)
        for rahasia in ("kunci", "alasan", "versi_benar", "kesalahan"):
            assert rahasia not in d
        b = d["bantuan"]
        assert b["tingkat"] == "tunjuk"
        assert b["token"] == [tok(m, "sekali"), tok(m, "sekali") + 1, tok(m, "sekali", 2)]
        assert "sekali" in b["alasan"]

        r = self.klik(m, token=tok(m, "sekali"))
        assert r.data["hasil"] == "ketemu"
        b = r.data["bantuan"]
        assert b["tingkat"] == "letak"
        assert set(b) == {"tingkat", "kalimat"}  # tidak ada token kunci
        awal, akhir = b["kalimat"]
        assert awal <= tok(m, "di") <= akhir
        assert akhir < tok(m, "tapi")  # hanya kalimat kedua

        r = self.klik(m, token=tok(m, "di"))
        assert r.data["bantuan"] is None
        assert self.get(m)["bantuan"] is None  # tetap sesudah dimuat ulang

    def test_bantuan_mengikuti_kesalahan_yang_belum_ditemukan(self):
        m = self.misi(1, 1)
        # Anak langsung menemukan kesalahan ketiga: yang ditunjuk sesudahnya letak kesalahan pertama.
        r = self.klik(m, token=tok(m, "tapi"))
        awal, akhir = r.data["bantuan"]["kalimat"]
        assert awal <= tok(m, "sekali") <= akhir

    def test_misi_tanpa_bantuan_memudar_tidak_mengirim_bantuan(self):
        m = self.misi(1, 2)
        assert "bantuan" not in self.get(m)
        assert "bantuan" not in self.klik(m, token=tok(m, "sangat")).data


class TestKacaContohOren(Dasar):
    """Fase B: Modul 5 misi 1 = Contoh dari Oren (klik, mode celah) + bantuan memudar."""

    def setUp(self):
        super().setUp()
        for n in (1, 2, 3, 4):
            selesaikan_modul(self.profil, n)

    def test_huruf_besar_ditunjuk_di_ke_letaknya_titik_sendiri(self):
        m = self.misi(5, 1)
        d = self.anak.get(f"/api/penerbit/misi/{m.id}/").data
        assert d["tahap_label"] == "Contoh dari Oren"
        assert d["celah"] is True and "kunci" not in d
        assert d["bantuan"]["tingkat"] == "tunjuk"
        assert d["bantuan"]["token"] == [tok(m, "oren")]
        assert "huruf besar" in d["bantuan"]["alasan"]
        r = self.klik(m, token=tok(m, "oren"))
        assert r.data["bantuan"]["tingkat"] == "letak"
        awal, akhir = r.data["bantuan"]["kalimat"]
        assert awal <= tok(m, "kesekolah") <= akhir
        r = self.klik(m, token=tok(m, "kesekolah"))
        assert r.data["bantuan"] is None
        r = self.klik(m, celah=len(m.data["tokens"]))  # titik hilang di akhir
        assert r.data["selesai"] is True
        assert r.data["versi_benar"].startswith("Oren tidur")


class TestPilihPerasaan(Dasar):
    """Fase B: Modul 4 misi 1 = pilih perasaan + klik bukti, dinilai di server per jawaban."""

    def setUp(self):
        super().setUp()
        for n in (1, 2, 3):
            selesaikan_modul(self.profil, n)
        self.m = self.misi(4, 1)
        self.url = f"/api/penerbit/misi/{self.m.id}/perasaan/"

    def get(self):
        return self.anak.get(f"/api/penerbit/misi/{self.m.id}/").data

    def kirim(self, soal, **kw):
        return self.anak.post(self.url, {"soal": soal, **kw}, format="json")

    def salah_satu_yang_salah(self, i):
        s = self.m.data["soal"][i]
        return next(p for p in s["pilihan"] if p != s["jawaban"])

    def kata_bukan_bukti(self, i):
        s = self.m.data["soal"][i]
        bukti = {t for g in s["bukti"] for t in g}
        return next(t["i"] for t in s["tokens"] if t["j"] == "kata" and t["i"] not in bukti)

    def jawab_benar(self, i):
        s = self.m.data["soal"][i]
        assert self.kirim(i, perasaan=s["jawaban"]).data["hasil"] == "benar"
        r = None
        for g in s["bukti"]:
            r = self.kirim(i, token=g[-1])
        return r

    def test_kunci_tidak_dikirim_kecuali_soal_contoh_oren(self):
        d = self.get()
        assert (d["jenis"], d["tahap_label"]) == ("perasaan", "Contoh dari Oren")
        contoh, *latihan = d["soal"]
        assert contoh["contoh"] is True
        assert contoh["jawaban"] == self.m.data["soal"][0]["jawaban"] and contoh["bukti"]
        for s in latihan:
            assert s["tokens"] and len(s["pilihan"]) >= 2 and s["jumlah_bukti"] >= 1
            for rahasia in ("jawaban", "bukti", "alasan"):
                assert rahasia not in s
        assert d["percobaan"]["soal"] == 1
        assert d["contoh"][0]["pikir"]

    def test_pilih_perasaan_dulu_lalu_klik_bukti(self):
        s = self.m.data["soal"][1]
        assert self.kirim(1, token=s["bukti"][0][0]).status_code == 400
        r = self.kirim(1, perasaan=self.salah_satu_yang_salah(1))
        assert (r.data["hasil"], r.data["meleset"]) == ("belum", 1)
        assert "jawaban" not in r.data
        r = self.kirim(1, perasaan=s["jawaban"])
        assert r.data["hasil"] == "benar"
        r = self.kirim(1, token=self.kata_bukan_bukti(1))
        assert (r.data["hasil"], r.data["meleset"]) == ("meleset", 2)
        r = self.kirim(1, token=s["bukti"][0][0])
        assert (r.data["hasil"], r.data["ditemukan"], r.data["total"]) == ("ketemu", 1, len(s["bukti"]))
        assert self.kirim(1, token=s["bukti"][0][-1]).data["hasil"] == "sudah"
        for g in s["bukti"][1:]:
            r = self.kirim(1, token=g[0])
        assert r.data["butir_selesai"] is True
        assert (r.data["jawaban"], r.data["bukti"], r.data["alasan"]) == (
            s["jawaban"], s["bukti"], s["alasan"])
        assert r.data["soal"] == 2 and r.data["selesai"] is False

    def test_soal_dikerjakan_berurutan_dan_contoh_tidak_dinilai(self):
        jawab = self.m.data["soal"][2]["jawaban"]
        assert self.kirim(2, perasaan=jawab).status_code == 400
        assert self.kirim(0, perasaan=self.m.data["soal"][0]["jawaban"]).status_code == 400
        assert self.kirim(1, perasaan="bukan pilihan").status_code == 400

    def test_dimuat_ulang_melanjutkan_soal_yang_sama(self):
        s = self.m.data["soal"][1]
        self.kirim(1, perasaan=s["jawaban"])
        self.kirim(1, token=s["bukti"][0][0])
        p = self.get()["percobaan"]
        assert p["soal"] == 1
        assert p["perasaan"] == s["jawaban"]
        assert p["diklik"] == [s["bukti"][0][0]]
        assert p["ditemukan"] == 1

    def test_semua_soal_selesai_tercatat_dan_kunci_terbuka(self):
        n = len(self.m.data["soal"])
        self.kirim(1, perasaan=self.salah_satu_yang_salah(1))
        for i in range(1, n):
            r = self.jawab_benar(i)
        assert r.data["selesai"] is True
        assert [x["jawaban"] for x in r.data["soal_jawaban"]] == [
            s["jawaban"] for s in self.m.data["soal"]]
        h = HasilMisi.objects.get(profil=self.profil, misi=self.m)
        # Benar = soal yang perasaannya tepat pada pilihan pertama; soal contoh tidak dihitung.
        assert (h.status, h.benar, h.total, h.meleset) == ("selesai", n - 2, n - 1, 1)
        d = self.get()
        assert d["status"] == "selesai" and d["soal_jawaban"]
        assert self.kirim(1, perasaan=self.m.data["soal"][1]["jawaban"]).status_code == 200  # ulang

    def test_bantuan_memudar_ditunjuk_lalu_letaknya_lalu_sendiri(self):
        s1, s2 = self.m.data["soal"][1:3]
        b = self.get()["bantuan"]
        assert (b["tingkat"], b["soal"]) == ("tunjuk", 1)
        assert b["token"] == sorted(t for g in s1["bukti"] for t in g)
        assert "alasan" not in b  # perasaannya tetap ditebak sendiri
        r = self.jawab_benar(1)
        b = r.data["bantuan"]
        assert set(b) == {"tingkat", "soal", "kalimat"} and b["tingkat"] == "letak"
        awal, akhir = b["kalimat"]
        assert awal <= s2["bukti"][0][0] <= akhir
        r = self.jawab_benar(2)
        assert r.data["bantuan"] is None

    def test_perunggu_kamera_dari_misi_perasaan_dan_lembar(self):
        from penerbit.models import Stiker

        for i in range(1, len(self.m.data["soal"])):
            self.jawab_benar(i)
        assert not Stiker.objects.filter(profil=self.profil, alat__kode="kamera").exists()
        HasilMisi.objects.create(profil=self.profil, misi=self.misi(4, 2), status="selesai")
        from penerbit import hadiah
        hadiah.evaluasi(self.profil)
        assert Stiker.objects.filter(profil=self.profil, alat__kode="kamera",
                                     tingkat="perunggu").exists()

    def test_bukan_misi_perasaan_ditolak(self):
        m = self.misi(4, 4)
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/perasaan/", {"soal": 0, "perasaan": "x"},
                           format="json")
        assert r.status_code == 400


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
        # Potongan yang tidak perlu mengurangi skor untuk syarat Perak (respons tetap 2 dari 2).
        assert r.data["benar"] == 2
        assert (h.benar, h.total) == (1, 2)

    def test_gunting_potong_semua_spasi_bukan_skor_penuh(self):
        m = self.misi(2, 2)
        semua = [t["i"] for t in m.data["tokens"] if t["j"] == "spasi"]
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/periksa/", {"potong": semua},
                           format="json")
        assert r.data["kurang"] == 0
        assert r.data["tidak_perlu"]
        h = HasilMisi.objects.filter(misi=m).first()
        assert h.benar < h.total

    def test_kembar_salah_lalu_benar(self):
        m = self.misi(3, 3)
        url = f"/api/penerbit/misi/{m.id}/periksa/"
        assert self.anak.post(url, {"kata": "Ibu"}, format="json").data["hasil"] == "belum"
        r = self.anak.post(url, {"kata": "Kue"}, format="json")
        assert r.data["hasil"] == "benar"
        h = HasilMisi.objects.filter(misi=m).first()
        assert (h.benar, h.total, h.meleset) == (0, 1, 1)


class TestBantuanGuntingKembar(Dasar):
    """Spec 075 Fase B: Contoh dari Oren + bantuan memudar untuk Gunting dan Detektor Kembar."""

    RAHASIA = ("potong", "boleh", "kata", "pengganti", "alasan", "versi_benar", "kunci")

    def setUp(self):
        super().setUp()
        selesaikan_modul(self.profil, 1)

    def get(self, m):
        return self.anak.get(f"/api/penerbit/misi/{m.id}/").data

    def bantuan(self, m, potong):
        return self.anak.post(f"/api/penerbit/misi/{m.id}/bantuan/", {"potong": potong},
                              format="json")

    def test_gunting_contoh_dari_oren_dengan_suara(self):
        d = self.get(self.misi(2, 1))
        assert (d["tahap"], d["tahap_label"]) == ("bersama", "Contoh dari Oren")
        assert d["suara"] is True
        assert d["contoh"][0]["pikir"]
        for rahasia in self.RAHASIA:
            assert rahasia not in d

    def test_gunting_potongan_pertama_ditunjukkan_kedua_bagiannya_sisanya_sendiri(self):
        m = self.misi(2, 1)
        potong = m.data["potong"]
        b = self.get(m)["bantuan"]
        assert b["tingkat"] == "tunjuk"
        assert b["token"] == potong[0]
        assert b["alasan"] == m.data["alasan"][0]

        # Potongan yang salah tidak mengubah bantuan (tidak membocorkan apa pun).
        salah = m.data["tokens"][1]["i"]
        assert self.bantuan(m, [salah]).data["bantuan"]["tingkat"] == "tunjuk"

        r = self.bantuan(m, [potong[0][0], salah])
        assert r.status_code == 200
        b = r.data["bantuan"]
        assert set(b) == {"tingkat", "kalimat"}  # hanya bagiannya, tanpa letak spasi
        assert b["tingkat"] == "letak"
        awal, akhir = b["kalimat"]
        assert all(awal <= i <= akhir for i in potong[1])
        assert not any(awal <= i <= akhir for g in (potong[0], potong[2], potong[3]) for i in g)

        assert self.bantuan(m, [potong[0][0], potong[1][-1]]).data["bantuan"] is None
        # Bantuan tidak menyelesaikan misi; penilaian tetap lewat Periksa.
        assert not HasilMisi.objects.filter(misi=m).exists()

    def test_bantuan_gunting_hanya_untuk_misi_yang_memakainya(self):
        m = self.misi(2, 2)
        assert "bantuan" not in self.get(m)
        assert self.bantuan(m, []).status_code == 400
        assert self.bantuan(self.misi(2, 1), "x").status_code == 400

    def test_kembar_contoh_kata_kembar_ditunjukkan_dengan_alasan(self):
        selesaikan_modul(self.profil, 2)
        m = self.misi(3, 1)
        d = self.get(m)
        assert (d["tahap"], d["tahap_label"]) == ("bersama", "Contoh dari Oren")
        for rahasia in self.RAHASIA:
            assert rahasia not in d
        b = d["bantuan"]
        assert b["tingkat"] == "tunjuk"
        kata0 = m.data["kata"][0]
        assert b["token"] == [t["i"] for t in m.data["tokens"] if t["t"].lower() == kata0]
        assert b["alasan"] == m.data["alasan"]

        r = self.anak.post(f"/api/penerbit/misi/{m.id}/periksa/", {"kata": kata0}, format="json")
        assert r.data["hasil"] == "benar"
        assert r.data["versi_benar"] == m.data["versi_benar"]
        assert "bantuan" not in self.get(m)

    def test_kembar_tahap_petunjuk_hanya_hitungan_tahap_mandiri_tanpa_bantuan(self):
        selesaikan_modul(self.profil, 2)
        b = self.get(self.misi(3, 2))["bantuan"]
        assert b == {"tingkat": "hitung", "jumlah": 4}  # "Oren" 4 kali, tanpa letak
        assert "bantuan" not in self.get(self.misi(3, 3))
        assert "versi_benar" not in self.get(self.misi(3, 3))


class TestMisiLain(Dasar):
    def test_log_wajib_diisi(self):
        m = self.misi(1, 4)
        url = f"/api/penerbit/misi/{m.id}/tandai/"
        assert self.anak.post(url, {"log": " "}, format="json").status_code == 400
        assert self.anak.post(url, {"log": "Tidak, enak dibaca."}, format="json").status_code == 200
        assert HasilMisi.objects.get(misi=m).log == "Tidak, enak dibaca."

    def test_cetak_menunggu_pemeriksaan(self):
        selesaikan_modul(self.profil, 1)
        selesaikan_modul(self.profil, 2)
        selesaikan_modul(self.profil, 3)
        m = self.misi(4, 5)
        r = self.anak.post(f"/api/penerbit/misi/{m.id}/cetak/")
        assert r.data["status"] == "menunggu"
        assert PemeriksaanLembar.objects.get(profil=self.profil).lembar.kode == "M4-5"

    def test_misi_di_luar_layar_menyebut_langkah_alasan_dan_contoh(self):
        d = self.anak.get(f"/api/penerbit/misi/{self.misi(1, 4).id}/").data
        assert len(d["langkah"]) >= 3
        assert d["kenapa"] and d["contoh"] and d["petunjuk_ortu"]

    def test_rekam_hanya_memakai_teks_misi_yang_sudah_selesai(self):
        url = f"/api/penerbit/misi/{self.misi(1, 5).id}/"

        def teks_rekam():  # tantangan "Rekam suaramu" di Misi Jelajah
            return next(p for p in self.anak.get(url).data["pilihan"] if "teks_rekam" in p)["teks_rekam"]

        assert teks_rekam() == []
        m1 = self.misi(1, 1)
        HasilMisi.objects.create(profil=self.profil, misi=m1, status="selesai")
        assert teks_rekam() == [{"judul": m1.judul, "teks": m1.data["versi_benar"]}]

    def test_tandai_tidak_untuk_misi_klik(self):
        m = self.misi(1, 2)
        assert self.anak.post(f"/api/penerbit/misi/{m.id}/tandai/").status_code == 400

    def test_ujian(self):
        s = SoalUjian.objects.get(modul__nomor=1, urutan=1)
        r = self.anak.post(f"/api/penerbit/ujian/{s.id}/jawab/", {"pilihan": "a"}, format="json")
        assert r.data["benar"] is False
        assert "tapi tapi" in r.data["alasan"]

    def test_latihan_bertanya_modul_terkunci_tidak_membuka_jawaban(self):
        r = self.anak.post("/api/penerbit/bertanya/2/jawab/", {"pilihan": "a"}, format="json")
        assert r.status_code == 403
        selesaikan_modul(self.profil, 1)
        r = self.anak.post("/api/penerbit/bertanya/2/jawab/", {"pilihan": "a"}, format="json")
        assert r.status_code == 200

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
