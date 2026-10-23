from rest_framework.response import Response

from .base import OrtuView


class DasborView(OrtuView):
    def get(self, request):
        profil = self.profil(request)
        return Response({"penulis": {"id": profil.id, "nama": profil.nama_panggilan}})
