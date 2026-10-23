"""Impor isi course dari JSON (format: course/schema.md)."""
import json
from pathlib import Path

from django.core.management import CommandError
from django.db import transaction

from .models import (
    Alat, KalimatLatihan, Lembar, Misi, Modul, Musim, Pangkat, SoalBertanya, SoalUjian,
)
from .teks import KunciTidakDitemukan, cari, tokenize

JENIS_SYARAT = {"misi_tahap_selesai", "skor_beruntun", "jejak_maks", "pemeriksa"}
JENIS_PANGKAT = {"perunggu_semua", "buku_terbit"}
POLA_CETAK = {"gelombang", "putus", "lingkaran", "tebal", "titik"}


class _Gagal(Exception):
    pass


def _target(tokens, item):
    """Satu tempat kesalahan → {"token": [...], "celah": n|None}."""
    pola = item["cari"]
    temuan = cari(tokens, pola, item.get("ke", 1))
    if temuan.celah is None:
        return {"token": temuan.token, "celah": None}
    if pola.startswith("|") or pola.endswith("|"):
        return {"token": [], "celah": temuan.celah}
    # Celah di tengah: tanda baca di dalamnya juga boleh diklik, kata tidak.
    return {
        "token": [i for i in temuan.token if tokens[i].jenis != "kata"],
        "celah": temuan.celah,
    }


def _spasi(tokens, item):
    temuan = cari(tokens, item["cari"], item.get("ke", 1))
    spasi = [i for i in temuan.token if tokens[i].jenis == "spasi"]
    if not spasi:
        raise KunciTidakDitemukan(f"{item['cari']!r} tidak berisi spasi untuk dipotong")
    return spasi


def ubah_data_soal(jenis, sumber):
    """JSON penulis → data yang disimpan (token + kunci berbentuk indeks)."""
    data = {k: v for k, v in sumber.items() if k not in _KOLOM_MISI}
    if jenis in ("klik", "gunting", "kembar"):
        tokens = tokenize(sumber["teks"])
        data["tokens"] = [t.json() for t in tokens]
    if jenis == "klik":
        kesalahan = sumber.get("kesalahan") or []
        if "jumlah" in sumber and sumber["jumlah"] != len(kesalahan):
            raise _Gagal(f"jumlah {sumber['jumlah']} ≠ {len(kesalahan)} kesalahan")
        kunci = []
        for k in kesalahan:
            pilihan = k["pilihan"] if "pilihan" in k else [k]
            kunci.append([_target(tokens, p) for p in pilihan])
        data.pop("kesalahan", None)
        data["kunci"] = kunci
        data["celah"] = bool(sumber.get("celah", False))
    elif jenis == "gunting":
        data["potong"] = [_spasi(tokens, p) for p in sumber.get("potong") or []]
        data["boleh"] = [_spasi(tokens, p) for p in sumber.get("boleh") or []]
        if not data["potong"]:
            raise _Gagal("gunting tanpa potong")
        data.pop("kesalahan", None)
    elif jenis == "kembar":
        ada = {t.teks.lower() for t in tokens if t.jenis == "kata"}
        kata = [k.lower() for k in sumber["kata"]]
        hilang = [k for k in kata if k not in ada]
        if hilang:
            raise _Gagal(f"kata kembar {hilang} tidak ada di teks")
        data["kata"] = kata
    return data


_KOLOM_MISI = {"urutan", "judul", "tahap", "jenis", "petunjuk", "lembar"}


def _cek_syarat(alat):
    syarat = alat.get("syarat", {})
    if set(syarat) != {"perunggu", "perak", "emas"}:
        raise _Gagal(f"alat {alat['kode']}: syarat harus perunggu, perak, emas")
    for tingkat, s in syarat.items():
        if s.get("jenis") not in JENIS_SYARAT:
            raise _Gagal(f"alat {alat['kode']} {tingkat}: jenis syarat {s.get('jenis')!r}")
    if alat["pola_cetak"] not in POLA_CETAK:
        raise _Gagal(f"alat {alat['kode']}: pola_cetak {alat['pola_cetak']!r}")


def _impor_musim(data):
    m = data["musim"]
    musim, _ = Musim.objects.update_or_create(
        nomor=m["nomor"],
        defaults={k: m.get(k, "") for k in ("nama", "genre", "deskripsi")},
    )
    for a in data.get("alat", []):
        _cek_syarat(a)
        Alat.objects.update_or_create(
            kode=a["kode"],
            defaults={
                **{k: a.get(k, "") for k in (
                    "nama", "emoji", "pertanyaan", "cara_pakai", "contoh_sebelum",
                    "contoh_sesudah", "warna", "pola_cetak",
                )},
                "urutan": a["urutan"],
                "modul_belajar": a["modul_belajar"],
                "syarat": a["syarat"],
                "syarat_teks": a.get("syarat_teks", {}),
                "musim": musim,
            },
        )
    for p in data.get("pangkat", []):
        if p["syarat"].get("jenis") not in JENIS_PANGKAT:
            raise _Gagal(f"pangkat {p['kode']}: jenis syarat {p['syarat'].get('jenis')!r}")
        Pangkat.objects.update_or_create(
            kode=p["kode"],
            defaults={
                "nama": p["nama"], "urutan": p["urutan"], "syarat": p["syarat"],
                "syarat_teks": p.get("syarat_teks", ""),
                "hak_istimewa": p.get("hak_istimewa", ""),
            },
        )


