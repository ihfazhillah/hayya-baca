"""Data dasar untuk test Penerbit Rumah: satu keluarga + satu keluarga lain."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from penerbit.models import ProfilPenulis

User = get_user_model()


def auth(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class Keluarga(TestCase):
    def setUp(self):
        super().setUp()
        self.ayah = User.objects.create_user("ayah", password="pw")
        self.ummah = User.objects.create_user("ummah", password="pw")
        self.akun_anak = User.objects.create_user("fatih", password="pw")
        self.child = Child.objects.create(
            name="Fatih", created_by=self.ayah, user=self.akun_anak
        )
        ChildAccess.objects.create(user=self.ayah, child=self.child, role="parent")
        ChildAccess.objects.create(user=self.ummah, child=self.child, role="parent")
        self.profil = ProfilPenulis.objects.create(child=self.child, nama_panggilan="Fatih")

        # Keluarga lain, tidak boleh saling melihat.
        self.ayah_lain = User.objects.create_user("ayahlain", password="pw")
        self.akun_anak_lain = User.objects.create_user("rara", password="pw")
        self.child_lain = Child.objects.create(
            name="Rara", created_by=self.ayah_lain, user=self.akun_anak_lain
        )
        ChildAccess.objects.create(user=self.ayah_lain, child=self.child_lain, role="parent")
        self.profil_lain = ProfilPenulis.objects.create(
            child=self.child_lain, nama_panggilan="Rara"
        )

        self.kakak = User.objects.create_user("kakak", password="pw")

        self.anak = auth(self.akun_anak)
        self.ortu = auth(self.ayah)
