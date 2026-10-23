"""Data dasar untuk test Penerbit Rumah: satu keluarga + satu keluarga lain."""
import shutil
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from penerbit.impor import impor_folder
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


ISI_MUSIM_1 = Path(__file__).resolve().parent.parent / "course" / "musim-1"


def impor_modul_1_5():
    """Impor musim.json + modul 1–5 (salinan), terpisah dari file isi yang sedang disusun."""
    with tempfile.TemporaryDirectory() as tmp:
        for nama in ["musim.json"] + [f"modul-0{i}.json" for i in range(1, 6)]:
            shutil.copy(ISI_MUSIM_1 / nama, Path(tmp) / nama)
        impor_folder(tmp)


def selesaikan_modul(profil, nomor):
    from penerbit.models import HasilMisi, Misi

    for m in Misi.objects.filter(modul__nomor=nomor):
        HasilMisi.objects.create(profil=profil, misi=m, status="selesai")
