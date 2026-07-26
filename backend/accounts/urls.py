from django.urls import path
from rest_framework.routers import DefaultRouter

from . import child_account_views as ca
from . import views

router = DefaultRouter()
router.register(r"children", views.ChildViewSet, basename="child")
router.register(r"share/invites", views.ShareInviteViewSet, basename="share-invite")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/redeem/", views.RedeemInviteView.as_view(), name="redeem-invite"),
    path("auth/child-setup/", ca.ChildSetupView.as_view(), name="child-setup"),
    path(
        "children/<int:child_pk>/access/",
        views.ChildAccessListView.as_view(),
        name="child-access",
    ),
    path(
        "children/<int:child_pk>/diary-account/",
        ca.DiaryAccountView.as_view(),
        name="diary-account",
    ),
    path(
        "children/<int:child_pk>/diary-account/setup-token/",
        ca.SetupTokenView.as_view(),
        name="diary-setup-token",
    ),
] + router.urls
