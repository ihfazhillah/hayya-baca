"""Orang tua melihat area anak lewat profil simulasi miliknya sendiri.

Progres simulasi tidak boleh menyentuh data anak sungguhan.
"""
from penerbit.models import HasilMisi, Misi, ProfilPenulis

from .base import Keluarga, auth, impor_modul_1_5

SIM = {"HTTP_X_PENERBIT_SEBAGAI": "simulasi"}


class TestSimulasi(Keluarga):
    def setUp(self):
        super().setUp()
        impor_modul_1_5()

    def test_me_menawarkan_simulasi_untuk_pemeriksa(self):
        assert self.ortu.get("/api/penerbit/me/").data["bisa_simulasi"] is True
        assert self.anak.get("/api/penerbit/me/").data["bisa_simulasi"] is False

    def test_dengan_header_orang_tua_menjadi_penulis_simulasi(self):
        d = self.ortu.get("/api/penerbit/me/", **SIM).data
        assert d["peran"] == ["penulis"]
        assert d["sedang_simulasi"] is True
        p = ProfilPenulis.objects.get(id=d["penulis"]["id"])
        assert p.simulasi_oleh == self.ayah and p.child is None
        # Profil simulasi bukan anak yang diperiksa.
        assert [x["id"] for x in self.ortu.get("/api/penerbit/me/").data["pemeriksa"]] == [self.profil.id]

    def test_progres_simulasi_terpisah_dari_anak(self):
        m = Misi.objects.get(modul__nomor=1, urutan=4)
        r = self.ortu.post(f"/api/penerbit/misi/{m.id}/tandai/", {"log": "coba"}, format="json", **SIM)
        assert r.status_code == 200
        assert not HasilMisi.objects.filter(profil=self.profil).exists()
        assert HasilMisi.objects.filter(profil__simulasi_oleh=self.ayah).count() == 1

    def test_semua_modul_terbuka_di_simulasi(self):
        assert self.ortu.get("/api/penerbit/modul/5/", **SIM).data["terkunci"] is False
        m = Misi.objects.get(modul__nomor=5, urutan=2)
        assert self.ortu.get(f"/api/penerbit/misi/{m.id}/", **SIM).status_code == 200

    def test_peta_simulasi_tidak_menampilkan_gembok(self):
        peta = self.ortu.get("/api/penerbit/beranda/", **SIM).data["peta"]
        assert [p["status"] for p in peta] == ["aktif"] + ["terbuka"] * 4

    def test_mulai_ulang_menghapus_progres_simulasi_saja(self):
        m = Misi.objects.get(modul__nomor=1, urutan=4)
        self.ortu.post(f"/api/penerbit/misi/{m.id}/tandai/", {"log": "coba"}, format="json", **SIM)
        HasilMisi.objects.create(profil=self.profil, misi=m, status="selesai")
        assert self.ortu.post("/api/penerbit/simulasi/ulang/").status_code == 200
        assert not HasilMisi.objects.filter(profil__simulasi_oleh=self.ayah).exists()
        assert HasilMisi.objects.filter(profil=self.profil).count() == 1

    def test_anak_dan_tamu_tidak_bisa_simulasi(self):
        d = self.anak.get("/api/penerbit/me/", **SIM).data
        assert d["sedang_simulasi"] is False and d["penulis"]["id"] == self.profil.id
        assert auth(self.kakak).get("/api/penerbit/beranda/", **SIM).status_code == 403
        assert self.anak.post("/api/penerbit/simulasi/ulang/").status_code == 403
