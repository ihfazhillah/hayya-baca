from django.contrib import admin

from .models import SyncLog, DeviceTelemetry


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ["timestamp", "user", "device_id", "device_name", "child", "action", "item_count"]
    list_filter = ["action", "device_id", "timestamp"]
    search_fields = ["device_id", "device_name", "user__username"]
    readonly_fields = [
        "user", "device_id", "device_name", "child",
        "timestamp", "action", "item_count", "details",
    ]
    date_hierarchy = "timestamp"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True


@admin.register(DeviceTelemetry)
class DeviceTelemetryAdmin(admin.ModelAdmin):
    list_display = [
        "user", "device_id", "app_version",
        "queue_depth_rewards", "queue_depth_progress",
        "last_successful_sync_at", "reported_at",
    ]
    list_filter = ["app_version", "reported_at"]
    search_fields = ["device_id", "device_name", "user__username"]
    readonly_fields = [f.name for f in DeviceTelemetry._meta.fields]
    date_hierarchy = "reported_at"

    def has_add_permission(self, request):
        return False
