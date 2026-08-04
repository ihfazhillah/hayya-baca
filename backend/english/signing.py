"""Short-lived signed tokens authorizing access to one segment's audio.

`<audio>` tags and expo-av cannot send an Authorization header, so segment
audio URLs embed a signed `?t=` token instead. The token only proves "this
segment may be streamed until it expires" — it is handed out solely inside
visibility-gated lesson-detail responses, so unprivileged users never receive
one. (Spec 064, plan option A.)
"""

from django.conf import settings
from django.core import signing

SALT = "english-segment-audio"


def _max_age() -> int:
    return int(getattr(settings, "ENGLISH_AUDIO_URL_TTL", 60 * 60 * 12))  # 12h


def sign_segment(segment_id: int) -> str:
    return signing.dumps(int(segment_id), salt=SALT)


def unsign_segment(token: str):
    """Return the segment id if the token is valid & unexpired, else None."""
    try:
        return signing.loads(token, salt=SALT, max_age=_max_age())
    except (signing.BadSignature, signing.SignatureExpired, ValueError, TypeError):
        return None
