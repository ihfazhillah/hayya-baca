"""Dictionary lookup (IPA + native audio) via the free Dictionary API.

Spec 069 v2. Results are cached in EnglishDictEntry so we hit the external API
at most once per word. Uses stdlib urllib (no new dependency).
"""

import json
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.dictionaryapi.dev/api/v2/entries/en/{}"


def fetch_dict(word: str) -> dict:
    """Return {ipa, audio, found} for `word` from the external API (best-effort)."""
    try:
        req = urllib.request.Request(
            API.format(urllib.parse.quote(word)),
            headers={"User-Agent": "hayyabaca-english"},
        )
        with urllib.request.urlopen(req, timeout=6) as r:
            data = json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return {"ipa": "", "audio": "", "found": False}

    if not isinstance(data, list):
        return {"ipa": "", "audio": "", "found": False}

    ipa, audio = "", ""
    for entry in data:
        if not ipa and entry.get("phonetic"):
            ipa = entry["phonetic"]
        for ph in entry.get("phonetics", []):
            if not ipa and ph.get("text"):
                ipa = ph["text"]
            if not audio and ph.get("audio"):
                audio = ph["audio"]
    if audio.startswith("//"):
        audio = "https:" + audio
    return {"ipa": ipa, "audio": audio, "found": bool(ipa or audio)}
