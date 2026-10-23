from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from penerbit.models import Naskah


class Command(BaseCommand):
    help = "Ekspor semua naskah Penerbit Rumah sebagai file teks (satu folder per penulis)."

    def add_arguments(self, parser):
        parser.add_argument("folder")

    def handle(self, folder, **opts):
        root = Path(folder)
        n = 0
        for naskah in Naskah.objects.select_related("profil").prefetch_related("versi"):
            d = root / slugify(naskah.profil.nama_panggilan)
            d.mkdir(parents=True, exist_ok=True)
            bagian = [naskah.judul, "=" * len(naskah.judul)]
            if naskah.nomor_terbitan:
                bagian.append(f"Terbit: {naskah.nomor_terbitan}")
            for v in naskah.versi.all():
                kepala = f"Versi {v.nomor}" + (f" (lapis {v.lapis})" if v.lapis else "")
                bagian += ["", kepala, "-" * len(kepala), v.teks]
            (d / f"{naskah.id:04d}-{slugify(naskah.judul)}.txt").write_text("\n".join(bagian) + "\n")
            n += 1
        self.stdout.write(self.style.SUCCESS(f"{n} naskah diekspor ke {root}"))
