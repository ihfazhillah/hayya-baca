# 076 · Plan fase 1

Cakupan: situs statis + checker v1 (rajaz, ramal) + Modul 0 lengkap (3 pelajaran) + rujukan +
deploy ke `nadzom.ihfazh.com`. Modul 1–10 menyusul, satu per satu, sebagai data JSON.

## Stack

Sama dengan web app lain di repo (tahsin-web, penerbit-web), tanpa backend:
Vite + React 19 + react-router 7 + TypeScript strict + vitest. CSS biasa dengan token (tanpa
Tailwind) supaya palet dan jarak terkendali di satu tempat. Font: Amiri (Arab), Marcellus (judul),
Figtree (teks).

```
nadzom-web/
  src/lib/
    huruf.ts        normalisasi teks Arab: huruf + harakat per huruf
    kitabah.ts      kitabah 'arudhiyyah (teks berharakat → daftar huruf ber-bit)
    latin.ts        suku kata Latin → bit
    bahr.ts         definisi bahr: slot taf'ilah + bentuk yang dikenal (utuh / zihaf / 'illah)
    timbang.ts      cocokkan bit ke bahr (DP), status per taf'ilah, letak salah
    diwan.ts        format Markdown untuk tombol Salin
  src/content/
    modul-00.json   3 pelajaran (الأمثلة, البحث, القاعدة, التمرينات, patokan)
    rujukan.json    kunci bahr, istilah, bank kata
  src/components/   Papan (sel huruf), Peragaan (Hudhud), TandaiBit, PotongTafilah, Pilihan,
                    HasilTimbang, Hudhud (SVG)
  src/pages/        Beranda (peta), Pelajaran, Checker, Rujukan
```

## Mesin taqthi' (inti, test-first)

1. **Huruf**: pecah teks per huruf dasar + tanda (harakat, sukun, syaddah, tanwin, alif
   khanjariyah). Huruf tanpa harakat yang bukan huruf mad/alif washal/lam ta'rif → galat
   "beri harakat pada kata X" (tidak menebak).
2. **Kitabah 'arudhiyyah**, aturan dapat dimatikan satu per satu (dipakai untuk membuat pilihan
   pengecoh di latihan):
   - syaddah → huruf sukun + huruf berharakat
   - tanwin → harakat + نْ; alif setelah tanwin fathah dan ى setelah tanwin tidak dibaca
   - ة → ت
   - hamzah washal di tengah kalam gugur; huruf mad sebelumnya ikut gugur (فِي الْ → فِلْ);
     di awal syathr dibaca hamzah berharakat
   - lam ta'rif tanpa sukun yang diikuti huruf bersyaddah (syamsiyah) lebur
   - alif khanjariyah tertulis (ٰ) atau kata pengecualian (هذا، هذه، ذلك، لكن، أولئك، هؤلاء، الله، إله،
     الرحمن) → ditambah alif mad
   - alif setelah waw jama'ah di akhir kata tidak dibaca
   - akhir syathr: harakat dipanjangkan (isyba'); tanwin di akhir syathr 1 tetap نْ, di akhir
     bait menjadi isyba'
   - pilihan (dicoba dua-duanya oleh penimbang): isyba' ha' dhamir (هُ/هِ di akhir kata diapit
     huruf hidup), mim jama' berharakat
3. **Bit**: huruf berharakat = 1, sukun dan huruf mad = 0.
4. **Timbang** (DP atas posisi bit × slot taf'ilah): biaya 0 untuk utuh, 0,1 untuk zihaf yang
   dikenal, 1 untuk patah; panjang potongan = panjang bentuk yang dikenal ±1. Hasil per taf'ilah:
   huruf-hurufnya, bit, status (utuh / berubah + nama zihaf / patah), bentuk terdekat, posisi bit
   yang berbeda.
5. **Bahr v1**: rajaz tam (مُسْتَفْعِلُنْ ×3; zihaf khabn, thayy, khabl; dharb maqthu' مُسْتَفْعِلْ),
   ramal majzu' (فَاعِلَاتُنْ ×2; khabn) dan ramal tam (… فَاعِلُنْ di 'arudh/dharb). Bahr baru =
   data baru di `bahr.ts`.

Test (vitest) memakai bait yang taqthi'-nya tercatat di sumber:
- دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ / قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ → 6 × utuh
  (al-'Uyun al-Ghamizah: «ما جارتن», «مثل ززبر»).
- لِلّٰهِ دَرُّ حَافِظِ بْنِ أَحْمَدَا / ابْنِ عَلِيِّ الْحَكَمِيِّ مَحْتِدَا → مستفعلن متفعلن متفعلن /
  مستعلن مستعلن متفعلن (Abu Qudamah, at-Talkhishat asy-Syafiyah درس 11).
- Alfiyah bait 1 (hamzah washal + mad gugur + الله).
- Template Ma laha (ramal majzu' utuh).
- Kasus per aturan kitabah + galat harakat kurang + bait pincang (letak salah tepat).
- **Test isi**: setiap bait di `src/content/*.json` ditimbang dan harus sesuai harapan yang ditulis
  di JSON (bit, status). Isi dan mesin tidak boleh berbeda.

## Halaman

- **Beranda**: peta 3 babak + bonus dari blueprint; Modul 0 aktif, lainnya "segera".
  Centang selesai per pelajaran di localStorage.
- **Pelajaran** (`/modul/0/1`): الأمثلة → البحث (peragaan Hudhud, lalu giliran Anda) → القاعدة →
  التمرينات (١ pilih, ٢ taqthi' bertahap, ٣ isi template, ٤ susun) → patokan + Salin ke Diwan.
- **Checker** (`/timbang`): input bait (Arab atau Latin), pilih bahr sasaran, mode bertahap
  (kitabah pilih ganda → tandai bit → potong taf'ilah → pilih bahr) atau mode cepat.
- **Rujukan** (`/rujukan`): notasi bit, sabab/watad, kunci bahr, istilah + jembatan, bank kata.

## Modul 0 (Peluru Pertama)

| Pelajaran | الأمثلة | Hasil / patokan |
|---|---|---|
| 1. Menimbang | دَارٌ لِسَلْمَى… | Syathr 2 ditandai sendiri, 21/21 bit benar |
| 2. Mengisi cetakan | لَمْ يَزَلْ فِي الْـ… (Ma laha, ramal majzu') | 3 syathr cetakan dengan kata sendiri, 0 patah |
| 3. Bait pertama | نَحْنُ الَّذِينَ بَايَعُوا مُحَمَّدَا (Khandaq), bank kata mini | Bait #1 v1 rajaz, ditimbang, jumlah patah dicatat ke Diwan (boleh pincang) |

## Deploy

- `deploy/nadzom.nginx.conf`: statis, gzip, `/assets/` immutable, `try_files … /index.html`.
- `deploy-nadzom.sh`: gate typecheck + test → build → rsync ke `~/nadzom-web/dist` → reload nginx.
  Tidak menyentuh backend.
- Sekali di server (butuh pemilik setelah DNS): pasang site nginx, certbot `nadzom.ihfazh.com`.
- `docs/architecture.md`: tambah baris aplikasi statis.
