"""Penilaian misi dan latihan (plan 074 keputusan 2).

Fungsi di sini murni: menerima data soal (hasil impor) dan keadaan percobaan,
mengembalikan hasilnya. View yang menyimpan ke database.
"""
from .teks import kalimat, Token

BATAS_MELESET_PETUNJUK = 3


def _cocok(target, token, celah):
    if token is not None and token in target["token"]:
        return True
    return celah is not None and celah == target["celah"]


def nilai_klik(data, ditemukan, token=None, celah=None):
    """Satu klik. Kembalikan ("ketemu", indeks_grup) | ("sudah", indeks_grup) | ("meleset", None)."""
    kunci = data["kunci"]
    for gi, grup in enumerate(kunci):
        if gi in ditemukan:
            continue
        if any(_cocok(t, token, celah) for t in grup):
            return "ketemu", gi
    for gi in ditemukan:
        if any(_cocok(t, token, celah) for t in kunci[gi]):
            return "sudah", gi
    return "meleset", None


def _kalimat_grup(tokens, rentang, grup):
    """Rentang [awal, akhir] kalimat tempat satu grup kunci berada."""
    t = grup[0]
    posisi = t["token"][0] if t["token"] else min(t["celah"], len(tokens) - 1)
    for awal, akhir in rentang:
        # Celah tepat setelah titik akhir kalimat ikut kalimat sebelumnya.
        if awal <= posisi <= akhir or (t["celah"] is not None and posisi == akhir + 1):
            return [awal, akhir]
    return None


def _tokens(data):
    return [Token(t["i"], t["t"], t["j"], 0, 0) for t in data["tokens"]]


def kalimat_petunjuk(data, ditemukan):
    """Rentang token [awal, akhir] kalimat yang masih berisi kesalahan belum ditemukan."""
    tokens = _tokens(data)
    rentang = kalimat(tokens)
    hasil = []
    for gi, grup in enumerate(data["kunci"]):
        if gi in ditemukan:
            continue
        r = _kalimat_grup(tokens, rentang, grup)
        if r is not None and r not in hasil:
            hasil.append(r)
    return sorted(hasil)


def bantuan(data, ditemukan):
    """Bantuan memudar (spec 075 K1) untuk kesalahan pertama yang belum ditemukan.

    Belum ada yang ditemukan → "tunjuk" (letak token + alasan); satu ditemukan → "letak"
    (kalimatnya saja); dua atau lebih → None (anak mencari sendiri). Hanya kesalahan yang
    sedang dibantu yang dikirim, kunci lainnya tetap di server.
    """
    sisa = [gi for gi in range(len(data["kunci"])) if gi not in ditemukan]
    if not sisa or len(ditemukan) >= 2:
        return None
    grup = data["kunci"][sisa[0]]
    if not ditemukan:
        t = grup[0]
        return {"tingkat": "tunjuk", "token": t["token"], "celah": t["celah"],
                "alasan": data.get("alasan", [""] * len(data["kunci"]))[sisa[0]]}
    tokens = _tokens(data)
    return {"tingkat": "letak", "kalimat": _kalimat_grup(tokens, kalimat(tokens), grup)}


LEBAR_BAGIAN = 3  # kata di kiri dan kanan potongan yang dibantu "letak"-nya


def _bagian(tokens, grup):
    """Rentang [awal, akhir] beberapa kata di sekitar satu grup spasi potongan Gunting.
    Teks Gunting biasanya satu kalimat panjang, jadi "letak" = bagian kalimat, bukan kalimat."""
    awal, akhir = min(grup), max(grup)
    n = 0
    while awal > 0 and n < LEBAR_BAGIAN:
        awal -= 1
        n += tokens[awal].jenis == "kata"
    n = 0
    while akhir < len(tokens) - 1 and n < LEBAR_BAGIAN:
        akhir += 1
        n += tokens[akhir].jenis == "kata"
    return [awal, akhir]


def bantuan_gunting(data, potong):
    """Bantuan memudar Gunting (spec 075 Fase B), dihitung dari garis potong anak saat ini.

    Potongan pertama (urutan `potong`) belum kena → "tunjuk" (spasinya + alasan); sudah kena →
    "letak" potongan kedua (bagian kalimatnya saja); keduanya kena → None. Hanya dua potongan
    pertama yang pernah diperiksa di sini, jadi potongan lain tidak bisa ditebak lewat bantuan.
    """
    wajib = data["potong"]
    potong = set(potong)
    kena = [bool(potong & set(g)) for g in wajib[:2]]
    if not kena[0]:
        return {"tingkat": "tunjuk", "token": wajib[0], "celah": None,
                "alasan": (data.get("alasan") or [""])[0]}
    if len(kena) > 1 and not kena[1]:
        return {"tingkat": "letak", "kalimat": _bagian(_tokens(data), wajib[1])}
    return None


def bantuan_kembar(data, tahap):
    """Bantuan Detektor Kembar (satu sasaran, jadi memudar antarmisi): tahap `bersama` →
    semua kemunculan kata kembar pertama + alasan; tahap lain → hitungannya saja."""
    kata0 = data["kata"][0]
    letak = [t["i"] for t in data["tokens"] if t["j"] == "kata" and t["t"].lower() == kata0]
    if tahap == "bersama":
        return {"tingkat": "tunjuk", "token": letak, "celah": None,
                "alasan": data.get("alasan", "")}
    return {"tingkat": "hitung", "jumlah": len(letak)}


