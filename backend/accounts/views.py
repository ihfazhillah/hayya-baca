from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as s
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Child, ChildAccess, ShareInvite
from .permissions import IsParentOfChild, IsParentOrReadOnlyTeacher
from .serializers import (
    ChildAccessSerializer,
    ChildSerializer,
    LoginSerializer,
    RedeemInviteSerializer,
    RegisterSerializer,
    ShareInviteCreateSerializer,
)

TokenResponse = inline_serializer("TokenResponse", {"token": s.CharField()})


class RegisterView(CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    @extend_schema(responses={201: TokenResponse})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_201_CREATED)


@extend_schema(tags=["auth"])
class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=LoginSerializer, responses={200: TokenResponse})
    def post(self, request):
        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password"),
        )
        if not user:
            return Response(
                {"detail": "Username atau password salah"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})


@extend_schema(tags=["auth"])
class LogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChildViewSet(viewsets.ModelViewSet):
    serializer_class = ChildSerializer

    def get_queryset(self):
        return Child.objects.filter(access__user=self.request.user).distinct()

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsParentOfChild()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        child = serializer.save(created_by=self.request.user)
        ChildAccess.objects.create(
            user=self.request.user, child=child, role=ChildAccess.Role.PARENT
        )


@extend_schema(tags=["children"])
class ChildAccessListView(APIView):
    @extend_schema(responses={200: ChildAccessSerializer(many=True)})
    def get(self, request, child_pk):
        if not ChildAccess.objects.filter(
            user=request.user, child_id=child_pk, role=ChildAccess.Role.PARENT
        ).exists():
            return Response(status=status.HTTP_403_FORBIDDEN)
        accesses = ChildAccess.objects.filter(child_id=child_pk)
        serializer = ChildAccessSerializer(accesses, many=True)
        return Response(serializer.data)

    @extend_schema(
        request=inline_serializer("RevokeAccess", {"access_id": s.IntegerField()}),
        responses={204: None},
    )
    def delete(self, request, child_pk):
        access_id = request.data.get("access_id")
        if not ChildAccess.objects.filter(
            user=request.user, child_id=child_pk, role=ChildAccess.Role.PARENT
        ).exists():
            return Response(status=status.HTTP_403_FORBIDDEN)
        ChildAccess.objects.filter(id=access_id, child_id=child_pk).exclude(
            user=request.user
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ShareInviteViewSet(viewsets.ModelViewSet):
    serializer_class = ShareInviteCreateSerializer
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return ShareInvite.objects.filter(invited_by=self.request.user)

    def perform_create(self, serializer):
        child_id = self.request.data.get("child")
        if not ChildAccess.objects.filter(
            user=self.request.user, child_id=child_id, role=ChildAccess.Role.PARENT
        ).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Hanya parent yang bisa share")
        serializer.save()


class RedeemInviteView(CreateAPIView):
    serializer_class = RedeemInviteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        access = serializer.save()
        return Response(
            {"detail": "Berhasil", "child": ChildSerializer(access.child).data},
            status=status.HTTP_201_CREATED,
        )
