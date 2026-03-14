from django.contrib import admin

from .models import SyncLog


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
