"""Tahsin Tracker tests (Spec 072) — use-case level over the HTTP API."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Child
from tahsin.models import Santri, TahsinItem, TahsinRecord, TahsinScore
from tahsin.summary import period_range

User = get_user_model()


def auth(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class BaseData(TestCase):
    def setUp(self):
        self.guardian = User.objects.create_user("ustadz", password="pw")
        self.other = User.objects.create_user("ustadz2", password="pw")
        self.ns = TahsinItem.objects.create(
            owner=self.guardian, name="Nun sukun", code="ns/t", order=0
        )
        self.mt = TahsinItem.objects.create(
            owner=self.guardian, name="Mad thobi'i", code="mt", order=1
        )
        # A pengampu + two of their students, plus one unassigned santri.
        self.hamzah = Santri.objects.create(
            owner=self.guardian, name="Hamzah", is_pengampu=True
        )
        from tahsin.services import ensure_pengampu_account

        ensure_pengampu_account(self.hamzah)
        self.hamzah.refresh_from_db()
        self.ahmad = Santri.objects.create(
            owner=self.guardian, name="Ahmad", pengampu=self.hamzah
        )
        self.zaid = Santri.objects.create(
            owner=self.guardian, name="Zaid", pengampu=self.hamzah
        )
        self.lone = Santri.objects.create(owner=self.guardian, name="Musa")


class RoleTest(BaseData):
    def test_guardian_me(self):
        r = auth(self.guardian).get(reverse("tahsin:tahsin-me"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["role"], "guardian")
        self.assertEqual(len(r.data["santri"]), 4)
        self.assertEqual(len(r.data["items"]), 2)

    def test_pengampu_me_sees_only_their_students(self):
        r = auth(self.hamzah.user).get(reverse("tahsin:tahsin-me"))
        self.assertEqual(r.data["role"], "pengampu")
        names = {s["name"] for s in r.data["santri"]}
        self.assertEqual(names, {"Ahmad", "Zaid"})
        self.assertEqual(r.data["santri_id"], self.hamzah.id)

    def test_child_account_denied(self):
        child_user = User.objects.create_user("anak", password="pw")
        Child.objects.create(name="Anak", created_by=self.guardian, user=child_user)
        r = auth(child_user).get(reverse("tahsin:tahsin-me"))
        self.assertEqual(r.status_code, 403)

    def test_anonymous_denied(self):
        self.assertEqual(
            APIClient().get(reverse("tahsin:tahsin-me")).status_code, 401
        )


class ItemTest(BaseData):
    def test_seed_only_when_empty_and_idempotent(self):
        TahsinItem.objects.filter(owner=self.guardian).delete()
        url = reverse("tahsin:tahsin-item-seed")
        r = auth(self.guardian).post(url)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(
            set(TahsinItem.objects.filter(owner=self.guardian).values_list("code", flat=True)),
            {"ns/t", "mt"},
        )
        # Second call adds nothing.
        auth(self.guardian).post(url)
        self.assertEqual(TahsinItem.objects.filter(owner=self.guardian).count(), 2)

    def test_delete_is_soft(self):
        url = reverse("tahsin:tahsin-item-detail", args=[self.ns.id])
        auth(self.guardian).delete(url)
        self.ns.refresh_from_db()
        self.assertFalse(self.ns.is_active)

    def test_pengampu_cannot_manage_items(self):
        r = auth(self.hamzah.user).post(
            reverse("tahsin:tahsin-item-list"), {"name": "X", "code": "x"}
        )
        self.assertEqual(r.status_code, 403)


class PengampuAccountTest(BaseData):
    def test_marking_pengampu_creates_login(self):
        r = auth(self.guardian).post(
            reverse("tahsin:tahsin-santri-list"),
            {"name": "Umar", "is_pengampu": True},
        )
        self.assertEqual(r.status_code, 201)
        umar = Santri.objects.get(name="Umar")
        self.assertIsNotNone(umar.user)
        self.assertTrue(umar.login_code)

    def test_login_code_redeem(self):
        r = APIClient().post(
            reverse("tahsin:tahsin-login-code"), {"code": self.hamzah.login_code}
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["name"], "Hamzah")
        self.assertTrue(Token.objects.filter(user=self.hamzah.user).exists())

    def test_login_code_lowercase_ok(self):
        r = APIClient().post(
            reverse("tahsin:tahsin-login-code"),
            {"code": self.hamzah.login_code.lower()},
        )
        self.assertEqual(r.status_code, 200)

    def test_bad_code_rejected(self):
        r = APIClient().post(
            reverse("tahsin:tahsin-login-code"), {"code": "ZZZZZZZZ"}
        )
        self.assertEqual(r.status_code, 400)

    def test_regenerate_revokes_old_token(self):
        token = Token.objects.create(user=self.hamzah.user)
        old_code = self.hamzah.login_code
        r = auth(self.guardian).post(
            reverse("tahsin:tahsin-santri-login-code-regenerate", args=[self.hamzah.id])
        )
        self.assertEqual(r.status_code, 200)
        self.hamzah.refresh_from_db()
        self.assertNotEqual(self.hamzah.login_code, old_code)
        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_unmarking_pengampu_orphans_students_and_revokes(self):
        url = reverse("tahsin:tahsin-santri-detail", args=[self.hamzah.id])
        r = auth(self.guardian).patch(url, {"is_pengampu": False})
        self.assertEqual(r.status_code, 200)
        self.hamzah.refresh_from_db()
        self.ahmad.refresh_from_db()
        self.assertIsNone(self.hamzah.login_code)
        self.assertIsNone(self.ahmad.pengampu)

    def test_assign_moves_student(self):
        umar = Santri.objects.create(
            owner=self.guardian, name="Umar", is_pengampu=True
        )
        from tahsin.services import ensure_pengampu_account

        ensure_pengampu_account(umar)
        r = auth(self.guardian).post(
            reverse("tahsin:tahsin-santri-assign", args=[self.ahmad.id]),
            {"pengampu": umar.id},
        )
        self.assertEqual(r.status_code, 200)
        self.ahmad.refresh_from_db()
        self.assertEqual(self.ahmad.pengampu_id, umar.id)


class RecordTest(BaseData):
    def _post(self, client, **kw):
        body = {
            "santri": self.ahmad.id,
            "date": "2026-08-13",
            "page": 44,
            "page_detail": "ayat 1-10",
            "scores": [{"item": self.ns.id, "value": 3}],
        }
        body.update(kw)
        return client.post(
            reverse("tahsin:tahsin-record-list"), body, format="json"
        )

    def test_pengampu_creates_for_own_student(self):
        r = self._post(auth(self.hamzah.user))
        self.assertEqual(r.status_code, 201)
        rec = TahsinRecord.objects.get(id=r.data["id"])
        self.assertEqual(rec.created_by, self.hamzah.user)
        self.assertEqual(rec.owner, self.guardian)
        self.assertEqual(rec.scores.count(), 1)

    def test_pengampu_cannot_create_for_other_student(self):
        r = self._post(auth(self.hamzah.user), santri=self.lone.id)
        self.assertEqual(r.status_code, 400)

    def test_partial_scores_allowed(self):
        r = self._post(auth(self.guardian), scores=[])
        self.assertEqual(r.status_code, 201)
        self.assertEqual(TahsinScore.objects.filter(record_id=r.data["id"]).count(), 0)

    def test_score_out_of_range_rejected(self):
        r = self._post(
            auth(self.guardian), scores=[{"item": self.ns.id, "value": 9}]
        )
        self.assertEqual(r.status_code, 400)

    def test_page_optional(self):
        r = self._post(auth(self.guardian), page=None, page_detail="seperempat")
        self.assertEqual(r.status_code, 201)

    def test_pengampu_only_sees_own_students_records(self):
        self._post(auth(self.hamzah.user))  # ahmad
        TahsinRecord.objects.create(
            owner=self.guardian, santri=self.lone, date=date(2026, 8, 13)
        )
        r = auth(self.hamzah.user).get(reverse("tahsin:tahsin-record-list"))
        santri_ids = {row["santri"] for row in r.data}
        self.assertEqual(santri_ids, {self.ahmad.id})

    def test_edit_replaces_scores(self):
        rec = self._post(auth(self.hamzah.user)).data
        url = reverse("tahsin:tahsin-record-detail", args=[rec["id"]])
        r = auth(self.hamzah.user).patch(
            url,
            {"scores": [{"item": self.mt.id, "value": 5}]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        codes = set(
            TahsinScore.objects.filter(record_id=rec["id"]).values_list(
                "item__code", flat=True
            )
        )
        self.assertEqual(codes, {"mt"})

    def test_pengampu_cannot_edit_guardian_record(self):
        rec = TahsinRecord.objects.create(
            owner=self.guardian,
            santri=self.ahmad,
            date=date(2026, 8, 13),
            created_by=self.guardian,
        )
        url = reverse("tahsin:tahsin-record-detail", args=[rec.id])
        r = auth(self.hamzah.user).patch(url, {"page": 5}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_bulk_atomic(self):
        url = reverse("tahsin:tahsin-record-bulk")
        good = {
            "santri": self.ahmad.id,
            "date": "2026-08-13",
            "scores": [{"item": self.ns.id, "value": 2}],
        }
        bad = {"santri": self.lone.id, "date": "2026-08-13", "scores": []}
        r = auth(self.hamzah.user).post(url, [good, bad], format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("1", {str(k) for k in r.data["errors"]})
        self.assertEqual(TahsinRecord.objects.count(), 0)

    def test_bulk_success(self):
        url = reverse("tahsin:tahsin-record-bulk")
        rows = [
            {
                "santri": self.ahmad.id,
                "date": "2026-08-13",
                "scores": [{"item": self.ns.id, "value": 2}],
            },
            {
                "santri": self.zaid.id,
                "date": "2026-08-13",
                "scores": [{"item": self.mt.id, "value": 4}],
            },
        ]
        r = auth(self.hamzah.user).post(url, rows, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(TahsinRecord.objects.count(), 2)


class SummaryTest(BaseData):
    def _rec(self, santri, d, scores):
        rec = TahsinRecord.objects.create(
            owner=self.guardian, santri=santri, date=d, created_by=self.guardian
        )
        for item, val in scores:
            TahsinScore.objects.create(record=rec, item=item, value=val)
        return rec

    def test_week_range_monday_to_sunday(self):
        cs, ce, ps, pe = period_range("week", date(2026, 8, 13))  # Thu
        self.assertEqual(cs, date(2026, 8, 10))  # Monday
        self.assertEqual(ce, date(2026, 8, 16))  # Sunday
        self.assertEqual(ps, date(2026, 8, 3))
        self.assertEqual(pe, date(2026, 8, 9))

    def test_month_range(self):
        cs, ce, ps, pe = period_range("month", date(2026, 8, 13))
        self.assertEqual((cs, ce), (date(2026, 8, 1), date(2026, 8, 31)))
        self.assertEqual((ps, pe), (date(2026, 7, 1), date(2026, 7, 31)))

    def test_summary_avg_and_prev(self):
        # current week
        self._rec(self.ahmad, date(2026, 8, 13), [(self.ns, 2), (self.mt, 4)])
        self._rec(self.ahmad, date(2026, 8, 11), [(self.ns, 4)])
        # previous week
        self._rec(self.ahmad, date(2026, 8, 5), [(self.ns, 1)])
        r = auth(self.guardian).get(
            reverse("tahsin:tahsin-summary"),
            {"period": "week", "start": "2026-08-13"},
        )
        self.assertEqual(r.status_code, 200)
        ns_row = next(i for i in r.data["items"] if i["code"] == "ns/t")
        self.assertEqual(ns_row["avg"], 3.0)  # (2+4)/2
        self.assertEqual(ns_row["prev_avg"], 1.0)
        self.assertEqual(ns_row["count"], 2)
        ahmad = next(s for s in r.data["santri"] if s["id"] == self.ahmad.id)
        self.assertEqual(ahmad["sessions"], 2)
        self.assertEqual(ahmad["last_date"], "2026-08-13")

    def test_pengampu_summary_scoped(self):
        self._rec(self.ahmad, date(2026, 8, 13), [(self.ns, 2)])
        self._rec(self.lone, date(2026, 8, 13), [(self.ns, 5)])
        r = auth(self.hamzah.user).get(
            reverse("tahsin:tahsin-summary"),
            {"period": "week", "start": "2026-08-13"},
        )
        santri_ids = {s["id"] for s in r.data["santri"]}
        self.assertNotIn(self.lone.id, santri_ids)
        self.assertIn(self.ahmad.id, santri_ids)
