"""Tokenizer tunggal (plan 074 keputusan 1) dan penunjuk kunci jawaban."""
import pytest

from penerbit.teks import KunciTidakDitemukan, cari, kalimat, tokenize


def jenis(teks):
    return [(t.teks, t.jenis) for t in tokenize(teks)]


def test_kata_tanda_spasi():
    assert jenis("Dia main, tapi.") == [
        ("Dia", "kata"), (" ", "spasi"), ("main", "kata"), (",", "tanda"),
        (" ", "spasi"), ("tapi", "kata"), (".", "tanda"),
    ]


def test_kata_ulang_dan_apostrof_satu_token():
    assert [t.teks for t in tokenize("buru-buru Assalamu'alaikum") if t.jenis == "kata"] == [
        "buru-buru", "Assalamu'alaikum",
    ]


def test_spasi_ganda_satu_token():
    assert jenis("a  b") == [("a", "kata"), ("  ", "spasi"), ("b", "kata")]


def test_cari_menghormati_batas_token():
    # "di" tidak boleh cocok dengan bagian dari "dia".
    t = tokenize("dia duduk di di dekat")
    hasil = cari(t, "di di")
    assert hasil.token == [4, 5, 6]
    assert hasil.celah is None


def test_cari_kemunculan_ke_n():
    t = tokenize("nanti kamu basah, sakit nanti.")
    assert cari(t, "nanti", ke=2).token == [9]


def test_cari_celah_dengan_garis_tegak():
    # Spasi hilang setelah titik: "keluar.cacing" → celah di antara "." dan "cacing".
    t = tokenize("keluar.cacing itu")
    hasil = cari(t, ".|cacing")
    assert hasil.celah == 2
    assert hasil.token == [1, 2]


def test_cari_celah_di_akhir_teks():
    t = tokenize("cacing itu jahat")
    assert cari(t, "jahat|").celah == len(t)


def test_cari_tidak_ditemukan():
    with pytest.raises(KunciTidakDitemukan):
        cari(tokenize("Oren tidur."), "Oren makan")


def test_kalimat_dipisah_di_titik_tanya_seru():
    t = tokenize("Oren kaget. Lalu dia lari! Kenapa?")
    rentang = kalimat(t)
    assert len(rentang) == 3
    awal, akhir = rentang[1]
    assert "".join(x.teks for x in t[awal:akhir + 1]).strip() == "Lalu dia lari!"
