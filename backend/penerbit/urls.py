from django.urls import path

from .views import ortu, penulis, umum

urlpatterns = [
    path("me/", umum.MeView.as_view()),
    # Penulis
    path("beranda/", penulis.BerandaView.as_view()),
    # Pemeriksa
    path("ortu/penulis/", umum.AktifkanPenulisView.as_view()),
    path("ortu/dasbor/", ortu.DasborView.as_view()),
]
