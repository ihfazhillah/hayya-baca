"""Schedule tests (Spec 062)."""
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from schedule.models import ScheduleTask, TaskCompletion

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def parent(db):
    return User.objects.create_user(username="ayah", password="test1234")


def auth(api, user):
    token, _ = Token.objects.get_or_create(user=user)
    api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api


def make_child(name, parent):
    child = Child.objects.create(name=name, created_by=parent)
    ChildAccess.objects.create(user=parent, child=child, role=ChildAccess.Role.PARENT)
    user = User.objects.create_user(username=name.lower(), password="kucing1")
    child.user = user
    child.save()
    return child


def items(payload):
    return [i for g in payload["groups"] for i in g["items"]]


# === T1: model ===


class TestModel:
    def test_completion_unique_per_task_per_date(self, parent):
        child = make_child("Ahmad", parent)
        task = ScheduleTask.objects.create(
            child=child, created_by=child.user, title="Sholat",
            part_of_day="pagi", kind="routine", repeat_days=[0, 1, 2, 3, 4, 5, 6],
        )
        day = datetime.date(2026, 7, 27)
        TaskCompletion.objects.create(task=task, date=day)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                TaskCompletion.objects.create(task=task, date=day)


# === T2: child endpoints ===


class TestChildSchedule:
    def test_routine_shows_only_on_matching_weekday(self, api, parent):
        child = make_child("Ahmad", parent)
        capi = auth(api, child.user)
        day = datetime.date(2026, 7, 27)
        wd = day.weekday()
        capi.post(
            "/api/schedule/tasks/",
            {"title": "Sholat Subuh", "part_of_day": "pagi",
             "kind": "routine", "repeat_days": [wd]},
            format="json",
        )
        on = capi.get(f"/api/schedule/today/?date={day.isoformat()}").data
        assert len(items(on)) == 1
        other = day + datetime.timedelta(days=1)
        off = capi.get(f"/api/schedule/today/?date={other.isoformat()}").data
        assert len(items(off)) == 0

    def test_once_shows_only_on_its_date(self, api, parent):
        child = make_child("Ahmad", parent)
        capi = auth(api, child.user)
        day = datetime.date(2026, 7, 27)
        capi.post(
            "/api/schedule/tasks/",
            {"title": "Ke dokter gigi", "part_of_day": "siang",
             "kind": "once", "date": day.isoformat()},
            format="json",
        )
        assert len(items(capi.get(f"/api/schedule/today/?date={day.isoformat()}").data)) == 1
        nxt = (day + datetime.timedelta(days=1)).isoformat()
        assert len(items(capi.get(f"/api/schedule/today/?date={nxt}").data)) == 0

    def test_toggle_marks_done_and_keeps_history(self, api, parent):
        child = make_child("Ahmad", parent)
        capi = auth(api, child.user)
        day = datetime.date(2026, 7, 27)
        wd = day.weekday()
        tid = capi.post(
            "/api/schedule/tasks/",
            {"title": "Beresin mainan", "part_of_day": "sore",
             "kind": "routine", "repeat_days": [wd]},
            format="json",
        ).data["id"]

        capi.post(f"/api/schedule/tasks/{tid}/toggle/",
                  {"date": day.isoformat(), "done": True}, format="json")
        today = capi.get(f"/api/schedule/today/?date={day.isoformat()}").data
        assert today["done_count"] == 1
        assert items(today)[0]["done"] is True

        # Un-check.
        capi.post(f"/api/schedule/tasks/{tid}/toggle/",
                  {"date": day.isoformat(), "done": False}, format="json")
        assert capi.get(f"/api/schedule/today/?date={day.isoformat()}").data["done_count"] == 0

        # History: marking today does not touch yesterday.
        yest = day - datetime.timedelta(days=1)
        capi.post(f"/api/schedule/tasks/{tid}/toggle/",
                  {"date": day.isoformat(), "done": True}, format="json")
        assert capi.get(f"/api/schedule/today/?date={yest.isoformat()}").data["done_count"] == 0

    def test_routine_requires_repeat_days(self, api, parent):
        child = make_child("Ahmad", parent)
        capi = auth(api, child.user)
        r = capi.post(
            "/api/schedule/tasks/",
            {"title": "x", "part_of_day": "pagi", "kind": "routine", "repeat_days": []},
            format="json",
        )
        assert r.status_code == 400

    def test_once_requires_date(self, api, parent):
        child = make_child("Ahmad", parent)
        capi = auth(api, child.user)
        r = capi.post(
            "/api/schedule/tasks/",
            {"title": "x", "part_of_day": "pagi", "kind": "once"},
            format="json",
        )
        assert r.status_code == 400

    def test_child_cannot_touch_another_childs_task(self, api, parent):
        a = make_child("Ahmad", parent)
        b = make_child("Budi", parent)
        bid = auth(api, b.user).post(
            "/api/schedule/tasks/",
            {"title": "rahasia", "part_of_day": "pagi", "kind": "routine", "repeat_days": [0]},
            format="json",
        ).data["id"]
        # Ahmad tries to toggle Budi's task.
        r = auth(api, a.user).post(
            f"/api/schedule/tasks/{bid}/toggle/",
            {"date": "2026-07-27", "done": True}, format="json",
        )
        assert r.status_code == 404


# === T3: guardian endpoints ===


class TestGuardianSchedule:
    def test_guardian_adds_task_marked_from_guardian(self, api, parent):
        child = make_child("Ahmad", parent)
        r = auth(api, parent).post(
            f"/api/schedule/children/{child.id}/tasks/",
            {"title": "Mengaji", "part_of_day": "sore",
             "kind": "routine", "repeat_days": [0, 1, 2, 3, 4, 5, 6]},
            format="json",
        )
        assert r.status_code == 201
        assert r.data["from_guardian"] is True
        # Child sees it in their own schedule.
        day = datetime.date(2026, 7, 27)
        seen = auth(api, child.user).get(
            f"/api/schedule/today/?date={day.isoformat()}"
        ).data
        assert any(i["title"] == "Mengaji" for i in items(seen))

    def test_guardian_cannot_toggle(self, api, parent):
        child = make_child("Ahmad", parent)
        tid = auth(api, child.user).post(
            "/api/schedule/tasks/",
            {"title": "x", "part_of_day": "pagi", "kind": "routine", "repeat_days": [0]},
            format="json",
        ).data["id"]
        r = auth(api, parent).post(
            f"/api/schedule/tasks/{tid}/toggle/",
            {"date": "2026-07-27", "done": True}, format="json",
        )
        assert r.status_code == 403

    def test_non_parent_guardian_forbidden(self, api, parent):
        child = make_child("Ahmad", parent)
        other = User.objects.create_user(username="lain", password="x")
        r = auth(api, other).post(
            f"/api/schedule/children/{child.id}/tasks/",
            {"title": "x", "part_of_day": "pagi", "kind": "once", "date": "2026-07-27"},
            format="json",
        )
        assert r.status_code == 403
