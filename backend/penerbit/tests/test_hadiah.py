"""Poin, stiker berbasis data, dan pangkat (plan 074 keputusan 4–5)."""
from penerbit import hadiah
from penerbit.models import (
    Alat, HasilLatihan, HasilMisi, Jejak, KalimatLatihan, Misi, Naskah, Pangkat, Poin, Stiker,
    Versi,
)

from .base import Keluarga, impor_modul_1_5


def total_poin(profil):
    return sum(Poin.objects.filter(profil=profil).values_list("jumlah", flat=True))


class Dasar(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()
        self.pengeras = Alat.objects.get(kode="pengeras")
        self.gunting = Alat.objects.get(kode="gunting")

    def selesai(self, modul, urutan, **kw):
        m = Misi.objects.get(modul__nomor=modul, urutan=urutan)
        HasilMisi.objects.create(profil=self.profil, misi=m, status=kw.pop("status", "selesai"), **kw)
        return hadiah.evaluasi(self.profil)

    def punya(self, alat, tingkat):
        return Stiker.objects.filter(profil=self.profil, alat=alat, tingkat=tingkat).exists()


class TestPoinMisi(Dasar):
    def test_satu_poin_per_misi_sekali_saja(self):
        self.selesai(1, 4)
        self.selesai(1, 4)
        assert total_poin(self.profil) == 1

    def test_menunggu_pemeriksaan_belum_dapat_poin(self):
        self.selesai(2, 5, status="menunggu")
        assert total_poin(self.profil) == 0


class TestPerunggu(Dasar):
    def test_misi_bersama_dan_petunjuk_memberi_perunggu(self):
        self.selesai(1, 1)
        assert not self.punya(self.pengeras, "perunggu")
        baru = self.selesai(1, 2)
        assert self.punya(self.pengeras, "perunggu")
        assert {"jenis": "stiker", "alat": "pengeras", "tingkat": "perunggu",
                "nama": "Pengeras Suara", "emoji": "🔊"} in baru
        assert total_poin(self.profil) == 1 + 1 + 5
        assert Stiker.objects.get(alat=self.pengeras).diberikan_oleh is None

    def test_lewat_api_klik_mengembalikan_stiker_baru(self):
        self.selesai(1, 1)
        m = Misi.objects.get(modul__nomor=1, urutan=2)
        for i, grup in enumerate(m.data["kunci"]):
            r = self.anak.post(f"/api/penerbit/misi/{m.id}/klik/",
                               {"token": grup[0]["token"][0]}, format="json")
        assert r.data["selesai"] is True
        assert any(h["jenis"] == "stiker" for h in r.data["hadiah_baru"])


class TestPerak(Dasar):
    def setUp(self):
        super().setUp()
        self.kalimat = KalimatLatihan.objects.create(
            kode="pengeras-uji", alat=self.pengeras, jenis="klik", data={}
        )

    def latihan(self, benar, total):
        HasilLatihan.objects.create(profil=self.profil, kalimat=self.kalimat,
                                    alat=self.pengeras, benar=benar, total=total)
        return hadiah.evaluasi(self.profil)

    def test_dua_kali_berturut_di_teks_baru(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        self.selesai(1, 3, benar=2, total=2)  # misi mandiri
        assert not self.punya(self.pengeras, "perak")
        self.latihan(4, 5)
        assert self.punya(self.pengeras, "perak")

    def test_skor_rendah_memutus_beruntun(self):
        self.selesai(1, 3, benar=2, total=2)
        self.latihan(3, 5)
        self.latihan(4, 5)
        assert not self.punya(self.pengeras, "perak")

    def test_hanya_percobaan_pertama_di_teks_yang_sama(self):
        self.selesai(1, 3, benar=0, total=2)
        self.selesai(1, 3, benar=2, total=2)  # mengulang teks yang sama
        self.latihan(5, 5)
        assert not self.punya(self.pengeras, "perak")

    def test_pakai_petunjuk_tidak_dihitung(self):
        self.selesai(1, 3, benar=2, total=2, pakai_petunjuk=True)
        self.latihan(5, 5)
        assert not self.punya(self.pengeras, "perak")

    def test_perak_menunggu_perunggu(self):
        self.selesai(1, 3, benar=2, total=2)
        self.latihan(5, 5)
        assert not self.punya(self.pengeras, "perak")
        self.selesai(1, 1)
        self.selesai(1, 2)
        assert self.punya(self.pengeras, "perunggu") and self.punya(self.pengeras, "perak")

    def test_kemajuan_untuk_kartu_alat(self):
        self.selesai(1, 3, benar=2, total=2)
        kemajuan = hadiah.kemajuan(self.profil, self.pengeras, "perak")
        assert kemajuan == {"sekarang": 1, "target": 2}


class TestEmasDariJejak(Dasar):
    def cerita(self, kalimat_terpanjang):
        n = Naskah.objects.create(profil=self.profil, judul="x")
        v = Versi.objects.create(naskah=n, nomor=1, teks="x")
        Jejak.objects.create(versi=v, jumlah_kata=100, kalimat_terpanjang=kalimat_terpanjang)
        return hadiah.evaluasi(self.profil)

    def test_emas_hanya_untuk_alat_yang_sudah_dipelajari(self):
        self.cerita(10)
        self.cerita(12)
        assert not self.punya(self.gunting, "emas")  # Gunting belum punya Perunggu
        hadiah.beri_stiker(self.profil, self.gunting, "perunggu", oleh=self.ayah)
        hadiah.evaluasi(self.profil)
        assert self.punya(self.gunting, "emas")

    def test_dua_draf_nol_berturut_tanpa_kalimat_panjang(self):
        hadiah.beri_stiker(self.profil, self.gunting, "perunggu", oleh=self.ayah)
        self.cerita(24)
        self.cerita(18)
        assert not self.punya(self.gunting, "emas")
        self.cerita(15)
        assert self.punya(self.gunting, "emas")
        assert total_poin(self.profil) >= 30

    def test_syarat_pemeriksa_tidak_pernah_otomatis(self):
        for _ in range(3):
            self.cerita(5)
        assert not self.punya(self.pengeras, "emas")


class TestBeriStikerOlehPemeriksa(Dasar):
    def test_pemeriksa_memberi_dan_tercatat(self):
        baru = hadiah.beri_stiker(self.profil, self.pengeras, "emas", oleh=self.ayah)
        assert baru
        s = Stiker.objects.get(alat=self.pengeras, tingkat="emas")
        assert s.diberikan_oleh == self.ayah
        assert total_poin(self.profil) == 30
        assert hadiah.beri_stiker(self.profil, self.pengeras, "emas", oleh=self.ummah) == []


class TestPangkat(Dasar):
    def test_magang_setelah_lima_perunggu(self):
        for alat in Alat.objects.all()[:4]:
            hadiah.beri_stiker(self.profil, alat, "perunggu", oleh=self.ayah)
        self.profil.refresh_from_db()
        assert self.profil.pangkat is None
        baru = hadiah.beri_stiker(self.profil, Alat.objects.get(kode="kaca"), "perunggu",
                                  oleh=self.ayah)
        self.profil.refresh_from_db()
        assert self.profil.pangkat.kode == "magang"
        assert {"jenis": "pangkat", "nama": "Penulis Magang"} in baru

    def test_buku_terbit_menaikkan_pangkat_dan_tidak_pernah_turun(self):
        Naskah.objects.create(profil=self.profil, judul="Sandal", tahap="terbit")
        hadiah.evaluasi(self.profil)
        self.profil.refresh_from_db()
        assert self.profil.pangkat.kode == "penulis"
        Naskah.objects.all().delete()
        hadiah.evaluasi(self.profil)
        self.profil.refresh_from_db()
        assert self.profil.pangkat == Pangkat.objects.get(kode="penulis")


class TestJejakMembaik(Dasar):
    def cerita(self, **angka):
        n = Naskah.objects.create(profil=self.profil, judul="x")
        v = Versi.objects.create(naskah=n, nomor=1, teks="x")
        Jejak.objects.create(versi=v, **{"jumlah_kata": 100, **angka})
        hadiah.evaluasi(self.profil)

    def test_sepuluh_poin_bila_dua_angka_membaik(self):
        self.cerita(kalimat_terpanjang=24, kata_kembar_jumlah=4, kalimat_perasaan=3)
        sebelum = total_poin(self.profil)
        self.cerita(kalimat_terpanjang=15, kata_kembar_jumlah=3, kalimat_perasaan=3)
        assert Poin.objects.filter(profil=self.profil, kunci_sumber__startswith="jejak:").count() == 1
        assert total_poin(self.profil) - sebelum >= 10