def nilai_gunting(data, potong):
    """Potongan anak (indeks spasi) → tepat, tidak perlu, dan jumlah yang kurang."""
    potong = sorted(set(potong))
    wajib = data["potong"]
    boleh = data.get("boleh", [])
    tepat, tidak_perlu = [], []
    grup_kena = set()
    for p in potong:
        g = next((gi for gi, grup in enumerate(wajib) if p in grup), None)
        if g is not None:
            grup_kena.add(g)
            tepat.append(p)
        elif any(p in grup for grup in boleh):
            tepat.append(p)
        else:
            tidak_perlu.append(p)
    return {
        "tepat": tepat,
        "tidak_perlu": tidak_perlu,
        "kurang": len(wajib) - len(grup_kena),
        "benar": len(grup_kena),
        "total": len(wajib),
        # Skor yang disimpan untuk syarat stiker: potongan yang tidak perlu mengurangi,
        # supaya memotong di semua spasi tidak dihitung sempurna.
        "skor": max(0, len(grup_kena) - len(tidak_perlu)),
    }


def nilai_kembar(data, kata):
    return (kata or "").strip().lower() in data["kata"]


def data_publik(data, jenis):
    """Data soal yang aman dikirim ke browser sebelum misi selesai."""
    if jenis == "perasaan":
        return perasaan_publik(data)
    rahasia = {"kunci", "versi_benar", "potong", "boleh", "kata", "pengganti", "kesalahan",
               "teks", "alasan"}
    out = {k: v for k, v in data.items() if k not in rahasia}
    if jenis == "klik":
        out["jumlah"] = len(data["kunci"])
    return out


def jawaban(data, jenis):
    """Data yang dibuka setelah misi selesai."""
    out = {"versi_benar": data.get("versi_benar", "")}
    if jenis == "perasaan":
        out["soal_jawaban"] = [kunci_perasaan(s) for s in data["soal"]]
    if jenis == "klik":
        out["kunci"] = data["kunci"]
    elif jenis == "gunting":
        out["potong"] = data["potong"]
    elif jenis == "kembar":
        out["kata"] = data["kata"]
        out["pengganti"] = data.get("pengganti", [])
    return out


# ---- Kamera: pilih perasaan + klik bukti (spec 075 K1, Fase B) ------------------
#
# Keadaan per soal disimpan di Percobaan.butir["<i>"]:
#   {"perasaan": pilihan yang benar | None, "salah": n, "ditemukan": [grup], "diklik": [token]}
# Dengan `contoh`, soal 0 milik Oren: dikirim lengkap dan tidak dinilai.

def soal_awal(data):
    """Indeks soal pertama yang dikerjakan anak."""
    return 1 if data.get("contoh") else 0


def kunci_perasaan(s):
    return {"jawaban": s["jawaban"], "bukti": s["bukti"], "alasan": s.get("alasan", "")}


def perasaan_publik(data):
    rahasia = {"soal", "alasan", "kunci"}
    out = {k: v for k, v in data.items() if k not in rahasia}
    awal = soal_awal(data)
    out["soal"] = []
    for i, s in enumerate(data["soal"]):
        x = {"tokens": s["tokens"], "pilihan": s["pilihan"], "jumlah_bukti": len(s["bukti"])}
        if i < awal:
            x.update(kunci_perasaan(s), contoh=True)
        out["soal"].append(x)
    return out


def butir_kosong():
    return {"perasaan": None, "salah": 0, "ditemukan": [], "diklik": []}


def soal_sekarang(data, butir):
    """Soal pertama yang belum selesai, atau None bila semuanya selesai."""
    for i in range(soal_awal(data), len(data["soal"])):
        b = butir.get(str(i))
        if not b or len(b["ditemukan"]) < len(data["soal"][i]["bukti"]):
            return i
    return None


def nilai_perasaan(s, b, perasaan):
    """Pilih perasaan untuk satu soal. Mengubah `b`. Kembalikan "benar" | "sudah" | "belum"."""
    if b["perasaan"] is not None:
        return "sudah"
    if perasaan == s["jawaban"]:
        b["perasaan"] = perasaan
        return "benar"
    b["salah"] += 1
    return "belum"


def nilai_bukti(s, b, token):
    """Klik satu kata bukti. Mengubah `b`. Kembalikan "ketemu" | "sudah" | "meleset"."""
    for gi, grup in enumerate(s["bukti"]):
        if token in grup:
            if gi in b["ditemukan"]:
                return "sudah"
            b["ditemukan"].append(gi)
            b["diklik"].append(token)
            return "ketemu"
    return "meleset"


def bantuan_perasaan(data, butir):
    """Bantuan memudar per soal anak: soal ke-1 → bukti ditunjukkan (perasaannya tetap ditebak
    sendiri), ke-2 → kalimat bukti yang belum ditemukan, sesudahnya → None."""
    i = soal_sekarang(data, butir)
    if i is None:
        return None
    ke = i - soal_awal(data)
    s = data["soal"][i]
    if ke == 0:
        return {"tingkat": "tunjuk", "soal": i, "token": sorted(t for g in s["bukti"] for t in g)}
    if ke == 1:
        b = butir.get(str(i)) or butir_kosong()
        grup = next(g for gi, g in enumerate(s["bukti"]) if gi not in b["ditemukan"])
        tokens = _tokens({"tokens": s["tokens"]})
        rentang = next(([a, z] for a, z in kalimat(tokens) if a <= grup[0] <= z), None)
        return {"tingkat": "letak", "soal": i, "kalimat": rentang}
    return None


def hasil_perasaan(data, butir):
    """(benar, total) untuk HasilMisi: benar = soal yang perasaannya tepat pada pilihan pertama."""
    soal = range(soal_awal(data), len(data["soal"]))
    benar = sum(1 for i in soal if butir.get(str(i), {}).get("salah", 0) == 0)
    return benar, len(soal)
