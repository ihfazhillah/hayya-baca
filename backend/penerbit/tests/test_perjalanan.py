"""Perjalanan penuh lewat API: Modul 1 sampai buku pertama terbit (spec 074 §7).

Memakai isi course asli (16 modul). Setiap misi dikerjakan seperti di browser;
jawaban diambil dari database hanya untuk menirukan anak yang menjawab benar.
"""
from datetime import timedelta

from django.utils import timezone

from penerbit.impor import impor_folder
from penerbit.models import Misi, Modul, Naskah, PemeriksaanLembar

from .base import ISI_MUSIM_1, Keluarga, auth


class TestPerjalananPenuh(Keluarga):
    def setUp(self):
        super().setUp()
        impor_folder(ISI_MUSIM_1)

    # ---- anak mengerjakan misi --------------------------------------------

    def kerjakan(self, misi):
        url = f"/api/penerbit/misi/{misi.id}/"
        assert self.anak.get(url).status_code == 200, f"{misi} terkunci"
        d = misi.data
        if misi.jenis == "klik":
            for grup in d["kunci"]:
                t = grup[0]
                body = {"token": t["token"][0]} if t["token"] else {"celah": t["celah"]}
                r = self.anak.post(url + "klik/", body, format="json")
            assert r.data["selesai"] is True, misi
        elif misi.jenis == "gunting":
            r = self.anak.post(url + "periksa/", {"potong": [g[0] for g in d["potong"]]},
                               format="json")
            assert r.data["kurang"] == 0
        elif misi.jenis == "kembar":
            r = self.anak.post(url + "periksa/", {"kata": d["kata"][0]}, format="json")
            assert r.data["hasil"] == "benar"
        elif misi.jenis == "log":
            assert self.anak.post(url + "tandai/", {"log": "Aku memakai alat ini karena..."},
                                  format="json").status_code == 200
        elif misi.jenis == "tandai":
            assert self.anak.post(url + "tandai/").status_code == 200
        elif misi.jenis == "cetak":
            assert self.anak.post(url + "cetak/").status_code == 200
            p = PemeriksaanLembar.objects.get(profil=self.profil, misi=misi, status="menunggu")
            r = self.ortu.post(f"/api/penerbit/ortu/lembar/{p.id}/", {"status": "bagus"},
                               format="json")
            assert r.status_code == 200

    def kerjakan_modul(self, nomor):
        modul = Modul.objects.get(nomor=nomor)
        for u in self.anak.get(f"/api/penerbit/modul/{nomor}/").data["ujian"]:
            self.anak.post(f"/api/penerbit/ujian/{u['id']}/jawab/", {"pilihan": "a"},
                           format="json")
        if modul.tahap_mentor != "tanpa":
            bagian = ["Aku sedang di revisi.", "Aku bingung di kalimat kedua.",
                      "Tolong beri 2 pertanyaan, jangan tulis ulang.", "Setelah itu aku perbaiki."]
            r = self.anak.post("/api/penerbit/prompt/", {"modul": nomor, "bagian": bagian},
                               format="json")
            assert r.status_code == 201, r.data
            self.anak.patch(f"/api/penerbit/prompt/{r.data['id']}/",
                            {"refleksi_bantu": "ya"}, format="json")
        for misi in Misi.objects.filter(modul=modul).order_by("urutan"):
            self.kerjakan(misi)

    # ---- naskah ------------------------------------------------------------

    def simpan(self, nid, teks, waktu, lapis=""):
        r = self.anak.post(f"/api/penerbit/naskah/{nid}/simpan/", {
            "isi": {"ops": [{"insert": teks + "\n"}]}, "teks": teks, "sorotan": [],
            "waktu_klien": waktu, "lapis": lapis}, format="json")
        assert r.status_code == 200, r.data

    def test_dari_modul_1_sampai_terbit(self):
        # Level 1: lima alat.
        for n in range(1, 6):
            self.kerjakan_modul(n)
        beranda = self.anak.get("/api/penerbit/beranda/").data
        assert beranda["pangkat"] == "Penulis Magang"
        assert all(len(a["stiker"]) >= 1 for a in beranda["alat"])

        # Pemanasan keesokan harinya.
        self.profil.jadwal.update(jatuh_tempo=timezone.localdate())
        kartu = self.anak.get("/api/penerbit/latihan/").data["kartu"]
        assert len(kartu) == 3

        # Level 2: ide, peta, Draf Nol, laci.
        for n in range(6, 10):
            self.kerjakan_modul(n)
        self.anak.post("/api/penerbit/ide/", {"teks": "Sandal hilang di masjid",
                                               "sumur": "kenangan"}, format="json")
        r = self.anak.post("/api/penerbit/naskah/", {"judul": "Sandal Jepit yang Hilang",
                                                     "peta": {"siapa": "Fatih"}}, format="json")
        nid = r.data["id"]
        self.simpan(nid, "Fatih punya sandal hijau. Fatih sedih. Lalu dia mencari.", 1)
        r = self.anak.post(f"/api/penerbit/naskah/{nid}/versi/")
        assert r.data["jejak"]["kalimat_perasaan"] == 1
        Naskah.objects.filter(id=nid).update(laci_buka=timezone.now() - timedelta(minutes=1))
        assert self.anak.post(f"/api/penerbit/naskah/{nid}/buka-laci/").status_code == 200

        # Level 3: empat lapis revisi, masing-masing distempel.
        for n in range(10, 17):
            self.kerjakan_modul(n)
        teks = "Fatih punya sandal hijau."
        for i, lapis in enumerate(["peta", "kamera", "gunting", "kaca"], start=2):
            teks += f" Lapis {lapis}."
            self.simpan(nid, teks, i * 10, lapis)
            assert self.anak.post(f"/api/penerbit/naskah/{nid}/versi/", {"lapis": lapis},
                                  format="json").status_code == 201
            self.anak.post(f"/api/penerbit/naskah/{nid}/minta-stempel/", {"lapis": lapis},
                           format="json")
            r = self.ortu.post(f"/api/penerbit/ortu/naskah/{nid}/stempel/", {"lapis": lapis},
                               format="json")
            assert r.status_code == 201

        # Pembaca Pertama: kakak sebagai Editor Tamu.
        self.ortu.post(f"/api/penerbit/ortu/naskah/{nid}/bagikan/", {"username": "kakak"},
                       format="json")
        r = auth(self.kakak).post(f"/api/penerbit/ulasan/{nid}/", {
            "favorit": "Kakek", "membingungkan": "Sandal siapa?", "pertanyaan": "Kenapa hijau?"},
            format="json")
        assert r.status_code == 201
        assert self.ortu.post(f"/api/penerbit/ortu/naskah/{nid}/stempel/", {"lapis": "pembaca"},
                              format="json").status_code == 201

        # Terbit!
        r = self.ortu.post(f"/api/penerbit/ortu/naskah/{nid}/terbitkan/",
                           {"tentang_penulis": "Fatih kelas 4."})
        assert r.data["nomor_terbitan"] == "PR-001"
        rak = self.anak.get("/api/penerbit/rak/").data
        assert [b["nomor_terbitan"] for b in rak["buku"]] == ["PR-001"]
        beranda = self.anak.get("/api/penerbit/beranda/").data
        assert beranda["pangkat"] == "Penulis"
        assert all(m["status"] == "selesai" for m in beranda["peta"])
        assert beranda["poin"] > 50
        dasbor = self.ortu.get("/api/penerbit/ortu/dasbor/").data
        assert dasbor["perlu_tindakan"] == {"lembar": 0, "stempel": 0, "penukaran": 0}
