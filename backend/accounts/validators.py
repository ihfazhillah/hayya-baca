"""Password policy for child diary accounts (Spec 060 — Ruang Cerita).

Deliberately looser than the adult guardian policy: children type these on
shared chromebooks, and the real threat is a curious sibling, not an internet
attacker. Weakness is compensated by progressive login lockout (LoginLockout)
and reset-only-via-guardian-QR.
"""
from django.core.exceptions import ValidationError

CHILD_PASSWORD_MIN_LENGTH = 6


class ChildPasswordValidator:
    """Minimum length only, no character-composition requirements."""

    def __init__(self, min_length=CHILD_PASSWORD_MIN_LENGTH):
        self.min_length = min_length

    def validate(self, password, user=None):
        if len(password) < self.min_length:
            raise ValidationError(
                f"Password minimal {self.min_length} karakter",
                code="password_too_short",
            )

    def get_help_text(self):
        return f"Password minimal {self.min_length} karakter."


def validate_child_password(password):
    """Run the child password policy; raises ValidationError on failure."""
    ChildPasswordValidator().validate(password)
