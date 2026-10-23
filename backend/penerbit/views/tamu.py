"""Editor Tamu: membaca naskah yang dibagikan dan mengisi Kartu Ulasan."""
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import BagiNaskah
from .ortu import simpan_ulasan


class UlasanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([
            {"id": b.naskah_id, "judul": b.naskah.judul, "penulis": b.naskah.profil.nama_panggilan,
             "versi": b.versi.nomor, "tanggal": b.tanggal}
            for b in BagiNaskah.objects.filter(user=request.user).select_related(
                "naskah__profil", "versi")
        ])


class UlasanView(APIView):
    permission_classes = [IsAuthenticated]

    def bagi(self, request, pk):
        return get_object_or_404(BagiNaskah.objects.select_related("naskah__profil", "versi"),
                                 naskah_id=pk, user=request.user)

    def get(self, request, pk):
        b = self.bagi(request, pk)
        return Response({
            "id": b.naskah_id, "judul": b.naskah.judul, "penulis": b.naskah.profil.nama_panggilan,
            "versi": b.versi.nomor, "teks": b.versi.teks, "isi": b.versi.isi,
            "ulasan_saya": [{"favorit": u.favorit, "membingungkan": u.membingungkan,
                             "pertanyaan": u.pertanyaan, "tanggal": u.tanggal}
                            for u in b.naskah.ulasan.filter(penulis=request.user)],
        })

    def post(self, request, pk):
        b = self.bagi(request, pk)
        return simpan_ulasan(request, b.naskah, b.versi)
