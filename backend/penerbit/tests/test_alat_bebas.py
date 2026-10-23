"""Spec 075 K4 · Alat Bebas: anak menempel paragraf apa saja lalu memakai stabilo alat yang sudah
terbuka. Tanda sistem (kata kembar, kalimat panjang) bisa dinyalakan. Tidak dinilai dan tidak
disimpan sebagai naskah."""
from penerbit.models import Alat, Naskah, Stiker

from .base import Keluarga, impor_modul_1_5

SIM = {"HTTP_X_PENERBIT_SEBAGAI": "simulasi"}
URL = "/api/penerbit/alat-bebas/sorotan-sistem/"
KEMBAR = "Kucing itu lucu. Kucing makan. Kucing tidur. Kucing main bola."
PANJANG = " ".join(f"kata{i}" for i in range(22)) + "."  # satu kalimat 22 kata, tanpa kembar


class TestAlatBebas(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()

    def perunggu(self, kode):
        Stiker.objects.create(profil=self.profil, alat=Alat.objects.get(kode=kode),
                              tingkat="perunggu")

    def sorot(self, teks, alat, klien=None, **kw):
        return (klien or self.anak).post(URL, {"teks": teks, "alat": alat}, format="json", **kw)

    def test_tanda_sistem_hanya_untuk_alat_yang_sudah_terbuka(self):
        r = self.sorot(KEMBAR, ["kembar", "gunting"])
        assert r.status_code == 200, r.data
        assert r.data == []

        self.perunggu("kembar")
        r = self.sorot(KEMBAR + " " + PANJANG, ["kembar", "gunting"])
        assert {s["alat"] for s in r.data} == {"kembar"}
        assert [KEMBAR[s["index"]:s["index"] + s["length"]] for s in r.data] == ["Kucing"] * 4
        assert all(s["sumber"] == "sistem" for s in r.data)

        self.perunggu("gunting")
        r = self.sorot(PANJANG, ["gunting"])
        assert [s["alat"] for s in r.data] == ["gunting"]
        # Tidak disimpan sebagai naskah.
        assert Naskah.objects.count() == 0

    def test_simulasi_semua_alat_terbuka(self):
        r = self.sorot(KEMBAR, ["kembar"], klien=self.ortu, **SIM)
        assert r.status_code == 200 and len(r.data) == 4

    def test_teks_terlalu_panjang_ditolak(self):
        self.perunggu("kembar")
        assert self.sorot("a " * 3000, ["kembar"]).status_code == 400
