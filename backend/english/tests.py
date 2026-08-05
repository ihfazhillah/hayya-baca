import shutil
import tempfile
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from english.models import (
    EnglishLesson,
    EnglishSegment,
    EnglishStreak,
    EnglishWeakPoint,
)
from english.signing import sign_segment

User = get_user_model()

LIST_URL = reverse("english-lesson-list")


def make_lesson(**kw):
    kw.setdefault("source", EnglishLesson.Source.CUSTOM)
    return EnglishLesson.objects.create(**kw)


def auth(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class AuthRequiredTest(TestCase):
    def test_list_requires_auth(self):
        self.assertEqual(APIClient().get(LIST_URL).status_code, 401)

    def test_transcribe_requires_auth(self):
        url = reverse("english-transcribe")
        self.assertEqual(APIClient().post(url).status_code, 401)


class VisibilityTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.b = User.objects.create_user("bob", password="pw")
        S = EnglishLesson.Status
        self.admin_pub = make_lesson(title="Admin Pub", is_published=True)
        self.admin_unpub = make_lesson(title="Admin Draft", is_published=False)
        self.a_private = make_lesson(
            title="A private", owner=self.a, audio_status=S.READY
        )
        self.a_processing = make_lesson(
            title="A processing", owner=self.a, audio_status=S.PENDING
        )
        self.b_pub_ready = make_lesson(
            title="B public", owner=self.b, is_public=True, audio_status=S.READY
        )
        self.b_pub_proc = make_lesson(
            title="B public proc", owner=self.b, is_public=True, audio_status=S.PENDING
        )

    def test_list_visibility_for_alice(self):
        ids = {l["id"] for l in auth(self.a).get(LIST_URL).json()}
        self.assertEqual(
            ids,
            {
                self.admin_pub.id,
                self.a_private.id,
                self.a_processing.id,
                self.b_pub_ready.id,
            },
        )

    def test_detail_hidden_admin_draft_is_404(self):
        r = auth(self.a).get(
            reverse("english-lesson-detail", args=[self.admin_unpub.id])
        )
        self.assertEqual(r.status_code, 404)

    def test_detail_other_private_is_404_not_403(self):
        r = auth(self.b).get(
            reverse("english-lesson-detail", args=[self.a_private.id])
        )
        self.assertEqual(r.status_code, 404)

    def test_owner_sees_own_processing_detail(self):
        r = auth(self.a).get(
            reverse("english-lesson-detail", args=[self.a_processing.id])
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["audio_status"], "pending")
        self.assertTrue(r.json()["is_owner"])

    def test_public_processing_hidden_from_others(self):
        r = auth(self.a).get(
            reverse("english-lesson-detail", args=[self.b_pub_proc.id])
        )
        self.assertEqual(r.status_code, 404)


class CreateLessonTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")

    def test_create_splits_segments_and_sets_owner_pending(self):
        payload = {
            "title": "My lesson",
            "level": "beginner",
            "text": "Hello there. How are you? I am fine.",
            "is_public": True,
        }
        r = auth(self.a).post(LIST_URL, payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        lesson = EnglishLesson.objects.get(id=r.json()["id"])
        self.assertEqual(lesson.owner, self.a)
        self.assertEqual(lesson.audio_status, EnglishLesson.Status.PENDING)
        self.assertEqual(lesson.source, EnglishLesson.Source.CUSTOM)
        self.assertTrue(lesson.is_public)
        texts = list(lesson.segments.order_by("order").values_list("text", flat=True))
        self.assertEqual(texts, ["Hello there.", "How are you?", "I am fine."])

    def test_create_empty_text_is_400(self):
        r = auth(self.a).post(
            LIST_URL, {"title": "x", "text": "   "}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_create_too_many_segments_is_400(self):
        text = " ".join(f"Sentence number {i}." for i in range(200))
        r = auth(self.a).post(
            LIST_URL, {"title": "x", "text": text}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_create_requires_auth(self):
        r = APIClient().post(LIST_URL, {"title": "x", "text": "Hi."}, format="json")
        self.assertEqual(r.status_code, 401)


class PatchDeleteTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.b = User.objects.create_user("bob", password="pw")
        self.lesson = make_lesson(title="A", owner=self.a, audio_status="ready")

    def test_owner_can_toggle_public(self):
        r = auth(self.a).patch(
            reverse("english-lesson-detail", args=[self.lesson.id]),
            {"is_public": True},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.lesson.refresh_from_db()
        self.assertTrue(self.lesson.is_public)

    def test_non_owner_patch_is_404(self):
        r = auth(self.b).patch(
            reverse("english-lesson-detail", args=[self.lesson.id]),
            {"is_public": True},
            format="json",
        )
        self.assertEqual(r.status_code, 404)
        self.lesson.refresh_from_db()
        self.assertFalse(self.lesson.is_public)

    def test_owner_can_delete(self):
        r = auth(self.a).delete(
            reverse("english-lesson-detail", args=[self.lesson.id])
        )
        self.assertEqual(r.status_code, 204)
        self.assertFalse(EnglishLesson.objects.filter(id=self.lesson.id).exists())

    def test_non_owner_delete_is_404(self):
        r = auth(self.b).delete(
            reverse("english-lesson-detail", args=[self.lesson.id])
        )
        self.assertEqual(r.status_code, 404)
        self.assertTrue(EnglishLesson.objects.filter(id=self.lesson.id).exists())


_MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=_MEDIA)
class SegmentAudioTest(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.b = User.objects.create_user("bob", password="pw")
        self.lesson = make_lesson(title="A", owner=self.a, audio_status="ready")
        self.seg = EnglishSegment.objects.create(
            lesson=self.lesson, order=0, text="Hello."
        )
        self.seg.audio.save("x.mp3", SimpleUploadedFile("x.mp3", b"ID3audio"), save=True)
        self.url = reverse("english-segment-audio", args=[self.seg.id])

    def test_owner_can_stream(self):
        self.assertEqual(auth(self.a).get(self.url).status_code, 200)

    def test_non_owner_private_is_404(self):
        self.assertEqual(auth(self.b).get(self.url).status_code, 404)

    def test_valid_signature_allows_anonymous(self):
        t = sign_segment(self.seg.id)
        self.assertEqual(APIClient().get(self.url, {"t": t}).status_code, 200)

    def test_bad_signature_anonymous_denied(self):
        r = APIClient().get(self.url, {"t": "garbage"})
        self.assertIn(r.status_code, (403, 404))

    @override_settings(ENGLISH_USE_X_ACCEL=True)
    def test_x_accel_header_when_enabled(self):
        r = auth(self.a).get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.headers.get("X-Accel-Redirect", "").endswith(self.seg.audio.name))
        self.assertEqual(r.headers.get("Content-Type"), "audio/mpeg")

    def test_serializer_audio_url_points_to_signed_endpoint(self):
        r = auth(self.a).get(
            reverse("english-lesson-detail", args=[self.lesson.id])
        )
        audio_url = r.json()["segments"][0]["audio_url"]
        self.assertIn(f"/english/segments/{self.seg.id}/audio/", audio_url)
        self.assertIn("t=", audio_url)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class WorkerTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.lesson = make_lesson(
            title="W", owner=self.a, audio_status=EnglishLesson.Status.PENDING
        )
        for i, t in enumerate(["One.", "Two."]):
            EnglishSegment.objects.create(lesson=self.lesson, order=i, text=t)

    def test_generates_and_marks_ready(self):
        with mock.patch("english.tts.render_mp3", return_value=b"ID3fake") as m:
            call_command("generate_pending_audio")
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.audio_status, EnglishLesson.Status.READY)
        self.assertEqual(m.call_count, 2)
        self.assertTrue(all(s.audio for s in self.lesson.segments.all()))

    def test_failure_marks_failed_with_reason(self):
        with mock.patch("english.tts.render_mp3", side_effect=RuntimeError("boom")):
            call_command("generate_pending_audio")
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.audio_status, EnglishLesson.Status.FAILED)
        self.assertIn("boom", self.lesson.error)

    def test_resumable_skips_existing_audio(self):
        seg0 = self.lesson.segments.get(order=0)
        seg0.audio.save("done.mp3", SimpleUploadedFile("done.mp3", b"x"), save=True)
        with mock.patch("english.tts.render_mp3", return_value=b"ID3fake") as m:
            call_command("generate_pending_audio")
        self.assertEqual(m.call_count, 1)  # only the missing segment
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.audio_status, EnglishLesson.Status.READY)


class WeakPointTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.b = User.objects.create_user("bob", password="pw")
        self.list_url = reverse("english-weakpoints")
        self.record_url = reverse("english-weakpoints-record")

    def record(self, client, phoneme, *, fail=0, passes=0):
        return client.post(
            self.record_url,
            [{"phoneme": phoneme, "fail": fail, "pass": passes}],
            format="json",
        )

    def active_phonemes(self, client):
        return {w["phoneme"] for w in client.get(self.list_url).json()}

    def test_requires_auth(self):
        self.assertEqual(APIClient().get(self.list_url).status_code, 401)
        self.assertEqual(APIClient().post(self.record_url, [], format="json").status_code, 401)

    def test_activates_after_three_fails(self):
        c = auth(self.a)
        for _ in range(2):
            self.record(c, "TH", fail=1)
        self.assertNotIn("TH", self.active_phonemes(c))  # below threshold
        self.record(c, "TH", fail=1)  # 3rd fail
        self.assertIn("TH", self.active_phonemes(c))
        wp = EnglishWeakPoint.objects.get(owner=self.a, phoneme="TH")
        self.assertEqual(wp.status, EnglishWeakPoint.Status.ACTIVE)

    def test_clears_after_three_passes(self):
        c = auth(self.a)
        for _ in range(3):
            self.record(c, "R", fail=1)  # activate
        for _ in range(3):
            self.record(c, "R", passes=1)  # clear
        self.assertNotIn("R", self.active_phonemes(c))
        wp = EnglishWeakPoint.objects.get(owner=self.a, phoneme="R")
        self.assertEqual(wp.status, EnglishWeakPoint.Status.CLEARED)
        self.assertEqual(wp.fail_count, 0)

    def test_pass_streak_resets_on_fail(self):
        c = auth(self.a)
        for _ in range(3):
            self.record(c, "V", fail=1)
        self.record(c, "V", passes=2)
        self.record(c, "V", fail=1)  # breaks streak
        wp = EnglishWeakPoint.objects.get(owner=self.a, phoneme="V")
        self.assertEqual(wp.pass_streak, 0)
        self.assertEqual(wp.status, EnglishWeakPoint.Status.ACTIVE)

    def test_resurfaces_after_clear(self):
        c = auth(self.a)
        for _ in range(3):
            self.record(c, "L", fail=1)
        for _ in range(3):
            self.record(c, "L", passes=1)  # cleared
        for _ in range(3):
            self.record(c, "L", fail=1)  # fails again
        self.assertIn("L", self.active_phonemes(c))

    def test_owner_isolation(self):
        cb = auth(self.b)
        for _ in range(3):
            self.record(cb, "TH", fail=1)
        self.assertIn("TH", self.active_phonemes(cb))
        self.assertNotIn("TH", self.active_phonemes(auth(self.a)))


class StreakTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.b = User.objects.create_user("bob", password="pw")
        self.ping_url = reverse("english-streak-ping")
        self.status_url = reverse("english-streak")
        self.today = timezone.localdate()

    def test_requires_auth(self):
        self.assertEqual(APIClient().get(self.status_url).status_code, 401)
        self.assertEqual(APIClient().post(self.ping_url).status_code, 401)

    def test_first_ping_is_one(self):
        r = auth(self.a).post(self.ping_url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["current_streak"], 1)
        self.assertEqual(r.json()["longest_streak"], 1)
        self.assertTrue(r.json()["practiced_today"])

    def test_same_day_ping_no_change(self):
        c = auth(self.a)
        c.post(self.ping_url)
        r = c.post(self.ping_url)
        self.assertEqual(r.json()["current_streak"], 1)

    def test_consecutive_day_increments(self):
        c = auth(self.a)
        c.post(self.ping_url)  # today → 1
        # pretend the last practice was yesterday
        s = EnglishStreak.objects.get(owner=self.a)
        s.last_practice_date = self.today - timedelta(days=1)
        s.save()
        r = c.post(self.ping_url)
        self.assertEqual(r.json()["current_streak"], 2)

    def test_gap_resets_but_keeps_longest(self):
        s = EnglishStreak.objects.create(
            owner=self.a,
            current_streak=5,
            longest_streak=5,
            last_practice_date=self.today - timedelta(days=2),
        )
        r = auth(self.a).post(self.ping_url)
        self.assertEqual(r.json()["current_streak"], 1)
        self.assertEqual(r.json()["longest_streak"], 5)
        s.refresh_from_db()
        self.assertEqual(s.current_streak, 1)

    def test_owner_isolation(self):
        auth(self.b).post(self.ping_url)
        r = auth(self.a).get(self.status_url)
        self.assertEqual(r.json()["current_streak"], 0)
        self.assertFalse(r.json()["practiced_today"])


class WordPracticeTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.b = User.objects.create_user("bob", password="pw")
        self.list_url = reverse("english-words")
        self.record_url = reverse("english-words-record")
        self.add_url = reverse("english-words-add")
        self.remove_url = reverse("english-words-remove")

    def rec(self, client, word, *, fail=0, passes=0):
        return client.post(
            self.record_url,
            [{"word": word, "fail": fail, "pass": passes}],
            format="json",
        )

    def active(self, client):
        return {w["word"] for w in client.get(self.list_url).json()}

    def test_requires_auth(self):
        self.assertEqual(APIClient().get(self.list_url).status_code, 401)
        self.assertEqual(APIClient().post(self.add_url, {"word": "x"}, format="json").status_code, 401)

    def test_activates_after_three_fails(self):
        c = auth(self.a)
        for _ in range(2):
            self.rec(c, "Attribution", fail=1)
        self.assertNotIn("attribution", self.active(c))
        self.rec(c, "attribution", fail=1)
        self.assertIn("attribution", self.active(c))  # normalized lowercase

    def test_clears_after_three_passes(self):
        c = auth(self.a)
        for _ in range(3):
            self.rec(c, "nuanced", fail=1)
        for _ in range(3):
            self.rec(c, "nuanced", passes=1)
        self.assertNotIn("nuanced", self.active(c))

    def test_manual_add_is_active_immediately(self):
        c = auth(self.a)
        r = c.post(self.add_url, {"word": "We're"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["word"], "we're")  # keeps apostrophe
        self.assertTrue(r.json()["manual"])
        self.assertIn("we're", self.active(c))

    def test_remove(self):
        c = auth(self.a)
        c.post(self.add_url, {"word": "issues"}, format="json")
        c.post(self.remove_url, {"word": "issues"}, format="json")
        self.assertNotIn("issues", self.active(c))

    def test_empty_add_is_400(self):
        r = auth(self.a).post(self.add_url, {"word": "  !! "}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_owner_isolation(self):
        c = auth(self.b)
        c.post(self.add_url, {"word": "issues"}, format="json")
        self.assertIn("issues", self.active(c))
        self.assertNotIn("issues", self.active(auth(self.a)))


class DictLookupTest(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", password="pw")
        self.url = reverse("english-dict")

    def test_requires_auth(self):
        self.assertEqual(APIClient().get(self.url, {"word": "the"}).status_code, 401)

    def test_empty_word_is_400(self):
        self.assertEqual(auth(self.a).get(self.url, {"word": " !! "}).status_code, 400)

    def test_lookup_fetches_then_caches(self):
        fake = {"ipa": "/wɜːd/", "audio": "https://x/word.mp3", "found": True}
        with mock.patch("english.views.fetch_dict", return_value=fake) as m:
            r1 = auth(self.a).get(self.url, {"word": "Word"})
            r2 = auth(self.a).get(self.url, {"word": "word"})
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json(), {"word": "word", "ipa": "/wɜːd/", "audio": "https://x/word.mp3"})
        self.assertEqual(r2.json()["ipa"], "/wɜːd/")
        self.assertEqual(m.call_count, 1)  # second hit served from cache
