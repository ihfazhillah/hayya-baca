from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from ..peran import IsPemeriksa, IsPenulis, profil_untuk_pemeriksa


class PenulisView(APIView):
    """View area Penulis. `request.profil` = ProfilPenulis milik anak yang login."""

    permission_classes = [IsAuthenticated, IsPenulis]


class OrtuView(APIView):
    """View area Pemeriksa. `self.profil(request)` = penulis yang dipilih (404 bila bukan anaknya)."""

    permission_classes = [IsAuthenticated, IsPemeriksa]

    def profil(self, request):
        return profil_untuk_pemeriksa(request)
