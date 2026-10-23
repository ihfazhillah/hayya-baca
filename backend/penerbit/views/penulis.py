from rest_framework.response import Response

from .base import PenulisView


class BerandaView(PenulisView):
    def get(self, request):
        return Response({"nama": request.profil.nama_panggilan})
