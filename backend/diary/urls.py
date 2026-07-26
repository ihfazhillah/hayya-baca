from django.urls import path

from . import views

app_name = "diary"

urlpatterns = [
    path("me/", views.MeView.as_view(), name="me"),
]
