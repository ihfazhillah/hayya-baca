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


def kalimat_petunjuk(data, ditemukan):
    """Rentang token [awal, akhir] kalimat yang masih berisi kesalahan belum ditemukan."""
    tokens = [Token(t["i"], t["t"], t["j"], 0, 0) for t in data["tokens"]]
    rentang = kalimat(tokens)
    hasil = []
    for gi, grup in enumerate(data["kunci"]):
        if gi in ditemukan:
            continue
        t = grup[0]
        posisi = t["token"][0] if t["token"] else min(t["celah"], len(tokens) - 1)
        for awal, akhir in rentang:
            # Celah tepat setelah titik akhir kalimat ikut kalimat sebelumnya.
            if awal <= posisi <= akhir or (t["celah"] is not None and posisi == akhir + 1):
                if [awal, akhir] not in hasil:
                    hasil.append([awal, akhir])
                break
    return sorted(hasil)


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
    rahasia = {"kunci", "versi_benar", "potong", "boleh", "kata", "pengganti", "kesalahan",
               "teks"}
    out = {k: v for k, v in data.items() if k not in rahasia}
    if jenis == "klik":
        out["jumlah"] = len(data["kunci"])
    return out


def jawaban(data, jenis):
    """Data yang dibuka setelah misi selesai."""
    out = {"versi_benar": data.get("versi_benar", "")}
    if jenis == "klik":
        out["kunci"] = data["kunci"]
    elif jenis == "gunting":
        out["potong"] = data["potong"]
    elif jenis == "kembar":
        out["kata"] = data["kata"]
        out["pengganti"] = data.get("pengganti", [])
    return out
