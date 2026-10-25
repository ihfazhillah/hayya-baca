# 077 · Tangga course nadzom: salim dulu, bantuan bertahap, sampai mandiri

Status: draf, menunggu persetujuan pemilik.
Sumber: audit pedagogi tiga agent atas Modul 0–15 (2026-10-25). Galat fakta dari audit sudah
diperbaiki dalam 14 commit `fix(nadzom)` pada hari yang sama. Spec ini hanya mengatur **struktur**.

## Masalah

Isi 'arudh course (076) sudah benar dan kuat. Yang bermasalah adalah urutan dan alat bantunya.

1. **Bentuk yang berubah datang sebelum bentuk utuh dikuasai.**
   - Bait #1 (M0 P3) dibangun dari rajaz Khandaq, yang 5 dari 6 taf'ilahnya berzihaf.
   - Al-Buhturi (M0 P1) sudah khabn tiga kali.
   - Khabn, khabl, qath', dan thayy sudah disebut namanya di M1–M2.
   - Kamil dan basith dibuka dengan bait mudhmar/makhbun yang ujungnya maqthu'.

   Ini bertentangan dengan keputusan 076 sendiri ("taf'ilah dikenalkan dulu dalam bentuk utuh").
   Inilah sebab keluhan pemilik: "masih awal, kok sudah lompat ke yang tidak lengkap".
2. **Menimbang dibimbing rapat, menyusun tidak.**
   - Bantuan naik turun: pola (M0) → kosong dengan laci (M2) → kosong tanpa laci (M3) → Bank Kata
     baru diajarkan (M4) → kembali ke cetakan.
   - Kamil melompat dari satu kotak cetakan langsung ke tiga bait bebas.
   - Laci tidak disaring dan isinya kebanyakan frasa matan, bukan kata tema.
3. **Tidak ada jalan ke mandiri.**
   - Bantuan Boss tidak menipis. Boss 2 bahkan sudah memilihkan kelima kata qafiyahnya.
   - Hasil Boss mengecil: 10 → 5 → 3 bait.
   - Tidak ada ujian dengan tema dan bahr pilihan sendiri.
   - Tidak ada muraja'ah lintas bahr.
   - Tidak ada jembatan ke kitab 'arudh.

## Model yang diikuti

- **Tashrif A. Hassan.** Jilid 1 hanya shahih. Jilid 2 kaidah sedikit demi sedikit. Jilid 3 yang sulit.
- **Tangga nahwu.** Jurumiyah/Nahwul Wadhih → Mutammimah → Qathrun Nada → Alfiyah, lalu santri lepas sendiri.
- **Bimbingan di awal.** Banyak alat bantu, tetapi bukan joki: pelajar tetap memilih dan menimbang sendiri.
  Bantuan dicabut satu per satu, dan setiap pencabutan disebut terang.

## Tingkatan

| Tingkat | Padanan | Isi | Lulus bila |
|---|---|---|---|
| 1 · Jilid 1 | Jurumiyah, A. Hassan jilid 1 | Rajaz **salim saja**: menimbang, telinga, jebakan 'ajam, laci, cetakan 1→2 kotak, mu'aradhah bait salim, Bait #1–#2, 5 bait muzdawij salim | 5 bait rajaz muzdawij, semua taf'ilah utuh, 0 patah |
| 2 · Jilid 2 | Mutammimah | Zihaf rajaz satu per sesi (Khandaq dan Alfiyah dibedah di sini), qafiyah satu di rajaz, Boss 1. Lalu satu bahr per modul (kamil, basith, thawil, wafir): dibuka salim, kemudian satu zihaf utamanya. Boss 2–3 dengan bantuan yang menipis. | Boss 3 dengan tema saja (rancangan ditulis sendiri); bisa menamai setiap perubahan |
| 3 · Jilid 3 | Qathrun Nada | Ramal majzu' dan mujtats (bukan lagi "bonus"), bentuk majzu' dan wajah ujung lain, darurah syi'riyyah, jenis dan 'uyub qafiyah, menebak bahr bait asing, **ujian akhir bebas** | Ujian akhir tanpa rancangan; menebak bahr 8 dari 10 bait acak |
| 4 · Mandiri | Alfiyah | Di luar aplikasi: halaman "Langkah berikutnya" berisi tangga kitab, sisa bahr, dan jadwal muraja'ah | — |

## Keputusan yang diusulkan

1. **Mode salim.** Tamrin di Jilid 1 diberi tanda `salim: true`.
   - Taf'ilah yang berubah tidak dicap patah. Ia diberi status "belum dipelajari", dengan saran "coba bentuk utuh".
   - Patokan jilid 1 baru lulus bila tidak ada taf'ilah yang patah atau berubah. (Pertanyaan 1.)
2. **Nomor modul tetap.** URL `/modul/N/P` dan kunci selesai `nadzom.selesai.v1` tidak berubah.
   - Urutan belajar diatur oleh `peta.json`, seperti Boss sekarang.
   - Isi boleh dipindah antar-pelajaran. Kunci selesai untuk pelajaran yang isinya pindah dianggap
     lama. Pemilik baru menyelesaikan Modul 0, jadi dampaknya kecil.
3. **Bait pola Jilid 1:**
   - Mu'aradhah M0 P3 memakai «كَرِّرْ دُرُوسَ الْعِلْمِ حَتَّى تَرْشُدَا / لَا تَيْأَسَنْ وَاصْبِرْ تَنَلْ مِنْهُ الْهُدَى». Semua taf'ilahnya utuh, dan diberi label "bait latihan".
   - Khandaq kembali ke M3 sebagai bahan bedah khabn.
