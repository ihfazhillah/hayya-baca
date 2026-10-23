"""Spec 075 K2 (Tanya Ayah atau Ummah) dan K3 (Kartu Pamer).

Anak belajar sendiri, bertanya bila bingung, lalu memamerkan hasilnya di akhir modul.
Orang tua menjawab pertanyaan dan memberi reaksi dari Pojok Orang Tua.
"""
from penerbit.models import HasilMisi, KartuPamer, Misi, Pertanyaan, ProfilPenulis, Stiker

from .base import Keluarga, auth, impor_modul_1_5, selesaikan_modul

SIM = {"HTTP_X_PENERBIT_SEBAGAI": "simulasi"}
P = "/api/penerbit"


def selesai(profil, modul, urutan, status="selesai"):
    m = Misi.objects.get(modul__nomor=modul, urutan=urutan)
    HasilMisi.objects.create(profil=profil, misi=m, status=status)
    return m


class Dasar(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        self.q = f"?penulis={self.profil.id}"


class TestTanyaAyah(Dasar):
    def tanya(self, teks, misi=None, klien=None, **kw):
        misi = misi or Misi.objects.get(modul__nomor=1, urutan=2)
        return (klien or self.anak).post(f"{P}/pertanyaan/", {"teks": teks, "misi": misi.id},
                                         format="json", **kw)

    def test_anak_bertanya_dari_misi_lalu_ayah_menjawab_dan_catatannya_sampai_ke_anak(self):
        r = self.tanya("  Kenapa kata yang sama tidak boleh dua kali?  ")
        assert r.status_code == 201, r.data
        assert "lanjut" in r.data["pesan"]
        p = Pertanyaan.objects.get()
        assert p.profil == self.profil and p.modul.nomor == 1 and p.misi.urutan == 2
        assert p.teks == "Kenapa kata yang sama tidak boleh dua kali?"

        # Pojok Orang Tua: angka di dasbor dan daftar dengan konteks modul/misi.
        dasbor = self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data
        assert dasbor["perlu_tindakan"]["pertanyaan"] == 1
        daftar = self.ortu.get(f"{P}/ortu/pertanyaan/{self.q}").data
        assert len(daftar) == 1
        d = daftar[0]
        assert d["teks"] == p.teks and d["dijawab"] is False
        assert d["modul"]["nomor"] == 1 and d["modul"]["judul"]
        assert d["misi"]["urutan"] == 2 and d["misi"]["judul"] == p.misi.judul

        r = self.ortu.post(f"{P}/ortu/pertanyaan/{p.id}/dijawab/",
                           {"catatan": "Supaya pembaca tidak tersandung."}, format="json")
        assert r.status_code == 200, r.data
        p.refresh_from_db()
        assert p.dijawab_oleh == self.ayah and p.dijawab_pada is not None
        assert self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data["perlu_tindakan"]["pertanyaan"] == 0

        # Anak melihat jawabannya: di daftar miliknya dan di kabar Beranda.
        milik = self.anak.get(f"{P}/pertanyaan/").data
        assert milik[0]["dijawab"] is True and milik[0]["catatan"] == "Supaya pembaca tidak tersandung."
        kabar = self.anak.get(f"{P}/beranda/").data["kabar"]
        assert any(k["jenis"] == "jawaban" and k["catatan"] == "Supaya pembaca tidak tersandung."
                   for k in kabar)

    def test_dijawab_tanpa_catatan_boleh(self):
        self.tanya("Apa itu tersandung?")
        p = Pertanyaan.objects.get()
        assert self.ortu.post(f"{P}/ortu/pertanyaan/{p.id}/dijawab/").status_code == 200
        p.refresh_from_db()
        assert p.dijawab_pada is not None and p.catatan == ""

    def test_pertanyaan_kosong_atau_terlalu_panjang_ditolak(self):
        assert self.tanya("   ").status_code == 400
        assert self.tanya("a" * 301).status_code == 400
        assert self.tanya("a" * 300).status_code == 201
        assert Pertanyaan.objects.count() == 1

    def test_misi_di_modul_terkunci_ditolak(self):
        m = Misi.objects.get(modul__nomor=3, urutan=1)
        assert self.tanya("Boleh?", misi=m).status_code == 403
        assert not Pertanyaan.objects.exists()

    def test_anak_tidak_bisa_menandai_dijawab(self):
        self.tanya("Apa itu tersandung?")
        p = Pertanyaan.objects.get()
        assert self.anak.post(f"{P}/ortu/pertanyaan/{p.id}/dijawab/").status_code == 403
        assert self.anak.get(f"{P}/ortu/pertanyaan/").status_code == 403

    def test_keluarga_lain_404(self):
        self.tanya("Apa itu tersandung?")
        p = Pertanyaan.objects.get()
        lain = auth(self.ayah_lain)
        assert lain.post(f"{P}/ortu/pertanyaan/{p.id}/dijawab/").status_code == 404
        assert lain.get(f"{P}/ortu/pertanyaan/{self.q}").status_code == 404
        p.refresh_from_db()
        assert p.dijawab_pada is None

    def test_pertanyaan_simulasi_tidak_tercampur_dengan_anak(self):
        assert self.tanya("Coba dari simulasi", klien=self.ortu, **SIM).status_code == 201
        assert Pertanyaan.objects.get().profil.simulasi_oleh == self.ayah
        assert self.anak.get(f"{P}/pertanyaan/").data == []
        assert self.ortu.get(f"{P}/ortu/pertanyaan/{self.q}").data == []
        assert self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data["perlu_tindakan"]["pertanyaan"] == 0
        assert len(self.ortu.get(f"{P}/pertanyaan/", **SIM).data) == 1


class TestKartuPamer(Dasar):
    def url(self, nomor=1):
        return f"{P}/modul/{nomor}/kartu-pamer/"

    def test_belum_tersedia_sebelum_misi_utama_selesai(self):
        selesai(self.profil, 1, 1)
        d = self.anak.get(self.url()).data
        assert d["tersedia"] is False and d["kartu"] is None
        r = self.anak.post(self.url(), {"pelajaran": "Aku belajar membaca keras."}, format="json")
        assert r.status_code == 400
        assert not KartuPamer.objects.exists()

    def test_sebelum_sesudah_dari_misi_selesai_saja_lalu_disimpan_dan_diubah(self):
        for u in (1, 2, 4):
            selesai(self.profil, 1, u)
        # Misi 3 masih menunggu: modul tetap dihitung selesai, tapi kuncinya tidak boleh bocor.
        m3 = selesai(self.profil, 1, 3, status="menunggu")
        d = self.anak.get(self.url()).data
        assert d["tersedia"] is True
        m2 = Misi.objects.get(modul__nomor=1, urutan=2)
        assert d["hasil"]["sebelum"] == m2.data["teks"]
        assert d["hasil"]["sesudah"] == m2.data["versi_benar"]
        assert m3.data["versi_benar"] not in str(d)

        assert self.anak.post(self.url(), {"pelajaran": "  "}, format="json").status_code == 400
        r = self.anak.post(self.url(), {"pelajaran": "Telingaku bisa menemukan kesalahan."},
                           format="json")
        assert r.status_code == 201, r.data
        r = self.anak.post(self.url(), {"pelajaran": "Membaca keras membantuku."}, format="json")
        assert r.status_code == 200
        k = KartuPamer.objects.get()
        assert k.profil == self.profil and k.modul.nomor == 1
        assert k.pelajaran == "Membaca keras membantuku."
        assert self.anak.get(self.url()).data["kartu"]["pelajaran"] == "Membaca keras membantuku."

    def test_modul_tanpa_teks_si_ceroboh_hanya_kalimat(self):
        selesaikan_modul(self.profil, 1)
        selesaikan_modul(self.profil, 2)
        selesaikan_modul(self.profil, 3)
        for m in Misi.objects.filter(modul__nomor=3):
            m.data.pop("versi_benar", None)
            m.save()
        d = self.anak.get(self.url(3)).data
        assert d["tersedia"] is True and d["hasil"] is None

    def test_detektor_kembar_juga_punya_sebelum_sesudah(self):
        selesaikan_modul(self.profil, 1)
        selesaikan_modul(self.profil, 2)
        selesaikan_modul(self.profil, 3)
        d = self.anak.get(self.url(3)).data
        assert d["hasil"]["sesudah"]
        assert d["hasil"]["sebelum"] != d["hasil"]["sesudah"]

    def test_orang_tua_memberi_reaksi_dan_stiker_lalu_muncul_di_beranda(self):
        selesaikan_modul(self.profil, 1)
        self.anak.post(self.url(), {"pelajaran": "Telingaku pintar."}, format="json")
        k = KartuPamer.objects.get()
        daftar = self.ortu.get(f"{P}/ortu/kartu-pamer/{self.q}").data["kartu"]
        assert len(daftar) == 1
        assert daftar[0]["pelajaran"] == "Telingaku pintar." and daftar[0]["modul"]["nomor"] == 1
        assert daftar[0]["hasil"]["sesudah"]
        assert daftar[0]["alat"]["kode"] == "pengeras"
        assert self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data["perlu_tindakan"]["kartu_pamer"] == 1

        r = self.ortu.post(f"{P}/ortu/kartu-pamer/{k.id}/reaksi/",
                           {"emoji": "👏", "kalimat": "Ayah bangga!"}, format="json")
        assert r.status_code == 200, r.data
        k.refresh_from_db()
        assert k.reaksi_emoji == "👏" and k.reaksi == "Ayah bangga!"
        assert k.reaksi_oleh == self.ayah and k.reaksi_pada is not None
        assert self.ortu.get(f"{P}/ortu/dasbor/{self.q}").data["perlu_tindakan"]["kartu_pamer"] == 0

        # Stiker tetap lewat jalur stiker yang sudah ada.
        r = self.ortu.post(f"{P}/ortu/stiker/{self.q}", {"alat": "pengeras", "tingkat": "perunggu"},
                           format="json")
        assert r.status_code in (201, 400)  # 400 bila sudah otomatis didapat
        assert Stiker.objects.filter(profil=self.profil, alat__kode="pengeras",
                                     tingkat="perunggu").exists()

        kabar = self.anak.get(f"{P}/beranda/").data["kabar"]
        reaksi = [x for x in kabar if x["jenis"] == "reaksi"]
        assert reaksi and reaksi[0]["emoji"] == "👏" and reaksi[0]["catatan"] == "Ayah bangga!"
        assert "Kartu Pamer" in reaksi[0]["teks"]
        assert self.anak.get(self.url()).data["kartu"]["reaksi_emoji"] == "👏"

    def test_reaksi_kosong_atau_emoji_asing_ditolak(self):
        selesaikan_modul(self.profil, 1)
        self.anak.post(self.url(), {"pelajaran": "Telingaku pintar."}, format="json")
        k = KartuPamer.objects.get()
        u = f"{P}/ortu/kartu-pamer/{k.id}/reaksi/"
        assert self.ortu.post(u, {}, format="json").status_code == 400
        assert self.ortu.post(u, {"emoji": "<b>"}, format="json").status_code == 400
        assert self.ortu.post(u, {"kalimat": "Bagus sekali."}, format="json").status_code == 200

    def test_anak_tidak_bisa_memberi_reaksi_dan_keluarga_lain_404(self):
        selesaikan_modul(self.profil, 1)
        self.anak.post(self.url(), {"pelajaran": "Telingaku pintar."}, format="json")
        k = KartuPamer.objects.get()
        u = f"{P}/ortu/kartu-pamer/{k.id}/reaksi/"
        assert self.anak.post(u, {"emoji": "👏"}, format="json").status_code == 403
        assert auth(self.ayah_lain).post(u, {"emoji": "👏"}, format="json").status_code == 404
        assert auth(self.ayah_lain).get(f"{P}/ortu/kartu-pamer/{self.q}").status_code == 404
        k.refresh_from_db()
        assert k.reaksi_emoji == ""

    def test_kartu_pamer_tidak_mengunci_modul_berikutnya(self):
        selesaikan_modul(self.profil, 1)
        assert self.anak.get(f"{P}/modul/2/").data["terkunci"] is False

    def test_kartu_simulasi_terpisah_dari_anak(self):
        r = self.ortu.get(self.url(), **SIM)
        assert r.status_code == 200
        profil_sim = ProfilPenulis.objects.get(simulasi_oleh=self.ayah)
        selesaikan_modul(profil_sim, 1)
        assert self.ortu.post(self.url(), {"pelajaran": "Dari simulasi."}, format="json",
                              **SIM).status_code == 201
        assert self.anak.get(self.url()).data["kartu"] is None
        assert self.ortu.get(f"{P}/ortu/kartu-pamer/{self.q}").data["kartu"] == []


class TestSisiOrtuUntukSimulasi(Dasar):
    """Orang tua bisa mencoba sisi menjawab dan memberi reaksi lewat simulasinya sendiri."""

    def test_pertanyaan_dan_kartu_simulasi_terlihat_dengan_simulasi_1(self):
        m = Misi.objects.get(modul__nomor=1, urutan=2)
        self.ortu.post(f"{P}/pertanyaan/", {"teks": "Uji", "misi": m.id}, format="json", **SIM)
        profil_sim = ProfilPenulis.objects.get(simulasi_oleh=self.ayah)
        selesaikan_modul(profil_sim, 1)
        self.ortu.post(f"{P}/modul/1/kartu-pamer/", {"pelajaran": "Uji."}, format="json", **SIM)

        daftar = self.ortu.get(f"{P}/ortu/pertanyaan/?simulasi=1").data
        assert [p["teks"] for p in daftar] == ["Uji"]
        assert self.ortu.post(f"{P}/ortu/pertanyaan/{daftar[0]['id']}/dijawab/",
                              {}, format="json").status_code == 200
        kartu = self.ortu.get(f"{P}/ortu/kartu-pamer/?simulasi=1").data["kartu"]
        assert self.ortu.post(f"{P}/ortu/kartu-pamer/{kartu[0]['id']}/reaksi/",
                              {"emoji": "👏"}, format="json").status_code == 200

        # Orang tua lain tidak melihat atau menyentuh simulasi milik Ayah.
        lain = auth(self.ayah_lain)
        assert lain.get(f"{P}/ortu/pertanyaan/?simulasi=1").data == []
        assert lain.post(f"{P}/ortu/pertanyaan/{daftar[0]['id']}/dijawab/", {},
                         format="json").status_code == 404
