import pytest


@pytest.fixture(autouse=True)
def _isolated_media(settings, tmp_path):
    """Keep test uploads out of the real MEDIA_ROOT."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
