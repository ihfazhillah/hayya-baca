"""Impor isi course dari JSON (format: course/schema.md)."""
import json
from collections import Counter
from pathlib import Path

from django.core.management import CommandError
from django.db import transaction

from .models import (
    Alat, KalimatLatihan, Lembar, Misi, Modul, Musim, Pangkat, SoalBertanya, SoalUjian,
)
from .kata_umum import KATA_UMUM
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
    if jenis == "perasaan":
        return _perasaan(data)
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
        for k, grup in zip(kesalahan, kunci):
            if not any(_bisa_diklik(tokens, t, data["celah"]) for t in grup):
                raise _Gagal(f"kesalahan {k.get('cari') or k.get('pilihan')!r} tidak bisa diklik"
                             " (tambahkan \"celah\": true)")
        if data.get("bantuan_memudar"):
            if not all(k.get("alasan") for k in kesalahan):
                raise _Gagal("bantuan_memudar: setiap kesalahan butuh \"alasan\"")
            data["bantuan_memudar"] = True
        # Alasan per kesalahan (sejajar dengan kunci): rahasia, dikirim lewat bantuan saja.
        if any(k.get("alasan") for k in kesalahan):
            data["alasan"] = [k.get("alasan", "") for k in kesalahan]
    elif data.get("bantuan_memudar") and jenis not in ("gunting", "kembar"):
        raise _Gagal("bantuan_memudar belum tersedia untuk jenis ini")
    if jenis in ("klik", "gunting", "kembar") and "contoh" in sumber:
        data["contoh"] = _contoh(tokens, sumber["contoh"])
    if jenis == "gunting":
        data["potong"] = [_spasi(tokens, p) for p in sumber.get("potong") or []]
        data["boleh"] = [_spasi(tokens, p) for p in sumber.get("boleh") or []]
        if not data["potong"]:
            raise _Gagal("gunting tanpa potong")
        # Alasan per potongan (sejajar dengan potong): rahasia, hanya yang pertama dikirim lewat
        # bantuan memudar.
        if any(p.get("alasan") for p in sumber["potong"]):
            data["alasan"] = [p.get("alasan", "") for p in sumber["potong"]]
        if data.get("bantuan_memudar"):
            if not sumber["potong"][0].get("alasan"):
                raise _Gagal("bantuan_memudar: potong pertama butuh \"alasan\"")
            data["bantuan_memudar"] = True
        data.pop("kesalahan", None)
    elif jenis == "kembar":
        ada = {t.teks.lower() for t in tokens if t.jenis == "kata"}
        kata = [k.lower() for k in sumber["kata"]]
        hilang = [k for k in kata if k not in ada]
        if hilang:
            raise _Gagal(f"kata kembar {hilang} tidak ada di teks")
        hitung = Counter(t.teks.lower() for t in tokens
                         if t.jenis == "kata" and t.teks.lower() not in KATA_UMUM)
        if hitung:
            paling = max(hitung.values())
            terbanyak = sorted(w for w, n in hitung.items() if n == paling)
            kurang = [w for w in terbanyak if w not in kata]
            if kurang:
                raise _Gagal(f"kata terbanyak {kurang} ({paling} kali) harus ada di \"kata\"")
        data["kata"] = kata
        if data.get("bantuan_memudar"):
            # Tahap bersama: kata kembar ditunjukkan dengan alasan; tahap lain: hitungannya saja.
            if sumber.get("tahap") == "bersama" and not sumber.get("alasan"):
                raise _Gagal("bantuan_memudar tahap bersama butuh \"alasan\"")
            data["bantuan_memudar"] = True
    return data


def _contoh(tokens, langkah):
    """Contoh dari Oren: [{"sorot": [{"cari": ..}], "pikir": ".."}] → sorot jadi indeks token."""
    if not isinstance(langkah, list) or not langkah:
        raise _Gagal("contoh harus daftar langkah")
    out = []
    for n, x in enumerate(langkah, start=1):
        if not x.get("pikir"):
            raise _Gagal(f"contoh langkah {n}: tanpa \"pikir\"")
        sorot = []
        for s in x.get("sorot") or []:
            try:
                temuan = cari(tokens, s["cari"], s.get("ke", 1))
            except KunciTidakDitemukan as e:
                raise _Gagal(f"contoh langkah {n}: sorot {e}") from e
            ambil = temuan.token
            if s.get("spasi"):  # Gunting: sorot celah tempat memotong saja
                ambil = [i for i in ambil if tokens[i].jenis == "spasi"]
                if not ambil:
                    raise _Gagal(f"contoh langkah {n}: sorot {s['cari']!r} tanpa spasi")
            sorot += [i for i in ambil if i not in sorot]
        out.append({"sorot": sorted(sorot), "pikir": x["pikir"]})
    return out


