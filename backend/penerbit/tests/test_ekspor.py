"""manage.py ekspor_naskah: arsip teks yang bisa dibaca tanpa aplikasi."""
from django.core.management import call_command

from penerbit.models import Naskah, Versi

from .base import Keluarga


class TestEksporNaskah(Keluarga):
    def test_satu_file_per_naskah_dengan_semua_versi(self):
        n = Naskah.objects.create(profil=self.profil, judul="Sandal Jepit yang Hilang")
        Versi.objects.create(naskah=n, nomor=1, teks="Fatih sedih.")
        Versi.objects.create(naskah=n, nomor=2, teks="Mata Fatih panas.", lapis="kamera")
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp:
            call_command("ekspor_naskah", tmp)
            files = list(Path(tmp).rglob("*.txt"))
            assert [f.parent.name for f in files] == ["fatih"]
            isi = files[0].read_text()
        assert "Sandal Jepit yang Hilang" in isi
        assert "Versi 1" in isi and "Fatih sedih." in isi
        assert "Versi 2 (lapis kamera)" in isi and "Mata Fatih panas." in isi
