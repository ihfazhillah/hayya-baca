"""Schedule endpoints (Spec 062).

Child (owner): read today, CRUD their own tasks, toggle completion.
Guardian (parent of the child): read a child's today + add tasks for them.
"""
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child
from accounts.permissions import IsGuardianAccount
from diary.permissions import IsChildAccount

from .models import PARTS_ORDER, ScheduleTask, TaskCompletion
from .permissions import is_parent_of
from .serializers import ScheduleTaskSerializer


def _date(request):
    raw = request.query_params.get("date") or request.data.get("date")
    if raw:
        d = parse_date(raw)
        if d:
            return d
    return timezone.localdate()


def today_payload(child, day):
    """Tasks that apply on `day`, grouped by part of day, with done state."""
    tasks = [t for t in child.schedule_tasks.filter(archived=False) if t.applies_on(day)]
    done_ids = set(
        TaskCompletion.objects.filter(
            task_id__in=[t.id for t in tasks], date=day
        ).values_list("task_id", flat=True)
    )
    groups = []
    for part in PARTS_ORDER:
        items = []
        part_tasks = sorted(
            [t for t in tasks if t.part_of_day == part],
            key=lambda t: (t.order, t.id),
        )
        for t in part_tasks:
            row = ScheduleTaskSerializer(t).data
            row["done"] = t.id in done_ids
            items.append(row)
        if items:
            groups.append({"part_of_day": part, "items": items})
    return {
        "date": day.isoformat(),
        "groups": groups,
        "total": len(tasks),
        "done_count": len(done_ids),
    }


# === Child (owner) ===


class MyScheduleTodayView(APIView):
    permission_classes = [IsAuthenticated, IsChildAccount]

    def get(self, request):
        return Response(today_payload(request.user.child_profile, _date(request)))


class MyScheduleTasksView(APIView):
    permission_classes = [IsAuthenticated, IsChildAccount]

    def get(self, request):
        tasks = request.user.child_profile.schedule_tasks.filter(archived=False)
        return Response(ScheduleTaskSerializer(tasks, many=True).data)

    def post(self, request):
        serializer = ScheduleTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            child=request.user.child_profile, created_by=request.user
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyScheduleTaskDetailView(APIView):
    permission_classes = [IsAuthenticated, IsChildAccount]

    def _get(self, request, pk):
        return ScheduleTask.objects.filter(
            pk=pk, child=request.user.child_profile
        ).first()

    def patch(self, request, pk):
        task = self._get(request, pk)
        if task is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ScheduleTaskSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        task = self._get(request, pk)
        if task is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ToggleTaskView(APIView):
    """Only the child (owner) marks their own tasks done for a date."""

    permission_classes = [IsAuthenticated, IsChildAccount]

    def post(self, request, pk):
        task = ScheduleTask.objects.filter(
            pk=pk, child=request.user.child_profile
        ).first()
        if task is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        day = _date(request)
        done = bool(request.data.get("done"))
        if done:
            TaskCompletion.objects.get_or_create(task=task, date=day)
        else:
            TaskCompletion.objects.filter(task=task, date=day).delete()
        return Response({"done": done, "date": day.isoformat()})


# === Guardian (parent of the child) ===


class ChildScheduleTodayView(APIView):
    permission_classes = [IsAuthenticated, IsGuardianAccount]

    def get(self, request, child_id):
        if not is_parent_of(request.user, child_id):
            return Response(status=status.HTTP_403_FORBIDDEN)
        child = Child.objects.filter(id=child_id).first()
        if child is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(today_payload(child, _date(request)))


class ChildScheduleTasksView(APIView):
    permission_classes = [IsAuthenticated, IsGuardianAccount]

    def post(self, request, child_id):
        if not is_parent_of(request.user, child_id):
            return Response(status=status.HTTP_403_FORBIDDEN)
        child = Child.objects.filter(id=child_id).first()
        if child is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ScheduleTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(child=child, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
