"""Private media serving for comic panels (Spec 060 plan §2.3).

Panel images are diary content and must never be reachable at a public /media/
path. Instead the API hands out short-lived signed URLs so a plain <img src>
works without an Authorization header, while access stays capability-scoped.
"""
from urllib.parse import quote

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.urls import reverse

SALT = "diary.panel.media"
MEDIA_TTL = 60 * 60  # 1 hour


def _signer():
    return TimestampSigner(salt=SALT)


def signed_panel_token(panel_id):
    return _signer().sign(str(panel_id))


def verify_panel_token(token, panel_id, max_age=MEDIA_TTL):
    try:
        value = _signer().unsign(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return False
    return value == str(panel_id)


def signed_panel_url(panel, request=None):
    if not panel.image:
        return None
    token = signed_panel_token(panel.id)
    path = reverse("diary:panel-media", kwargs={"pk": panel.id})
    url = f"{path}?token={quote(token)}"
    return request.build_absolute_uri(url) if request is not None else url
