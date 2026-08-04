# english-pipeline

Menghasilkan folder lesson (audio aksen Australia + transkrip) untuk modul English di Hayya Baca. Berjalan di venv terpisah karena MeloTTS/faster-whisper butuh Python 3.10–3.12, sedangkan backend Django memakai 3.14.

## Setup (sekali)

```bash
cd tools/english-pipeline
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
python -m unidic download
python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng')"
# butuh ffmpeg terpasang di sistem: sudo apt install ffmpeg
```

## Membuat lesson

**Dari teks custom** (MeloTTS speaker EN-AU, offline):

```bash
echo "G'day! Welcome to the cafe. What would you like to order today?" > cafe.txt
python make_lesson.py text cafe.txt --title "At the Cafe" --level beginner
```

**Dari YouTube** (subtitle resmi kalau ada, kalau tidak ditranskrip faster-whisper):

```bash
python make_lesson.py youtube "https://www.youtube.com/watch?v=XXXX" \
  --title "ABC News: Sydney Weather" --level intermediate
```

Output: `out/<slug>/lesson.json` + `out/<slug>/segments/*.mp3`.

## Import ke backend

```bash
cd ../../backend
uv run python manage.py import_english_lesson ../tools/english-pipeline/out/at-the-cafe --publish
```

Lesson muncul di `GET /api/english/lessons/` dan bisa dikelola (publish/unpublish) lewat Django admin.
