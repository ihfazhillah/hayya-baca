"""Ruang Cerita diary views (Spec 060)."""
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess, is_child_account
from accounts.serializers import ChildSerializer

from rest_framework import status
from rest_framework.generics import get_object_or_404

from .images import MAX_PANELS_PER_POST, InvalidImage, process_panel_image
from .models import ComicPanel, Post, PostType
from .permissions import IsChildAccount
from .serializers import ComicPanelSerializer, PostSerializer, PostTypeSerializer


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


class PanelBaseView(APIView):
    """Comic panels, scoped to a post owned by the requesting child."""

    permission_classes = [IsChildAccount]

    def get_post(self, request, post_pk):
        return get_object_or_404(
            Post, pk=post_pk, child=request.user.child_profile
        )


class PanelListCreateView(PanelBaseView):
    def post(self, request, post_pk):
        post = self.get_post(request, post_pk)

        if post.panels.count() >= MAX_PANELS_PER_POST:
            return Response(
                {"detail": f"Maksimal {MAX_PANELS_PER_POST} panel"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload = request.data.get("image")
        if upload is None:
            return Response(
                {"detail": "Gambar wajib diisi"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            processed = process_panel_image(upload)
        except InvalidImage as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        last = post.panels.order_by("-order").first()
        next_order = (last.order + 1) if last else 0
        panel = ComicPanel(
            post=post,
            order=request.data.get("order", next_order),
            caption=request.data.get("caption", ""),
        )
        panel.image.save(processed.name, processed, save=True)
        return Response(
            ComicPanelSerializer(panel, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PanelDetailView(PanelBaseView):
    def get_panel(self, request, post_pk, pk):
        post = self.get_post(request, post_pk)
        return get_object_or_404(ComicPanel, pk=pk, post=post)

    def patch(self, request, post_pk, pk):
        panel = self.get_panel(request, post_pk, pk)
        if "order" in request.data:
            panel.order = request.data["order"]
        if "caption" in request.data:
            panel.caption = request.data["caption"]
        panel.save(update_fields=["order", "caption"])
        return Response(
            ComicPanelSerializer(panel, context={"request": request}).data
        )

    def delete(self, request, post_pk, pk):
        panel = self.get_panel(request, post_pk, pk)
        panel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
