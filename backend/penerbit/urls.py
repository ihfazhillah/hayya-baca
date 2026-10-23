from django.urls import path

from .views import latihan, misi, ortu, penulis, umum

urlpatterns = [
    path("me/", umum.MeView.as_view()),
    # Penulis
    path("beranda/", penulis.BerandaView.as_view()),
    path("alat/", penulis.KartuAlatView.as_view()),
    path("misi/<int:pk>/", misi.MisiView.as_view()),
    path("misi/<int:pk>/klik/", misi.KlikView.as_view()),
    path("misi/<int:pk>/petunjuk/", misi.PetunjukView.as_view()),
    path("misi/<int:pk>/berhenti/", misi.BerhentiView.as_view()),
    path("misi/<int:pk>/periksa/", misi.PeriksaView.as_view()),
    path("misi/<int:pk>/tandai/", misi.TandaiView.as_view()),
    path("misi/<int:pk>/cetak/", misi.CetakMisiView.as_view()),
    path("ujian/<int:pk>/jawab/", misi.UjianJawabView.as_view()),
    path("bertanya/<int:nomor>/jawab/", misi.BertanyaJawabView.as_view()),
    path("latihan/", latihan.LatihanView.as_view()),
    path("latihan/<int:pk>/alat/", latihan.LatihanAlatView.as_view()),
    path("latihan/<int:pk>/klik/", latihan.LatihanKlikView.as_view()),
    path("latihan/<int:pk>/berhenti/", latihan.LatihanBerhentiView.as_view()),
    path("latihan/<int:pk>/periksa/", latihan.LatihanPeriksaView.as_view()),
    # Pemeriksa
    path("ortu/penulis/", umum.AktifkanPenulisView.as_view()),
    path("ortu/dasbor/", ortu.DasborView.as_view()),
]
