"""Lima angka Jejak Keterampilan (Rancangan Situs §Jejak Keterampilan otomatis).

Contoh dari Roadmap (Draf Nol "Sandal Jepit yang Hilang"). Angka di tabel contoh Roadmap
(170 / 24 / lalu 4) tidak dihitung dari teks ini; test memakai hasil hitungan teksnya.
"""
from penerbit.jejak import hitung, sorotan_sistem

SANDAL = (
    "Fatih punya sandal jepit hijau. Sandal itu sandal kesayangan Fatih karena dibeliin Babah "
    "waktu ke pasar. Hari itu Fatih sholat ashar di masjid dan dia buru buru karena mau nonton "
    "lomba di tv dan lombanya mulai jam 4. Setelah sholat Fatih langsung lari ke rak sandal. "
    "Tapi sandalnya tidak ada. Fatih sedih. Fatih mencari sandal di rak atas, di rak bawah, di "
    "bawah tangga. Tetap tidak ada. Fatih kesal. Lalu Fatih melihat kakek Darto jalan pelan "
    "pelan. Lalu Fatih melihat kaki kakek Darto. Ternyata kakek Darto pakai sandal hijau Fatih! "
    "[???] kakek Darto minta maaf karena matanya sudah tidak jelas. Lalu kakek Darto mengajak "
    "Fatih ke rumahnya makan pisang goreng. Fatih senang. Fatih lupa sama lomba di tv."
)


def test_sandal_jepit():
    j = hitung(SANDAL)
    assert j["jumlah_kata"] == 117
    assert j["kalimat_terpanjang"] == 22
    assert (j["kata_kembar"], j["kata_kembar_jumlah"]) == ("fatih", 13)
    assert j["kalimat_perasaan"] == 3  # sedih, kesal, senang


def test_kata_umum_tidak_dihitung_kembar():
    j = hitung("Dia dan aku dan dia. Dia dan aku makan.")
    assert j["kata_kembar"] == "makan"


def test_deteksi_ejaan_sebagian():
    teks = "ibu pergi kepasar . Oren tidur dirumah.Lalu dia bangun"
    # huruf kecil di awal, "kepasar", spasi sebelum titik, "dirumah", spasi hilang setelah titik
    assert hitung(teks)["kesalahan_ejaan"] == 5


def test_teks_kosong():
    j = hitung("")
    assert j["jumlah_kata"] == 0 and j["kalimat_terpanjang"] == 0


def test_sorotan_sistem_lapis_kalimat():
    teks = "Lalu Oren lari. Lalu dia makan. Lalu dia tidur. Lalu dia bangun. " + " ".join(
        ["kata"] * 21) + "."
    sorotan = sorotan_sistem(teks, ["kembar", "gunting"])
    kembar = [s for s in sorotan if s["alat"] == "kembar"]
    assert len(kembar) == 4 + 21  # "lalu" 4 kali dan "kata" 21 kali (> 3)
    assert all(s["sumber"] == "sistem" and not s["diperbaiki"] for s in sorotan)
    assert teks[kembar[0]["index"]:kembar[0]["index"] + kembar[0]["length"]] == "Lalu"
    panjang = [s for s in sorotan if s["alat"] == "gunting"]
    assert len(panjang) == 1
    assert teks[panjang[0]["index"]:].startswith("kata kata")


def test_nama_tokoh_tidak_dihitung_kembar():
    j = hitung(SANDAL, tokoh={"fatih", "darto"})
    assert j["kata_kembar"] not in {"fatih", "darto"}
    assert (j["kata_kembar"], j["kata_kembar_jumlah"]) == ("sandal", 6)
    assert j["jumlah_kata"] == 117  # angka lain tidak berubah


def test_sorotan_sistem_melewati_nama_tokoh():
    teks = "Fatih lari. Fatih makan. Fatih tidur. Fatih bangun. Lalu lalu lalu lalu."
    kembar = sorotan_sistem(teks, ["kembar"], tokoh={"fatih"})
    assert [teks[s["index"]:s["index"] + s["length"]].lower() for s in kembar] == ["lalu"] * 4


def test_nama_otomatis_dari_kotak_siapa():
    from penerbit.tokoh import otomatis

    assert otomatis({"siapa": "Fatih dan Kakek Darto, anak kelas 4"}) == ["Fatih", "Kakek", "Darto"]
    # "Dia" kata umum walau berhuruf besar; isian kosong atau hilang = tidak ada nama
    assert otomatis({"siapa": "Dia anak yang suka sandal"}) == []
    assert otomatis({"siapa": ""}) == [] and otomatis({}) == [] and otomatis(None) == []
