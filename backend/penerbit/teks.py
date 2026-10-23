"""Satu-satunya tokenizer Penerbit Rumah (plan 074 keputusan 1).

Browser tidak memecah teks sendiri: server mengirim daftar token, browser hanya
menampilkan dan mengirim balik indeks token atau indeks celah yang diklik.

Celah ke-i adalah batas tepat sebelum token i (0..len). Celah dipakai untuk
kesalahan "spasi hilang" dan "titik hilang di akhir".
"""
import re
from dataclasses import dataclass

_POLA = re.compile(r"(?P<kata>\w+(?:[-'’]\w+)*)|(?P<spasi>\s+)|(?P<tanda>.)", re.UNICODE)
AKHIR_KALIMAT = {".", "?", "!"}


@dataclass(frozen=True)
class Token:
    i: int
    teks: str
    jenis: str  # kata | spasi | tanda
    awal: int  # posisi karakter di teks asli
    akhir: int

    def json(self):
        return {"i": self.i, "t": self.teks, "j": self.jenis}


def tokenize(teks):
    out = []
    for m in _POLA.finditer(teks):
        out.append(Token(len(out), m.group(), m.lastgroup, m.start(), m.end()))
    return out


def kata(tokens):
    return [t for t in tokens if t.jenis == "kata"]


class KunciTidakDitemukan(ValueError):
    pass


@dataclass
class Temuan:
    token: list  # indeks token yang tercakup
    celah: int | None  # indeks celah bila pola memakai "|"


def cari(tokens, pola, ke=1):
    """Cari kemunculan ke-`ke` dari `pola` yang sejajar dengan batas token.

    `pola` boleh berisi satu "|" sebagai penanda celah: ".|cacing" = celah di
    antara "." dan "cacing"; "jahat|" = celah setelah "jahat".
    """
    celah_di = pola.find("|")
    teks_pola = pola.replace("|", "")
    teks = "".join(t.teks for t in tokens)
    awal_token = {t.awal: t.i for t in tokens}
    akhir_token = {t.akhir: t.i for t in tokens}
    awal_token[len(teks)] = len(tokens)  # untuk celah di akhir teks

    n = 0
    mulai = 0
    while True:
        pos = teks.find(teks_pola, mulai)
        if pos < 0:
            break
        mulai = pos + 1
        akhir = pos + len(teks_pola)
        if pos not in awal_token or (akhir not in akhir_token and akhir != len(teks)):
            continue
        if teks_pola and akhir not in akhir_token:
            continue
        n += 1
        if n != ke:
            continue
        i_awal = awal_token[pos]
        i_akhir = akhir_token[akhir] if teks_pola else i_awal - 1
        celah = None
        if celah_di >= 0:
            posisi_celah = pos + celah_di
            if posisi_celah not in awal_token:
                raise KunciTidakDitemukan(f"Celah pada pola {pola!r} tidak di batas token")
            celah = awal_token[posisi_celah]
        return Temuan(list(range(i_awal, i_akhir + 1)), celah)
    raise KunciTidakDitemukan(f"{pola!r} (kemunculan ke-{ke}) tidak ada di teks")


def kalimat(tokens):
    """Rentang [awal, akhir] indeks token per kalimat (tanpa spasi pembuka)."""
    rentang = []
    awal = None
    for t in tokens:
        if awal is None:
            if t.jenis == "spasi":
                continue
            awal = t.i
        if t.jenis == "tanda" and t.teks in AKHIR_KALIMAT:
            rentang.append((awal, t.i))
            awal = None
    if awal is not None:
        akhir = len(tokens) - 1
        while akhir > awal and tokens[akhir].jenis == "spasi":
            akhir -= 1
        rentang.append((awal, akhir))
    return rentang


def kalimat_teks(teks):
    tokens = tokenize(teks)
    return ["".join(t.teks for t in tokens[a:b + 1]) for a, b in kalimat(tokens)]
