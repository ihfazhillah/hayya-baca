from django.contrib import admin

from .models import Child, ChildAccess, ShareInvite


class ChildAccessInline(admin.TabularInline):
    model = ChildAccess
    extra = 1


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ["name", "age", "coins", "stars", "created_by"]
    inlines = [ChildAccessInline]


@admin.register(ShareInvite)
class ShareInviteAdmin(admin.ModelAdmin):
    list_display = ["code", "child", "role", "expires_at", "used"]
