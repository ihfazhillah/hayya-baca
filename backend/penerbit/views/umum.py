from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import ProfilPenulis
from ..peran import IsPemeriksa, bisa_diaktifkan, ringkas_peran


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ringkas_peran(request.user))


class AktifkanPenulisView(APIView):
    """Pemeriksa menjadikan akun anaknya penulis Penerbit Rumah."""

    permission_classes = [IsAuthenticated, IsPemeriksa]

    def post(self, request):
        from accounts.models import Child, ChildAccess

        child = Child.objects.filter(
            id=request.data.get("child_id"),
            access__user=request.user,
            access__role=ChildAccess.Role.PARENT,
        ).first()
        if child is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not bisa_diaktifkan(request.user).filter(id=child.id).exists():
            return Response(
                {"detail": "Anak ini belum punya akun login, atau sudah menjadi penulis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profil = ProfilPenulis.objects.create(
            child=child, nama_panggilan=request.data.get("nama_panggilan") or child.name
        )
        return Response(
            {"id": profil.id, "nama": profil.nama_panggilan}, status=status.HTTP_201_CREATED
        )
