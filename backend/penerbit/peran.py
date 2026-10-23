"""Peran di Penerbit Rumah (Spec 074 §3).

- Penulis: akun anak (`Child.user`) yang Child-nya punya ProfilPenulis.
- Pemeriksa: User dengan ChildAccess parent ke Child yang punya ProfilPenulis.
- Editor Tamu: User yang punya naskah dibagikan kepadanya (BagiNaskah).

Data penulis lain selalu dijawab 404, bukan 403, supaya keberadaannya tidak terlihat.
"""
from django.http import Http404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from accounts.models import Child, ChildAccess, is_child_account

from .models import BagiNaskah, ProfilPenulis


def profil_penulis(user):
    if not is_child_account(user):
        return None
    return ProfilPenulis.objects.filter(child=user.child_profile).first()


def profil_diperiksa(user):
    return ProfilPenulis.objects.filter(
        child__access__user=user, child__access__role=ChildAccess.Role.PARENT
    ).order_by("id")


def bisa_diaktifkan(user):
    """Child milik user (parent) yang punya akun login tapi belum jadi penulis."""
    return Child.objects.filter(
        access__user=user,
        access__role=ChildAccess.Role.PARENT,
        user__isnull=False,
        profil_penulis__isnull=True,
    ).order_by("id")


def adalah_tamu(user):
    return BagiNaskah.objects.filter(user=user).exists()


def ringkas_peran(user):
    penulis = profil_penulis(user)
    pemeriksa = list(profil_diperiksa(user))
    tamu = adalah_tamu(user)
    peran = []
    if penulis:
        peran.append("penulis")
    if pemeriksa:
        peran.append("pemeriksa")
    if tamu:
        peran.append("tamu")
    return {
        "peran": peran,
        "penulis": {"id": penulis.id, "nama": penulis.nama_panggilan} if penulis else None,
        "pemeriksa": [{"id": p.id, "nama": p.nama_panggilan} for p in pemeriksa],
        "bisa_diaktifkan": [
            {"child_id": c.id, "nama": c.name} for c in bisa_diaktifkan(user)
        ],
        "tamu": tamu,
    }


class IsPenulis(BasePermission):
    message = "Halaman ini untuk penulis."

    def has_permission(self, request, view):
        profil = profil_penulis(request.user)
        if profil is None:
            return False
        request.profil = profil
        return True


class IsPemeriksa(BasePermission):
    message = "Halaman ini untuk Ayah atau Ummah."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and not is_child_account(request.user)
            and ChildAccess.objects.filter(
                user=request.user, role=ChildAccess.Role.PARENT
            ).exists()
        )


def profil_untuk_pemeriksa(request, penulis_id=None):
    """ProfilPenulis yang diminta Pemeriksa lewat ?penulis= atau body; 404 bila bukan anaknya.

    Tanpa parameter: penulis pertama miliknya (keluarga dengan satu anak tidak perlu memilih).
    """
    if penulis_id is None:
        penulis_id = request.query_params.get("penulis") or request.data.get("penulis")
    qs = profil_diperiksa(request.user)
    if penulis_id in (None, ""):
        profil = qs.first()
    else:
        try:
            profil = qs.filter(id=int(penulis_id)).first()
        except (TypeError, ValueError):
            profil = None
    if profil is None:
        raise Http404
    return profil


def tolak(pesan):
    raise PermissionDenied(pesan)
