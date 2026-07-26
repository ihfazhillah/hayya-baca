"""Ruang Cerita diary views (Spec 060)."""
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess, is_child_account
from accounts.serializers import ChildSerializer

from .models import Post, PostType
from .permissions import IsChildAccount
from .serializers import PostSerializer, PostTypeSerializer


class MeView(APIView):
    """Bootstrap payload: who am I, and which children do I see?"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_child_account(user):
            return Response(
                {
                    "role": "child",
                    "child": ChildSerializer(user.child_profile).data,
                }
            )

        # Guardian: diary is parent-only, so teachers get an empty list.
        children = Child.objects.filter(
            access__user=user, access__role=ChildAccess.Role.PARENT
        ).distinct()
        return Response(
            {
                "role": "guardian",
                "children": ChildSerializer(children, many=True).data,
            }
        )


class PostTypeListView(ListAPIView):
    """Active post types (both roles may read)."""

    permission_classes = [IsAuthenticated]
    serializer_class = PostTypeSerializer
    pagination_class = None

    def get_queryset(self):
        return PostType.objects.filter(is_active=True)


class MyPostViewSet(viewsets.ModelViewSet):
    """A child's own posts (draft + published). Owner-scoped."""

    permission_classes = [IsChildAccount]
    serializer_class = PostSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Post.objects.filter(child=self.request.user.child_profile)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(child=self.request.user.child_profile)

    def perform_update(self, serializer):
        instance = serializer.instance
        new_status = serializer.validated_data.get("status", instance.status)
        extra = {}
        if new_status == Post.Status.PUBLISHED and instance.published_at is None:
            extra["published_at"] = timezone.now()
        serializer.save(**extra)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])
