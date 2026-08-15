from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "tahsin"

router = DefaultRouter()
router.register(r"items", views.ItemViewSet, basename="tahsin-item")
router.register(r"santri", views.SantriViewSet, basename="tahsin-santri")
router.register(r"records", views.RecordViewSet, basename="tahsin-record")

urlpatterns = [
    path("me/", views.MeView.as_view(), name="tahsin-me"),
    path("summary/", views.SummaryView.as_view(), name="tahsin-summary"),
    path("auth/login-code/", views.LoginCodeView.as_view(), name="tahsin-login-code"),
] + router.urls