def _perasaan(data):
    """Kamera: pilih perasaan + klik bukti (spec 075 K1). Tiap soal → token, pilihan, jawaban,
    bukti (indeks token kata per bukti), alasan. Dengan `contoh`, soal pertama milik Oren."""
    soal = data.get("soal")
    if not isinstance(soal, list) or not soal:
        raise _Gagal("perasaan tanpa soal")
    out = []
    for n, s in enumerate(soal, start=1):
        label = f"soal {n}"
        tokens = tokenize(s["teks"])
        pilihan = list(s.get("pilihan") or [])
        if len(pilihan) < 2 or len(set(pilihan)) != len(pilihan):
            raise _Gagal(f"{label}: pilihan minimal 2 dan tidak boleh kembar")
        if s.get("jawaban") not in pilihan:
            raise _Gagal(f"{label}: jawaban {s.get('jawaban')!r} tidak ada di pilihan")
        if not s.get("bukti"):
            raise _Gagal(f"{label}: tanpa bukti")
        bukti = []
        for b in s["bukti"]:
            try:
                temuan = cari(tokens, b["cari"], b.get("ke", 1))
            except KunciTidakDitemukan as e:
                raise _Gagal(f"{label}: bukti {e}") from e
            kata_ = [i for i in temuan.token if tokens[i].jenis == "kata"]
            if not kata_:
                raise _Gagal(f"{label}: bukti {b['cari']!r} tanpa kata untuk diklik")
            if any(i in g for g in bukti for i in kata_):
                raise _Gagal(f"{label}: bukti {b['cari']!r} tumpang tindih")
            bukti.append(kata_)
        if data.get("bantuan_memudar") and not s.get("alasan"):
            raise _Gagal(f"{label}: bantuan_memudar butuh \"alasan\"")
        out.append({"tokens": [t.json() for t in tokens], "pilihan": pilihan,
                    "jawaban": s["jawaban"], "bukti": bukti, "alasan": s.get("alasan", "")})
    data["soal"] = out
    if data.get("bantuan_memudar"):
        data["bantuan_memudar"] = True
    if "contoh" in data:
        if len(out) < 2:
            raise _Gagal("contoh memakai soal pertama: butuh soal lain untuk anak")
        tokens = tokenize(soal[0]["teks"])
        langkah = _contoh(tokens, data["contoh"])
        for x, sumber in zip(langkah, data["contoh"]):
            x["pilih"] = sumber.get("pilih")
            if x["pilih"] is not None and x["pilih"] != out[0]["jawaban"]:
                raise _Gagal(f"contoh: Oren memilih {x['pilih']!r}, jawaban soal 1"
                             f" {out[0]['jawaban']!r}")
        data["contoh"] = langkah
    return data


def _bisa_diklik(tokens, target, mode_celah):
    """Sama dengan aturan tampilan TeksKlik: tanpa mode celah hanya kata yang bisa diklik;
    dengan mode celah, spasi/tanda juga, dan celah hanya di antara dua token bukan spasi atau
    di akhir teks."""
    if any(tokens[i].jenis == "kata" for i in target["token"]):
        return True
    if not mode_celah:
        return False
    if target["token"]:
        return True
    c = target["celah"]
    return c == len(tokens) or (
        0 < c < len(tokens) and tokens[c].jenis != "spasi" and tokens[c - 1].jenis != "spasi")


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
        if "rekam" in m:
            punya_versi = {x["urutan"] for x in data["misi"] if x.get("versi_benar")}
            kurang = [u for u in m["rekam"].get("dari_misi", []) if u not in punya_versi]
            if kurang or not m["rekam"].get("dari_misi"):
                raise _Gagal(f"{label}: rekam dari misi {kurang} yang tidak punya versi_benar")
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
