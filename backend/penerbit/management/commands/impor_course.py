from django.core.management.base import BaseCommand

from penerbit.impor import impor_folder


class Command(BaseCommand):
    help = "Impor isi course Penerbit Rumah dari folder JSON satu musim (lihat course/schema.md)."

    def add_arguments(self, parser):
        parser.add_argument("folder")

    def handle(self, folder, **opts):
        impor_folder(folder)
        self.stdout.write(self.style.SUCCESS(f"Isi course dari {folder} terimpor."))
