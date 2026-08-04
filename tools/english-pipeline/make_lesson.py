#!/usr/bin/env python3
"""english-pipeline — produce lesson folders for Hayya Baca's English module.

Runs in its OWN virtualenv (Python 3.10–3.12; the Django backend is on 3.14
which MeloTTS/Whisper do not support). Heavy work happens here, offline:

  * text lesson    : MeloTTS EN-AU synthesizes each sentence  -> mp3 per segment
  * youtube lesson : yt-dlp downloads audio, transcript from YouTube subtitles
                     (fallback: faster-whisper), segments cut with ffmpeg

Output folder is then imported into Django:
  uv run python manage.py import_english_lesson <out/slug> --publish

Usage:
  python make_lesson.py text script.txt --title "At the Cafe" --level beginner
  python make_lesson.py youtube "https://youtube.com/watch?v=..." --title "ABC News Story"
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MAX_DURATION_S = 1200  # skip videos longer than 20 minutes


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or "lesson"


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.replace("\n", " "))
    return [p.strip() for p in parts if p.strip()]


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def to_mp3(src: Path, dst: Path, start: float | None = None, end: float | None = None):
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    if start is not None:
        pad = 0.15
        cmd += ["-ss", f"{max(0, start - pad):.2f}", "-t", f"{max(0.5, end - start + 2 * pad):.2f}"]
    cmd += ["-i", str(src), "-ac", "1", "-ar", "24000", "-b:a", "64k", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True)


# ---------------------------------------------------------------------------
# text lesson (MeloTTS EN-AU)
# ---------------------------------------------------------------------------
def build_text_lesson(script_path: Path, out_dir: Path, speed: float) -> list[dict]:
    from melo.api import TTS

    sentences = split_sentences(script_path.read_text(encoding="utf-8"))
    if not sentences:
        sys.exit("File teks kosong.")

    print(f"Memuat MeloTTS (EN)… {len(sentences)} kalimat akan disintesis.")
    model = TTS(language="EN", device="cpu")
    spk2id = model.hps.data.spk2id
    speaker = "EN-AU" if "EN-AU" in spk2id else next(k for k in spk2id if "AU" in k.upper())

    seg_dir = out_dir / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)

    segments = []
    for i, sentence in enumerate(sentences):
        wav = seg_dir / f"{i:03d}.wav"
        mp3 = seg_dir / f"{i:03d}.mp3"
        model.tts_to_file(sentence, spk2id[speaker], str(wav), speed=speed, quiet=True)
        to_mp3(wav, mp3)
        wav.unlink()
        segments.append({
            "text": sentence,
            "audio": f"segments/{mp3.name}",
            "duration": round(ffprobe_duration(mp3), 2),
        })
        print(f"  [{i + 1}/{len(sentences)}] {sentence[:60]}")
    return segments


# ---------------------------------------------------------------------------
# youtube lesson (yt-dlp + transcript / whisper)
# ---------------------------------------------------------------------------
def extract_video_id(url: str) -> str | None:
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([0-9A-Za-z_-]{11})", url)
    return m.group(1) if m else None


def fetch_transcript(video_id: str) -> list[dict] | None:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        try:  # v1.x
            fetched = YouTubeTranscriptApi().fetch(
                video_id, languages=["en", "en-AU", "en-GB", "en-US"])
            entries = [{"start": s.start, "end": s.start + s.duration, "text": s.text}
                       for s in fetched]
        except AttributeError:  # 0.6.x
            raw = YouTubeTranscriptApi.get_transcript(
                video_id, languages=["en", "en-AU", "en-GB", "en-US"])
            entries = [{"start": e["start"], "end": e["start"] + e["duration"],
                        "text": e["text"]} for e in raw]
        entries = [e for e in entries if e["text"].strip() and not e["text"].startswith("[")]
        return entries or None
    except Exception:
        return None


def merge_entries(entries: list[dict], target_len: float = 8.0) -> list[dict]:
    merged, cur = [], None
    for e in entries:
        if cur is None:
            cur = dict(e)
            continue
        dur = cur["end"] - cur["start"]
        ends = cur["text"].rstrip().endswith((".", "?", "!"))
        if dur >= target_len or (ends and dur >= 3.0):
            merged.append(cur)
            cur = dict(e)
        else:
            cur["text"] = cur["text"].rstrip() + " " + e["text"].lstrip()
            cur["end"] = e["end"]
    if cur:
        merged.append(cur)
    return merged


def build_youtube_lesson(url: str, out_dir: Path) -> tuple[list[dict], str]:
    vid = extract_video_id(url)
    if not vid:
        sys.exit("URL YouTube tidak valid.")

    tmpdir = Path(tempfile.mkdtemp(prefix="yt_"))
    print("Mengunduh audio dengan yt-dlp…")
    res = subprocess.run(
        ["yt-dlp", "-f", "bestaudio/best", "--extract-audio", "--audio-format", "wav",
         "--match-filter", f"duration <= {MAX_DURATION_S}", "--no-playlist",
         "-o", str(tmpdir / "audio.%(ext)s"), url],
        capture_output=True, text=True,
    )
    full_wav = tmpdir / "audio.wav"
    if res.returncode != 0 or not full_wav.exists():
        sys.exit("Gagal download audio: " + res.stderr[-400:])

    print("Mengambil transkrip…")
    entries = fetch_transcript(vid)
    if entries is None:
        print("Tidak ada subtitle — transkripsi lokal dengan faster-whisper…")
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segs, _ = model.transcribe(str(full_wav), language="en", vad_filter=True)
        entries = [{"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
                   for s in segs]

    entries = merge_entries(entries)
    seg_dir = out_dir / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)

    segments = []
    for i, e in enumerate(entries):
        mp3 = seg_dir / f"{i:03d}.mp3"
        to_mp3(full_wav, mp3, start=e["start"], end=e["end"])
        segments.append({
            "text": e["text"],
            "audio": f"segments/{mp3.name}",
            "duration": round(ffprobe_duration(mp3), 2),
        })
        print(f"  [{i + 1}/{len(entries)}] {e['text'][:60]}")
    return segments, url


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="mode", required=True)

    t = sub.add_parser("text", help="Lesson dari file teks (MeloTTS EN-AU)")
    t.add_argument("script", type=Path)
    t.add_argument("--speed", type=float, default=1.0)

    y = sub.add_parser("youtube", help="Lesson dari video YouTube")
    y.add_argument("url")

    for p in (t, y):
        p.add_argument("--title", required=True)
        p.add_argument("--level", default="beginner",
                       choices=["beginner", "intermediate", "advanced"])
        p.add_argument("--out", type=Path, default=Path("out"))

    args = ap.parse_args()
    slug = slugify(args.title)
    out_dir = args.out / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    source_url = ""
    if args.mode == "text":
        segments = build_text_lesson(args.script, out_dir, args.speed)
        source = "custom"
    else:
        segments, source_url = build_youtube_lesson(args.url, out_dir)
        source = "youtube"

    meta = {
        "title": args.title,
        "slug": slug,
        "source": source,
        "source_url": source_url,
        "level": args.level,
        "segments": segments,
    }
    (out_dir / "lesson.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n✅ Selesai: {out_dir}")
    print(f"Import ke backend:\n  uv run python manage.py import_english_lesson {out_dir.resolve()} --publish")


if __name__ == "__main__":
    main()
