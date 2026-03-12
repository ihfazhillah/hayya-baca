from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"children", views.ChildViewSet, basename="child")
router.register(r"share/invites", views.ShareInviteViewSet, basename="share-invite")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/redeem/", views.RedeemInviteView.as_view(), name="redeem-invite"),
    path(
        "children/<int:child_pk>/access/",
        views.ChildAccessListView.as_view(),
        name="child-access",
    ),
] + router.urls
