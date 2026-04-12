"""Settings for e2e sync tests — isolated DB, different from dev runserver.

Activate via: DJANGO_SETTINGS_MODULE=config.settings.e2e
DB path override: E2E_DB_PATH env var (default /tmp/hayya-baca-e2e.sqlite3).
"""
import os

from .base import *  # noqa: F401,F403

DEBUG = False

ALLOWED_HOSTS = ["*"]

SECRET_KEY = "e2e-secret-not-for-production"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("E2E_DB_PATH", "/tmp/hayya-baca-e2e.sqlite3"),
        # WAL + busy-timeout so parallel writers (multi-device tests,
        # MD-1 etc.) don't 500 on "database is locked". Prod is
        # PostgreSQL; this is strictly a test-harness knob.
        "OPTIONS": {
            "timeout": 20,
            "init_command": "PRAGMA journal_mode=WAL;",
        },
    }
}

# Strip throttles if base ever adds any.
REST_FRAMEWORK = {
    **globals().get("REST_FRAMEWORK", {}),
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {},
}
