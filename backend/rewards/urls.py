from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"rewards", views.RewardHistoryViewSet, basename="reward")

# Nested under children/<child_pk>/ in config/urls.py
urlpatterns = router.urls + [
    path("rewards/sync/", views.BulkRewardSyncView.as_view(), name="reward-sync"),
]
