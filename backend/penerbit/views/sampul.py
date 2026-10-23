"""Sampul buku terlindungi: hanya penulisnya, Pemeriksa keluarganya, dan Editor Tamu yang dibagikan.

`<img>` tidak mengirim header Authorization, jadi API memberi URL bertanda tangan
(`?t=`) kepada klien yang berhak; tanda tangan itu hanya berlaku untuk satu naskah.
"""
from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404, HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from ..models import BagiNaskah, Naskah
from ..peran import profil_diperiksa, profil_penulis

SALT = "penerbit.sampul"
UMUR_DETIK = 60 * 60 * 24 * 7


def url_sampul(naskah):
    if not naskah.sampul:
        return None
    t = signing.dumps(naskah.id, salt=SALT)
    return f"/api/penerbit/sampul/{naskah.id}/?t={t}"


def _boleh(user, naskah):
    if not user.is_authenticated:
        return False
    if profil_penulis(user) == naskah.profil:
        return True
    if profil_diperiksa(user).filter(id=naskah.profil_id).exists():
        return True
    return BagiNaskah.objects.filter(naskah=naskah, user=user).exists()


class SampulView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        naskah = Naskah.objects.filter(pk=pk).first()
        if naskah is None or not naskah.sampul:
            raise Http404
        boleh = _boleh(request.user, naskah)
        if not boleh and request.query_params.get("t"):
            try:
                boleh = signing.loads(request.query_params["t"], salt=SALT,
                                      max_age=UMUR_DETIK) == naskah.id
            except signing.BadSignature:
                boleh = False
        if not boleh:
            raise Http404
        if getattr(settings, "PENERBIT_USE_X_ACCEL", False):
            resp = HttpResponse()
            resp["Content-Type"] = ""
            resp["X-Accel-Redirect"] = f"/protected-penerbit-media/{naskah.sampul.name}"
            return resp
        return FileResponse(naskah.sampul.open("rb"))
