"""Peran dan akses (Spec 074 §3)."""
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from penerbit.models import ProfilPenulis

from .base import Keluarga, User, auth


class TestMe(Keluarga):
    def test_anak_adalah_penulis(self):
        r = self.anak.get("/api/penerbit/me/")
        assert r.status_code == 200
        assert r.data["peran"] == ["penulis"]
        assert r.data["penulis"]["id"] == self.profil.id
        assert r.data["penulis"]["nama"] == "Fatih"

    def test_ayah_adalah_pemeriksa_untuk_anaknya_saja(self):
        r = self.ortu.get("/api/penerbit/me/")
        assert r.data["peran"] == ["pemeriksa"]
        assert [p["id"] for p in r.data["pemeriksa"]] == [self.profil.id]

    def test_user_biasa_tanpa_peran(self):
        r = auth(self.kakak).get("/api/penerbit/me/")
        assert r.status_code == 200
        assert r.data["peran"] == []

    def test_belum_login_ditolak(self):
        assert APIClient().get("/api/penerbit/me/").status_code == 401

    def test_akun_anak_tanpa_profil_bukan_penulis(self):
        u = User.objects.create_user("adik", password="pw")
        Child.objects.create(name="Adik", created_by=self.ayah, user=u)
        r = auth(u).get("/api/penerbit/me/")
        assert r.data["peran"] == []


class TestAktifkanPenulis(Keluarga):
    def test_ayah_mengaktifkan_anak_lain_miliknya(self):
        u = User.objects.create_user("adik", password="pw")
        adik = Child.objects.create(name="Adik", created_by=self.ayah, user=u)
        ChildAccess.objects.create(user=self.ayah, child=adik, role="parent")

        me = self.ortu.get("/api/penerbit/me/").data
        assert [c["child_id"] for c in me["bisa_diaktifkan"]] == [adik.id]

        r = self.ortu.post("/api/penerbit/ortu/penulis/", {"child_id": adik.id}, format="json")
        assert r.status_code == 201
        assert ProfilPenulis.objects.filter(child=adik).exists()
        assert auth(u).get("/api/penerbit/me/").data["peran"] == ["penulis"]

    def test_tidak_bisa_mengaktifkan_anak_keluarga_lain(self):
        u = User.objects.create_user("x", password="pw")
        anak_orang = Child.objects.create(name="X", created_by=self.ayah_lain, user=u)
        ChildAccess.objects.create(user=self.ayah_lain, child=anak_orang, role="parent")
        r = self.ortu.post(
            "/api/penerbit/ortu/penulis/", {"child_id": anak_orang.id}, format="json"
        )
        assert r.status_code == 404

    def test_anak_tanpa_akun_login_tidak_bisa_diaktifkan(self):
        tanpa_akun = Child.objects.create(name="Bayi", created_by=self.ayah)
        ChildAccess.objects.create(user=self.ayah, child=tanpa_akun, role="parent")
        r = self.ortu.post(
            "/api/penerbit/ortu/penulis/", {"child_id": tanpa_akun.id}, format="json"
        )
        assert r.status_code == 400


class TestBatasAkses(Keluarga):
    def test_penulis_tidak_bisa_membuka_area_ortu(self):
        r = self.anak.get(f"/api/penerbit/ortu/dasbor/?penulis={self.profil.id}")
        assert r.status_code == 403

    def test_pemeriksa_tidak_bisa_melihat_penulis_keluarga_lain(self):
        r = self.ortu.get(f"/api/penerbit/ortu/dasbor/?penulis={self.profil_lain.id}")
        assert r.status_code == 404

    def test_pemeriksa_melihat_dasbor_anaknya(self):
        r = self.ortu.get(f"/api/penerbit/ortu/dasbor/?penulis={self.profil.id}")
        assert r.status_code == 200

    def test_bukan_penulis_tidak_bisa_membuka_area_penulis(self):
        assert self.ortu.get("/api/penerbit/beranda/").status_code == 403
