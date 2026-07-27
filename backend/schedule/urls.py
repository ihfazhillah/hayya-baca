from django.urls import path

from . import views

app_name = "schedule"

urlpatterns = [
    path("today/", views.MyScheduleTodayView.as_view(), name="today"),
    path("tasks/", views.MyScheduleTasksView.as_view(), name="tasks"),
    path("tasks/<int:pk>/", views.MyScheduleTaskDetailView.as_view(), name="task-detail"),
    path("tasks/<int:pk>/toggle/", views.ToggleTaskView.as_view(), name="task-toggle"),
    path(
        "children/<int:child_id>/today/",
        views.ChildScheduleTodayView.as_view(),
        name="child-today",
    ),
    path(
        "children/<int:child_id>/tasks/",
        views.ChildScheduleTasksView.as_view(),
        name="child-tasks",
    ),
]
