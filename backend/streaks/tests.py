import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Child, ChildAccess
from streaks.models import Badge, Streak

User = get_user_model()


def _make_fixture():
    """Create user, child, child_access, and authenticate client."""
    user = User.objects.create_user(username="parent1", password="pass123")
    child = Child.objects.create(name="Aisyah", created_by=user)
    ChildAccess.objects.create(user=user, child=child, role="parent")
    client = APIClient()
    client.force_authenticate(user)
    return client, user, child


class BadgeSeedingTest(TestCase):
    """Test badge data migration seeding."""

    def test_badge_count(self):
        self.assertEqual(Badge.objects.count(), 6)

    def test_badge_thresholds(self):
        thresholds = list(Badge.objects.values_list("day_threshold", flat=True).order_by("day_threshold"))
        self.assertEqual(thresholds, [1, 3, 7, 14, 30, 60])

    def test_badge_names(self):
        names = list(Badge.objects.values_list("name", flat=True).order_by("level"))
        self.assertEqual(names, [
            "Benih", "Tunas Hijau", "Kuncup Merah",
            "Strawberry Muda", "Strawberry Manis", "Strawberry Raksasa",
        ])


class StreakModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="parent1", password="pass123")
        self.child = Child.objects.create(name="Aisyah", created_by=self.user)
        self.badge1, _ = Badge.objects.get_or_create(level=1, defaults={"name": "Benih", "icon_reference": "benih", "day_threshold": 1})
        self.badge3, _ = Badge.objects.get_or_create(level=3, defaults={"name": "Tunas Hijau", "icon_reference": "tunas", "day_threshold": 3})

    def test_initial_streak(self):
        streak = Streak.objects.create(child=self.child)
        self.assertEqual(streak.current_streak, 0)
        self.assertEqual(streak.longest_streak, 0)
        self.assertIsNone(streak.last_reading_date)

    def test_badge_progression(self):
        streak = Streak.objects.create(child=self.child)
        streak.current_streak = 1
        streak.save()
        streak.badge = self.badge1
        streak.save()
        self.assertEqual(streak.badge, self.badge1)


class StreakSyncTest(TestCase):
    def setUp(self):
        self.client, self.user, self.child = _make_fixture()

    def test_sync_first_reading(self):
        today = timezone.now().date()
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "reading_date": str(today),
                "content_type": "book",
                "content_id": "1",
                "quiz_passed": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["current_streak"], 1)

    def test_sync_same_day_rejected(self):
        today = timezone.now().date()
        payload = {
            "reading_date": str(today),
            "content_type": "book",
            "content_id": "1",
            "quiz_passed": True,
        }
        self.client.post(reverse("streak-sync", kwargs={"child_pk": self.child.pk}), data=payload, content_type="application/json")
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": self.child.pk}),
            data=payload,
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sync_quiz_not_passed(self):
        today = timezone.now().date()
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "reading_date": str(today),
                "content_type": "book",
                "content_id": "1",
                "quiz_passed": False,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sync_wrong_date(self):
        yesterday = timezone.now().date() - timedelta(days=1)
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "reading_date": str(yesterday),
                "content_type": "book",
                "content_id": "1",
                "quiz_passed": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sync_no_access(self):
        other_user = User.objects.create_user(username="other", password="pass123")
        other_child = Child.objects.create(name="Bilal", created_by=other_user)
        today = timezone.now().date()
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": other_child.pk}),
            data=json.dumps({
                "reading_date": str(today),
                "content_type": "book",
                "content_id": "1",
                "quiz_passed": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class GracePeriodTest(TestCase):
    def setUp(self):
        self.client, self.user, self.child = _make_fixture()

    def test_grace_period_reset_after_expiration(self):
        today = timezone.now().date()
        streak = Streak.objects.create(
            child=self.child,
            current_streak=5,
            longest_streak=5,
            last_reading_date=today - timedelta(days=4),
            grace_period_end_date=today - timedelta(days=1),
        )
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "reading_date": str(today),
                "content_type": "book",
                "content_id": "1",
                "quiz_passed": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["current_streak"], 1)
        self.assertEqual(data["longest_streak"], 5)

    def test_grace_period_active(self):
        today = timezone.now().date()
        streak = Streak.objects.create(
            child=self.child,
            current_streak=3,
            last_reading_date=today - timedelta(days=2),
            grace_period_end_date=today + timedelta(days=1),
        )
        resp = self.client.post(
            reverse("streak-sync", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "reading_date": str(today),
                "content_type": "book",
                "content_id": "1",
                "quiz_passed": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["current_streak"], 4)


class StreakStatusTest(TestCase):
    def setUp(self):
        self.client, self.user, self.child = _make_fixture()

    def test_status_no_streak(self):
        resp = self.client.get(reverse("streak-status", kwargs={"child_pk": self.child.pk}))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["current_streak"], 0)

    def test_status_with_streak(self):
        today = timezone.now().date()
        streak = Streak.objects.create(
            child=self.child,
            current_streak=7,
            last_reading_date=today,
            grace_period_end_date=today + timedelta(days=3),
        )
        resp = self.client.get(reverse("streak-status", kwargs={"child_pk": self.child.pk}))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["current_streak"], 7)


class StreakCheckTest(TestCase):
    def setUp(self):
        self.client, self.user, self.child = _make_fixture()

    def test_check_quiz_passed(self):
        resp = self.client.post(
            reverse("streak-check", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "content_type": "book",
                "content_id": "1",
                "quiz_score": 4,
                "quiz_total": 5,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data["quiz_passed"])
        self.assertTrue(data["can_advance_streak"])

    def test_check_quiz_failed(self):
        resp = self.client.post(
            reverse("streak-check", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "content_type": "book",
                "content_id": "1",
                "quiz_score": 1,
                "quiz_total": 5,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertFalse(data["quiz_passed"])
        self.assertFalse(data["can_advance_streak"])

    def test_check_already_read_today(self):
        today = timezone.now().date()
        Streak.objects.create(
            child=self.child,
            current_streak=1,
            last_reading_date=today,
        )
        resp = self.client.post(
            reverse("streak-check", kwargs={"child_pk": self.child.pk}),
            data=json.dumps({
                "content_type": "book",
                "content_id": "2",
                "quiz_score": 5,
                "quiz_total": 5,
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data["quiz_passed"])
        self.assertFalse(data["can_advance_streak"])
        self.assertTrue(data["already_read_today"])


class StreakRaceConditionTest(TestCase):
    """Test atomicity of streak sync — prevents double increment per day."""

    def setUp(self):
        self.user = User.objects.create_user(username="parent1", password="pass123")
        self.child = Child.objects.create(name="Aisyah", created_by=self.user)
        ChildAccess.objects.create(user=self.user, child=self.child, role="parent")

    def test_double_save_same_day(self):
        """Calling sync twice on the same day should not double-increment.

        First sync sets last_reading_date=today → second sync is rejected.
        """
        today = timezone.now().date()
        payload = {
            "reading_date": str(today),
            "content_type": "book",
            "content_id": "1",
            "quiz_passed": True,
        }
        c = APIClient()
        c.force_authenticate(self.user)
        url = reverse("streak-sync", kwargs={"child_pk": self.child.pk})

        r1 = c.post(url, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)

        r2 = c.post(url, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

        # Streak must be exactly 1
        streak = Streak.objects.get(child=self.child)
        self.assertEqual(streak.current_streak, 1)
        self.assertEqual(streak.last_reading_date, today)
