from django.contrib import admin

from . import models as m


@admin.register(m.Modul)
class ModulAdmin(admin.ModelAdmin):
    list_display = ("nomor", "judul", "level", "alat", "musim")
    list_filter = ("level", "musim")


@admin.register(m.Misi)
class MisiAdmin(admin.ModelAdmin):
    list_display = ("__str__", "tahap", "jenis", "lembar")
    list_filter = ("modul", "tahap", "jenis")


@admin.register(m.ProfilPenulis)
class ProfilPenulisAdmin(admin.ModelAdmin):
    list_display = ("nama_panggilan", "child", "pangkat", "created_at")


@admin.register(m.Naskah)
class NaskahAdmin(admin.ModelAdmin):
    list_display = ("judul", "profil", "tahap", "nomor_terbitan", "created_at")
    list_filter = ("profil", "tahap")


for model in (
    m.Musim, m.Alat, m.Pangkat, m.SoalUjian, m.KalimatLatihan, m.Lembar, m.SoalBertanya,
    m.HasilMisi, m.HasilUjian, m.HasilLatihan, m.JadwalUlang, m.Stiker, m.Poin,
    m.PemeriksaanLembar, m.Hadiah, m.Penukaran, m.Prompt, m.Ide, m.Versi, m.Jejak,
    m.Stempel, m.CatatanNaskah, m.BagiNaskah, m.KartuUlasan,
):
    admin.site.register(model)
