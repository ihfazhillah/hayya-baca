from django.urls import path
from .views import StreakCheckView, StreakStatusView, StreakSyncBulkView, StreakSyncView

urlpatterns = [
    path("streak/sync/", StreakSyncView.as_view(), name="streak-sync"),
    path("streak/sync-bulk/", StreakSyncBulkView.as_view(), name="streak-sync-bulk"),
    path("streak/status/", StreakStatusView.as_view(), name="streak-status"),
    path("streak/check/", StreakCheckView.as_view(), name="streak-check"),
]
