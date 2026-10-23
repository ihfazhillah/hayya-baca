"""Pemanasan Alat Lama: jadwal ulang 1 hari, 3 hari, 1 minggu, 2 minggu + latihan campuran."""
from datetime import timedelta

from django.utils import timezone

from penerbit import hadiah
from penerbit.impor import ubah_data_soal
from penerbit.jadwal import hari_ini  # tanggal rumah (WIB), bukan UTC
from penerbit.models import Alat, HasilLatihan, JadwalUlang, KalimatLatihan

from .base import Keluarga, impor_modul_1_5


class Dasar(Keluarga):
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

    def jatuh_tempo_hari_ini(self, alat):
        JadwalUlang.objects.filter(profil=self.profil, alat=alat).update(jatuh_tempo=hari_ini())

    def latihan(self):
        return self.anak.get("/api/penerbit/latihan/").data

    def jawab_klik_benar(self, kartu):
        k = KalimatLatihan.objects.get(id=kartu["id"])
        token = k.data["kunci"][0][0]["token"][0]
        return self.anak.post(f"/api/penerbit/latihan/{k.id}/klik/", {"token": token},
                              format="json")


class TestJadwal(Dasar):
    def test_perunggu_menjadwalkan_besok(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        j = JadwalUlang.objects.get(profil=self.profil, alat=self.pengeras)
        assert (j.putaran, j.jatuh_tempo) == (0, hari_ini() + timedelta(days=1))
        data = self.latihan()
        assert data["kartu"] == []
        assert "tidak ada pemanasan" in data["pesan"]

    def test_jatuh_tempo_memberi_tiga_kartu_lalu_jadwal_maju(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        self.jatuh_tempo_hari_ini(self.pengeras)
        data = self.latihan()
        assert len(data["kartu"]) == 3
        kartu = data["kartu"][0]
        assert kartu["alat"]["kode"] == "pengeras"
        assert "kunci" not in kartu
        r = self.jawab_klik_benar(kartu)
        assert r.data["selesai"] is True
        assert HasilLatihan.objects.get(profil=self.profil).benar == 1
        j = JadwalUlang.objects.get(profil=self.profil, alat=self.pengeras)
        assert (j.putaran, j.jatuh_tempo) == (1, hari_ini() + timedelta(days=3))
        # Kartu kedua di hari yang sama tidak memajukan jadwal lagi.
        self.jawab_klik_benar(data["kartu"][1])
        j.refresh_from_db()
        assert j.putaran == 1

    def test_urutan_jarak_lalu_sesekali(self):
        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        jarak = []
        for _ in range(5):
            self.jatuh_tempo_hari_ini(self.pengeras)
            self.jawab_klik_benar(self.latihan()["kartu"][0])
            j = JadwalUlang.objects.get(profil=self.profil, alat=self.pengeras)
            jarak.append((j.jatuh_tempo - hari_ini()).days)
        assert jarak == [3, 7, 14, 30, 30]

    def test_kartu_alat_yang_belum_dipelajari_ditolak(self):
        k = KalimatLatihan.objects.get(kode="gunting-0")
        r = self.anak.post(f"/api/penerbit/latihan/{k.id}/periksa/", {"potong": [3]}, format="json")
        assert r.status_code == 404


class TestCampuran(Dasar):
    def setUp(self):
        super().setUp()
        for alat in (self.pengeras, self.gunting):
            hadiah.beri_stiker(self.profil, alat, "perunggu", oleh=self.ayah)
            self.jatuh_tempo_hari_ini(alat)

    def test_sebagian_kartu_tidak_menyebut_alat(self):
        kartu = self.latihan()["kartu"]
        campuran = [k for k in kartu if k["alat"] is None]
        assert campuran, kartu
        assert {a["kode"] for a in campuran[0]["pilihan_alat"]} == {"pengeras", "gunting"}
        assert kartu[0]["alat"] is not None

    def test_memilih_alat_dulu(self):
        kartu = next(k for k in self.latihan()["kartu"] if k["alat"] is None)
        k = KalimatLatihan.objects.get(id=kartu["id"])
        salah = "gunting" if k.alat.kode == "pengeras" else "pengeras"
        url = f"/api/penerbit/latihan/{k.id}/alat/"
        r = self.anak.post(url, {"alat": salah}, format="json")
        assert r.data["benar"] is False
        r = self.anak.post(url, {"alat": k.alat.kode}, format="json")
        assert r.data["benar"] is True
        assert r.data["alat"]["kode"] == k.alat.kode

    def test_kartu_tetap_sama_sepanjang_hari_setelah_satu_dikerjakan(self):
        sebelum = [k["id"] for k in self.latihan()["kartu"]]
        pertama = KalimatLatihan.objects.get(id=sebelum[0])
        assert pertama.alat == self.pengeras
        self.jawab_klik_benar({"id": pertama.id})
        sesudah = self.latihan()["kartu"]
        assert [k["id"] for k in sesudah] == sebelum
        assert sesudah[0]["selesai"] is True

    def test_alat_tebakan_kemarin_tidak_membuka_alat_hari_ini(self):
        from penerbit.models import Percobaan

        kartu = next(k for k in self.latihan()["kartu"] if k["alat"] is None)
        k = KalimatLatihan.objects.get(id=kartu["id"])
        p = Percobaan.objects.create(profil=self.profil, kalimat=k, alat_dipilih=k.alat,
                                     alat_benar=True, selesai=True)
        Percobaan.objects.filter(id=p.id).update(
            created_at=timezone.now() - timedelta(days=1))
        kartu = next(x for x in self.latihan()["kartu"] if x["id"] == k.id)
        assert kartu["alat"] is None


class TestZonaWaktu(Dasar):
    """Keluarga di WIB: hari baru mulai pukul 00.00 WIB (17.00 UTC), bukan 00.00 UTC."""

    def test_pemanasan_jatuh_tempo_menurut_tanggal_wib(self):
        from datetime import date, datetime, timezone as tz
        from unittest import mock

        hadiah.beri_stiker(self.profil, self.pengeras, "perunggu", oleh=self.ayah)
        JadwalUlang.objects.filter(profil=self.profil).update(jatuh_tempo=date(2026, 10, 24))
        # 24 Okt 01.00 WIB = 23 Okt 18.00 UTC.
        with mock.patch("django.utils.timezone.now",
                        return_value=datetime(2026, 10, 23, 18, 0, tzinfo=tz.utc)):
            kartu = self.latihan()["kartu"]
            assert len(kartu) == 3
            self.jawab_klik_benar(kartu[0])
            j = JadwalUlang.objects.get(profil=self.profil, alat=self.pengeras)
            assert j.terakhir == date(2026, 10, 24)
            assert self.latihan()["kartu"][0]["selesai"] is True
