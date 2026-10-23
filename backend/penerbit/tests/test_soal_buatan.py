"""Spec 075 K4 · Buat soal untuk Ayah ("Mengajarkan orang lain").

Setelah stiker Perak satu alat, anak menulis teks Si Ceroboh sendiri dan menandai kesalahan
yang dia sengaja. Ayah atau Ummah mengerjakannya di Pojok Orang Tua dengan klik yang sama
seperti misi; penilaian per klik di server tanpa membuka kunci. Anak melihat siapa yang
mencoba dan berapa yang ditemukan.
"""
from penerbit.models import Alat, Stiker

from .base import Keluarga, auth, impor_modul_1_5

SIM = {"HTTP_X_PENERBIT_SEBAGAI": "simulasi"}
P = "/api/penerbit"

# Token: 0 Oren · 2 makan · 4 makan · 6 ikan · 7 "." · 9 Dia · 11 senang · 13 sekali · 14 "."
TEKS = "Oren makan makan ikan. Dia senang sekali."
# Token: 0 Oren · 2 pergi · 3 "." · 4 Lalu · 5 spasi · 6 dia · 7 spasi ganda · 8 tidur
TEKS_KACA = "Oren pergi.Lalu dia  tidur"


class Dasar(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        self.q = f"?penulis={self.profil.id}"

    def perak(self, kode, profil=None):
        Stiker.objects.create(profil=profil or self.profil, alat=Alat.objects.get(kode=kode),
                              tingkat="perak")

    def buat(self, kesalahan, alat="pengeras", teks=TEKS, klien=None, **kw):
        return (klien or self.anak).post(f"{P}/soal-buatan/", {
            "alat": alat, "teks": teks, "kesalahan": kesalahan}, format="json", **kw)

    def soal_siap(self):
        self.perak("pengeras")
        r = self.buat([{"token": 4, "kenapa": "Kata makan ada dua."}, {"token": 13}])
        assert r.status_code == 201, r.data
        return r.data["id"]


class TestAnakMembuatSoal(Dasar):
    def test_terbuka_setelah_perak_alat_itu(self):
        r = self.anak.get(f"{P}/soal-buatan/")
        assert r.status_code == 200, r.data
        alat = {a["kode"]: a for a in r.data["alat"]}
        assert alat["pengeras"]["terbuka"] is False
        assert self.buat([{"token": 4}]).status_code == 403

        self.perak("pengeras")
        alat = {a["kode"]: a for a in self.anak.get(f"{P}/soal-buatan/").data["alat"]}
        assert alat["pengeras"]["terbuka"] is True
        assert alat["kembar"]["terbuka"] is False
        # Kaca Pembesar menandai celah (tanda baca), alat lain kata saja.
        assert alat["kaca"]["celah"] is True and alat["pengeras"]["celah"] is False

    def test_token_dari_tokenizer_server(self):
        r = self.anak.post(f"{P}/soal-buatan/token/", {"teks": TEKS}, format="json")
        assert r.status_code == 200, r.data
        assert [t["t"] for t in r.data["tokens"]][:5] == ["Oren", " ", "makan", " ", "makan"]

    def test_simpan_soal_dan_daftar_milik_sendiri(self):
        self.perak("pengeras")
        r = self.buat([{"token": 4, "kenapa": "  Kata makan ada dua.  "}, {"token": 13},
                       {"token": 4}])  # tanda ganda dihitung sekali
        assert r.status_code == 201, r.data
        daftar = self.anak.get(f"{P}/soal-buatan/").data["soal"]
        assert len(daftar) == 1
        s = daftar[0]
        assert s["alat"]["kode"] == "pengeras" and s["teks"] == TEKS
        assert s["jumlah"] == 2
        assert s["kenapa"] == ["Kata makan ada dua.", ""]
        assert s["jawaban"] == []

    def test_kesalahan_harus_bisa_diklik_dan_dalam_batas(self):
        self.perak("pengeras")
        self.perak("kaca")
        assert self.buat([]).status_code == 400
        assert self.buat([{"token": 99}]).status_code == 400
        # Tanda baca dan celah tidak bisa diklik tanpa mode celah.
        assert self.buat([{"token": 7}]).status_code == 400
        assert self.buat([{"celah": 7}]).status_code == 400
        assert self.buat([{"token": i} for i in (0, 2, 4, 6, 9, 11, 13)]).status_code == 201
        delapan = "satu dua tiga empat lima enam tujuh delapan sembilan"
        assert self.buat([{"token": i} for i in range(0, 18, 2)], teks=delapan).status_code == 400
        assert self.buat([{"token": 0}], teks="   ").status_code == 400
        assert self.buat([{"token": 0}], teks="kata " * 200).status_code == 400
        assert self.buat([{"token": 4, "kenapa": "x" * 201}]).status_code == 400

    def test_kaca_menandai_celah_dan_tanda_baca(self):
        self.perak("kaca")
        # Celah di antara "." dan "Lalu" (spasi hilang) dan spasi ganda.
        r = self.buat([{"celah": 4}, {"token": 7}], alat="kaca", teks=TEKS_KACA)
        assert r.status_code == 201, r.data
        # Celah di samping spasi tidak bisa diklik (sama dengan aturan impor).
        assert self.buat([{"celah": 5}], alat="kaca", teks=TEKS_KACA).status_code == 400

    def test_anak_menghapus_soalnya_sendiri(self):
        pk = self.soal_siap()
        lain = auth(self.akun_anak_lain)
        assert lain.delete(f"{P}/soal-buatan/{pk}/").status_code == 404
        assert self.anak.delete(f"{P}/soal-buatan/{pk}/").status_code == 204
        assert self.anak.get(f"{P}/soal-buatan/").data["soal"] == []

    def test_impor_ulang_course_tidak_menghapus_soal(self):
        self.soal_siap()
        impor_modul_1_5()
        assert len(self.anak.get(f"{P}/soal-buatan/").data["soal"]) == 1


class TestOrangTuaMengerjakan(Dasar):
    def test_ayah_mengerjakan_dinilai_server_lalu_anak_melihat_hasilnya(self):
        pk = self.soal_siap()

        dasbor = self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data
        assert dasbor["perlu_tindakan"]["soal_buatan"] == 1

        daftar = self.ortu.get(f"{P}/ortu/soal-buatan/{self.q}").data
        assert len(daftar["soal"]) == 1 and daftar["penulis"] == "Fatih"
        assert daftar["soal"][0]["jumlah"] == 2 and daftar["soal"][0]["punyaku"] is None

        d = self.ortu.get(f"{P}/ortu/soal-buatan/{pk}/").data
        assert d["jumlah"] == 2 and d["celah"] is False
        assert [t["t"] for t in d["tokens"]][:3] == ["Oren", " ", "makan"]
        # Kunci dan alasan anak tetap di server sampai selesai.
        assert "kunci" not in d and "kenapa" not in d and "data" not in d

        klik = f"{P}/ortu/soal-buatan/{pk}/klik/"
        r = self.ortu.post(klik, {"token": 0}, format="json")
        assert r.data["hasil"] == "meleset" and "kunci" not in r.data
        r = self.ortu.post(klik, {"token": 4}, format="json")
        assert r.data["hasil"] == "ketemu" and r.data["ditemukan"] == 1 and r.data["total"] == 2
        assert "kunci" not in r.data
        r = self.ortu.post(klik, {"token": 13}, format="json")
        assert r.data["selesai"] is True
        assert r.data["kunci"] == [[{"token": [4], "celah": None}], [{"token": [13], "celah": None}]]
        assert r.data["kenapa"] == ["Kata makan ada dua.", ""]
        # Setelah selesai, klik tidak mengubah skor.
        assert self.ortu.post(klik, {"token": 0}, format="json").status_code == 400

        assert self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data["perlu_tindakan"]["soal_buatan"] == 0
        lanjut = self.ortu.get(f"{P}/ortu/soal-buatan/{pk}/").data
        assert lanjut["punyaku"]["selesai"] is True and lanjut["kunci"]

        s = self.anak.get(f"{P}/soal-buatan/").data["soal"][0]
        assert len(s["jawaban"]) == 1
        j = s["jawaban"][0]
        assert j["oleh"] == "ayah" and j["ditemukan"] == 2 and j["total"] == 2
        assert j["meleset"] == 1 and j["selesai"] is True

    def test_ummah_berhenti_lebih_awal_tercatat_terpisah(self):
        pk = self.soal_siap()
        ummah = auth(self.ummah)
        ummah.post(f"{P}/ortu/soal-buatan/{pk}/klik/", {"token": 13}, format="json")
        r = ummah.post(f"{P}/ortu/soal-buatan/{pk}/berhenti/")
        assert r.status_code == 200, r.data
        assert r.data["selesai"] is True and r.data["kunci"]
        jawaban = self.anak.get(f"{P}/soal-buatan/").data["soal"][0]["jawaban"]
        assert [(j["oleh"], j["ditemukan"], j["selesai"]) for j in jawaban] == [("ummah", 1, True)]

    def test_keluarga_lain_404_anak_dan_kakak_tidak_bisa_mengerjakan(self):
        pk = self.soal_siap()
        lain = auth(self.ayah_lain)
        assert lain.get(f"{P}/ortu/soal-buatan/{pk}/").status_code == 404
        assert lain.post(f"{P}/ortu/soal-buatan/{pk}/klik/", {"token": 4},
                         format="json").status_code == 404
        assert lain.get(f"{P}/ortu/soal-buatan/{self.q}").status_code == 404
        # Anak tidak bisa mengerjakan soalnya sendiri untuk skor.
        assert self.anak.post(f"{P}/ortu/soal-buatan/{pk}/klik/", {"token": 4},
                              format="json").status_code == 403
        assert auth(self.kakak).get(f"{P}/ortu/soal-buatan/{pk}/").status_code == 403
        assert self.anak.get(f"{P}/soal-buatan/").data["soal"][0]["jawaban"] == []


class TestSimulasi(Dasar):
    def test_orang_tua_mengerjakan_soal_dari_simulasinya_sendiri(self):
        # Profil simulasi: semua alat terbuka tanpa stiker.
        r = self.buat([{"token": 4}], klien=self.ortu, **SIM)
        assert r.status_code == 201, r.data
        pk = r.data["id"]
        assert self.anak.get(f"{P}/soal-buatan/").data["soal"] == []
        assert self.ortu.get(f"{P}/ortu/soal-buatan/{self.q}").data["soal"] == []
        sim = self.ortu.get(f"{P}/ortu/soal-buatan/?simulasi=1").data["soal"]
        assert [s["id"] for s in sim] == [pk]
        r = self.ortu.post(f"{P}/ortu/soal-buatan/{pk}/klik/", {"token": 4}, format="json")
        assert r.data["selesai"] is True
        jawaban = self.ortu.get(f"{P}/soal-buatan/", **SIM).data["soal"][0]["jawaban"]
        assert jawaban[0]["oleh"] == "ayah" and jawaban[0]["ditemukan"] == 1
        # Simulasi Ayah bukan milik Ummah.
        assert auth(self.ummah).get(f"{P}/ortu/soal-buatan/{pk}/").status_code == 404
