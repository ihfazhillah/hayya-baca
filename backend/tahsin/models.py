"""Tahsin Tracker models (Spec 072).

Guardian owns everything (single-owner v1). A Santri may be marked as a
`pengampu` (a senior student who also grades others); marking one creates a
linked login-only User + a permanent QR/text login code.
"""
import secrets

from django.conf import settings
from django.db import models
from django.utils.text import slugify

# Reuse the non-ambiguous alphabet used for child setup codes (no O/0/I/1/L).
from accounts.models import SETUP_CODE_ALPHABET

LOGIN_CODE_LENGTH = 8


def generate_login_code():
    """A unique permanent login code for a pengampu."""
    while True:
        code = "".join(
            secrets.choice(SETUP_CODE_ALPHABET) for _ in range(LOGIN_CODE_LENGTH)
        )
        if not Santri.objects.filter(login_code=code).exists():
            return code


class TahsinItem(models.Model):
    """An assessed aspect, e.g. "Nun sukun / tanwin" (code "ns/t")."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tahsin_items",
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Santri(models.Model):
    """A student. Pengampu (grader) is a Santri with is_pengampu=True."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tahsin_santri",
    )
    name = models.CharField(max_length=100)
    is_pengampu = models.BooleanField(default=False)
    # Login account — only pengampu accounts have one.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tahsin_pengampu_profile",
    )
    login_code = models.CharField(
        max_length=LOGIN_CODE_LENGTH, unique=True, null=True, blank=True
    )
    # A plain santri's grader (1 pengampu : m santri). Self-referential.
    pengampu = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="students",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name_plural = "santri"

    def __str__(self):
        return self.name


class TahsinRecord(models.Model):
    """One reading session for a santri on a date."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tahsin_records",
    )
    santri = models.ForeignKey(
        Santri, on_delete=models.CASCADE, related_name="records"
    )
    date = models.DateField()
    page = models.PositiveSmallIntegerField(null=True, blank=True)
    page_detail = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tahsin_records_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.santri} @ {self.date}"


class TahsinScore(models.Model):
    """A 0..5 score for one aspect within a record.

    An aspect not assessed on a given day has NO row (not a zero).
    """

    record = models.ForeignKey(
        TahsinRecord, on_delete=models.CASCADE, related_name="scores"
    )
    item = models.ForeignKey(TahsinItem, on_delete=models.CASCADE)
    value = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = ["record", "item"]

    def __str__(self):
        return f"{self.item.code}={self.value}"


def make_pengampu_username(owner, name):
    """Deterministic-ish, collision-safe username for a pengampu login."""
    User = owner.__class__
    base = f"tahsin-{owner.id}-{slugify(name) or 'pengampu'}"
    username = base
    n = 1
    while User.objects.filter(username=username).exists():
        n += 1
        username = f"{base}-{n}"
    return username
