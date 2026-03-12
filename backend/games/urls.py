from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"games", views.GameViewSet, basename="game")

urlpatterns = router.urls + [
    path(
        "games/sessions/<int:pk>/end/",
        views.GameSessionEndView.as_view({"post": "end"}),
        name="game-session-end",
    ),
]