def _impor_modul(data, nama_file):
    alat = None
    if data.get("alat"):
        alat = Alat.objects.filter(kode=data["alat"]).first()
        if alat is None:
            raise _Gagal(f"{nama_file}: alat {data['alat']!r} tidak dikenal")
    modul, _ = Modul.objects.update_or_create(
        nomor=data["nomor"],
        defaults={
            "musim": Musim.objects.get(nomor=data["musim"]),
            "level": data["level"],
            "judul": data["judul"],
            "tujuan": data["tujuan"],
            "emoji": data.get("emoji", ""),
            "kenapa": data.get("kenapa", ""),
            "langkah": data.get("langkah", []),
            "resep": data.get("resep", []),
            "mengapa": data.get("mengapa", ""),
            "kamus": data.get("kamus", []),
            "alat": alat,
            "lapis": data.get("lapis", ""),
            "tahap_mentor": data.get("tahap_mentor", "tanpa"),
            "kartu_prompt": data.get("kartu_prompt", ""),
            "petunjuk_lihat": data.get("petunjuk_lihat", ""),
        },
    )
    for i, u in enumerate(data.get("ujian", []), start=1):
        SoalUjian.objects.update_or_create(
            modul=modul, urutan=i,
            defaults={"soal": u["soal"], "pilihan_a": u["a"], "pilihan_b": u["b"],
                      "jawaban": u["jawaban"], "alasan": u.get("alasan", "")},
        )
    SoalUjian.objects.filter(modul=modul, urutan__gt=len(data.get("ujian", []))).delete()
    if data.get("bertanya"):
        b = data["bertanya"]
        SoalBertanya.objects.update_or_create(
            modul=modul,
            defaults={"pilihan_a": b["a"], "pilihan_b": b["b"], "jawaban": b["jawaban"],
                      "bagian": b.get("bagian", []), "penjelasan": b.get("penjelasan", "")},
        )
    for lb in data.get("lembar", []):
        Lembar.objects.update_or_create(
            kode=lb["kode"],
            defaults={
                "modul": modul,
                **{k: lb.get(k, "") for k in (
                    "judul", "petunjuk", "soal", "pertanyaan_bantu", "kriteria",
                    "contoh_jawaban", "saran_stiker",
                )},
                "baris_tulis": lb.get("baris_tulis", 6),
                "cek_sendiri": lb.get("cek_sendiri", []),
            },
        )
    for m in data.get("misi", []):
        label = f"{nama_file} misi {m.get('urutan')}"
        try:
            isi = ubah_data_soal(m["jenis"], m)
        except (KunciTidakDitemukan, _Gagal, KeyError) as e:
            raise _Gagal(f"{label}: {e}") from e
        lembar = None
        if m.get("lembar"):
            lembar = Lembar.objects.filter(kode=m["lembar"]).first()
            if lembar is None:
                raise _Gagal(f"{label}: lembar {m['lembar']} tidak ada")
        if m["jenis"] == "cetak" and lembar is None:
            raise _Gagal(f"{label}: misi cetak tanpa lembar")
        Misi.objects.update_or_create(
            modul=modul, urutan=m["urutan"],
            defaults={"judul": m["judul"], "tahap": m["tahap"], "jenis": m["jenis"],
                      "petunjuk": m.get("petunjuk", ""), "data": isi, "lembar": lembar},
        )


def _impor_latihan(data):
    for k in data.get("kalimat", []):
        alat = Alat.objects.filter(kode=k["alat"]).first()
        if alat is None:
            raise _Gagal(f"latihan {k['kode']}: alat {k['alat']!r} tidak dikenal")
        try:
            isi = ubah_data_soal(k["jenis"], k)
        except (KunciTidakDitemukan, _Gagal, KeyError) as e:
            raise _Gagal(f"latihan {k['kode']}: {e}") from e
        isi.pop("kode", None)
        isi.pop("alat", None)
        KalimatLatihan.objects.update_or_create(
            kode=k["kode"], defaults={"alat": alat, "jenis": k["jenis"], "data": isi}
        )


def impor_folder(folder):
    folder = Path(folder)
    try:
        with transaction.atomic():
            _impor_musim(json.loads((folder / "musim.json").read_text()))
            for f in sorted(folder.glob("modul-*.json")):
                _impor_modul(json.loads(f.read_text()), f.name)
            latihan = folder / "latihan.json"
            if latihan.exists():
                _impor_latihan(json.loads(latihan.read_text()))
    except (_Gagal, KeyError, json.JSONDecodeError) as e:
        raise CommandError(str(e)) from e