4. **Cetakan pertama rajaz.** M0 P2 diganti cetakan rajaz salim. Kotaknya satu مُسْتَفْعِلُنْ dari laci. Cetakan ramal pindah ke Jilid 3.
5. **Laci sebelum menyusun bebas.**
   - Laci hasyw dan laci qafiyah (sekarang M4 P1 dan P3) dibuka sebelum Bait #2.
   - M4 tinggal teknik revisi (laci wazan).
6. **Laci disaring dan bertanda slot.**
   - Susun dan cetakan hanya menampilkan kata dari modul yang sudah dibuka dan dari bahr yang sedang dilatih.
   - `KataBank` mendapat `cocok?` (mis. "satu مُسْتَفْعِلُنْ", "ujung maqthu'", "pembuka مُتَفَا").
   - Setiap qafiyah yang dipakai tamrin punya 12–20 kata ujung.
7. **Setiap bahr baru dibuka salim.**
   - P1 memakai kunci yang benar-benar utuh dan satu bait yang hasywnya utuh.
   - Bentuk yang wajib (mis. 'arudh basith makhbunah, 'arudh thawil maqbudhah, dharb wafir maqthuf) diberi label "bentuk baku".
   - Zihaf baru masuk di P2.
8. **Tangga bantuan menyusun, dipakai di setiap bahr:**
   cetakan 1 kotak → cetakan 1 syathr → mu'aradhah (`pola` + `tangga`) → bait dengan laci → bait tanpa laci.
   - Anak tangga "ganti satu taf'ilah" ditambahkan.
   - Kata pengganti tidak diberikan persis. Pelajar mendapat 3 calon, satu di antaranya pincang.
9. **Bantuan Boss menipis.**

   | Boss | Bantuan |
   |---|---|
   | Boss 1 | Penuh (dipecah 3–4 pelajaran) |
   | Boss 2 | Rancangan diberikan, kata qafiyah dipilih sendiri (kamil **atau** basith) |
   | Boss 3 | Tema saja |
   | Ujian akhir | Tema, bahr, dan qafiyah dipilih sendiri; 4–7 bait |

   Setiap Boss menyebut "bantuan yang dicabut di sini". Setiap butir rancangan Boss mendapat 4–6 kata berharakat.
10. **Tashih i'rab.** Daftar periksa singkat sebelum menyalin ke Diwan. Mesin tidak memeriksa lughah.
11. **Muraja'ah** di awal setiap babak:
    - timbang ulang dua bait Diwan dari Boss sebelumnya;
    - satu set "bahr apa ini?" yang mencampur semua bahr yang sudah dipelajari.

    Ini memakai `tebakBahr` yang sudah ada.
12. **Langkah berikutnya** (halaman rujukan): Mizan adz-Dzahab atau al-Mukhtashar asy-Syafi → al-Kafi
    (at-Tabrizi) → ar-Ramizah al-Khazrajiyyah dengan syarah ad-Damamini. Ditambah daftar bahr yang belum
    dipelajari dan saran mu'aradhah rutin. (Pertanyaan 3.)

## Kasus tepi

- **Mode salim dan contoh klasik.** Syahid yang ditampilkan untuk didengar (amtsilah, dengar) boleh berzihaf, asal tidak dijadikan pola, tidak ditanyakan, dan tidak ditimbang dalam mode salim. Test isi memeriksa bahwa pola, taqthi', dan cetakan di Jilid 1 utuh semua.
- **Isyba' ha opsional.** Mesin memilih bacaan yang lurus. Di mode salim, bacaan yang membuat semua taf'ilah utuh harus dipilih lebih dulu. Ini perlu dicek di `timbangBait`.
- **Qath' di ujung bait salim.** Jilid 1 memakai qafiyah yang huruf sebelum rawiy-nya hidup (ـدَا، ـلِ setelah huruf hidup) supaya dharb tetap utuh. Qath' masuk di Jilid 2 bersama rawiy.
- **Kunci selesai lama.** Pelajaran yang isinya berubah total (M0 P2, M0 P3) diberi kunci baru, supaya tanda "selesai" lama tidak menipu.
- **Laci kosong.** Bila penyaringan membuat laci kosong untuk satu bahr, tampilkan pesan, bukan laci global.
- **Ujian akhir dengan bahr apa pun.** Checker sudah mendukung tujuh bahr. Pemeriksa qafiyah memakai pola `satu`.

## Di luar cakupan

- Bahr yang belum ada di mesin (khafif, mutaqarib, dan lainnya). Ini masuk Fase D, setelah Jilid 1–2 dipakai.
- Pemeriksaan lughah atau i'rab otomatis.

## Pertanyaan untuk pemilik

1. **Mode salim:** ketat (berubah = belum lulus) atau lunak (berubah boleh, hanya diberi catatan)? Usul: **ketat** di Jilid 1.
2. **Jilid 3:** materi baru (bentuk majzu', khafif dan mutaqarib, darurah, 'uyub qafiyah) dikerjakan sekarang, atau setelah Antum menyelesaikan Jilid 1–2? Usul: **setelahnya**, supaya isinya dibentuk oleh pengalaman Jilid 1–2.
3. **Tangga kitab:** ada kitab 'arudh yang Antum sudah punya atau ingin pakai (mis. Syafi al-'Alil)?
