"""Editor Tamu: hanya naskah yang dibagikan, hanya membaca dan mengisi Kartu Ulasan."""
from penerbit.models import BagiNaskah, KartuUlasan, Naskah, Versi

from .base import Keluarga, auth


class TestEditorTamu(Keluarga):
    def setUp(self):
        super().setUp()
        self.n = Naskah.objects.create(profil=self.profil, judul="Sandal", tahap="revisi")
        self.v1 = Versi.objects.create(naskah=self.n, nomor=1, teks="Versi satu.")
        self.v2 = Versi.objects.create(naskah=self.n, nomor=2, teks="Versi dua.", lapis="peta")
        BagiNaskah.objects.create(naskah=self.n, user=self.kakak, versi=self.v1,
                                  dibagikan_oleh=self.ayah)
        self.tamu = auth(self.kakak)

    def test_me_menunjukkan_peran_tamu(self):
        assert self.tamu.get("/api/penerbit/me/").data["peran"] == ["tamu"]

    def test_membaca_versi_yang_dibagikan_saja(self):
        assert [x["judul"] for x in self.tamu.get("/api/penerbit/ulasan/").data] == ["Sandal"]
        d = self.tamu.get(f"/api/penerbit/ulasan/{self.n.id}/").data
        assert d["teks"] == "Versi satu."
        assert "draf" not in d

    def test_mengirim_kartu_ulasan(self):
        r = self.tamu.post(f"/api/penerbit/ulasan/{self.n.id}/", {
            "favorit": "Bagian kakek.", "membingungkan": "Sandal siapa?", "pertanyaan": "Kenapa hijau?",
        }, format="json")
        assert r.status_code == 201
        u = KartuUlasan.objects.get(naskah=self.n)
        assert (u.penulis, u.versi) == (self.kakak, self.v1)
        ulasan = self.anak.get(f"/api/penerbit/naskah/{self.n.id}/").data["ulasan"]
        assert ulasan[0]["favorit"] == "Bagian kakek."

    def test_kartu_ulasan_wajib_lengkap(self):
        r = self.tamu.post(f"/api/penerbit/ulasan/{self.n.id}/", {"favorit": "x"}, format="json")
        assert r.status_code == 400

    def test_naskah_tidak_dibagikan_404(self):
        lain = Naskah.objects.create(profil=self.profil, judul="Lain")
        assert self.tamu.get(f"/api/penerbit/ulasan/{lain.id}/").status_code == 404

    def test_tamu_tidak_bisa_masuk_area_ortu_atau_penulis(self):
        assert self.tamu.get("/api/penerbit/ortu/dasbor/").status_code == 403
        assert self.tamu.get(f"/api/penerbit/naskah/{self.n.id}/").status_code == 403
