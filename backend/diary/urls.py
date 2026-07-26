from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "diary"

router = DefaultRouter()
router.register(r"my/posts", views.MyPostViewSet, basename="my-post")

urlpatterns = [
    path("me/", views.MeView.as_view(), name="me"),
    path("post-types/", views.PostTypeListView.as_view(), name="post-types"),
    path(
        "my/posts/<int:post_pk>/panels/",
        views.PanelListCreateView.as_view(),
        name="panel-list",
    ),
    path(
        "my/posts/<int:post_pk>/panels/<int:pk>/",
        views.PanelDetailView.as_view(),
        name="panel-detail",
    ),
    path(
        "media/<int:pk>/",
        views.PanelMediaView.as_view(),
        name="panel-media",
    ),
    path(
        "posts/<int:post_pk>/comments/",
        views.PostCommentsView.as_view(),
        name="post-comments",
    ),
    path(
        "comments/<int:pk>/",
        views.CommentDetailView.as_view(),
        name="comment-detail",
    ),
    path(
        "posts/<int:post_pk>/reactions/",
        views.PostReactionsView.as_view(),
        name="post-reactions",
    ),
    path(
        "posts/<int:post_pk>/seen/",
        views.PostSeenView.as_view(),
        name="post-seen",
    ),
] + router.urls
