/** Definisi bahr. Bahr baru = data baru di sini. Bentuk tanpa `zihaf` = utuh. */
import type { Bahr, Bentuk } from './jenis'

type Tambahan = Pick<Bentuk, 'illah' | 'namaLain' | 'nilai' | 'lagu'>
const b = (nama: string, bit: string, zihaf?: string, lain: Tambahan = {}): Bentuk =>
  zihaf ? { nama, bit, zihaf, ...lain } : { nama, bit, ...lain }

const MUSTAFILUN = [
  b('مُسْتَفْعِلُنْ', '1010110', undefined, { lagu: 'لا لا نعم' }),
  b('مُتَفْعِلُنْ', '110110', 'khabn', { namaLain: 'مَفَاعِلُنْ', nilai: 'hasan', lagu: 'لَ لا نعم' }),
  b('مُسْتَعِلُنْ', '101110', 'thayy', { namaLain: 'مُفْتَعِلُنْ', nilai: 'shalih', lagu: 'لا لَ نعم' }),
  b('مُتَعِلُنْ', '11110', 'khabl', { namaLain: 'فَعِلَتُنْ', nilai: 'qabih', lagu: 'لَ لَ نعم' }),
]
const MUSTAFILUN_DHARB = [
  ...MUSTAFILUN,
  b('مُسْتَفْعِلْ', '101010', "qath'", { illah: true, namaLain: 'مَفْعُولُنْ', lagu: 'لا لا لا' }),
  b('مُتَفْعِلْ', '11010', "khabn + qath'", { illah: true, namaLain: 'فَعُولُنْ', lagu: 'لَ لا لا' }),
]
const FAILATUN = [
  b('فَاعِلَاتُنْ', '1011010', undefined, { lagu: 'لا نعم لا' }),
  b('فَعِلَاتُنْ', '111010', 'khabn', { nilai: 'hasan', lagu: 'لَ نعم لا' }),
]
const FAILUN = [
  b('فَاعِلُنْ', '10110', 'hadzf', { illah: true, lagu: 'لا نعم' }),
  b('فَعِلُنْ', '1110', 'khabn + hadzf', { illah: true, lagu: 'لَ نعم' }),
]
/** Ramal tam: 'arudh selalu mahdzufah; dharb shahih, maqshur, atau mahdzuf. */
const RAMAL_ARUDH = FAILUN
const RAMAL_DHARB = [
  ...FAILATUN,
  ...FAILUN,
  b('فَاعِلَانْ', '101100', 'qashr', { illah: true, lagu: 'لا نعام' }),
  b('فَعِلَانْ', '11100', 'khabn + qashr', { illah: true, lagu: 'لَ نعام' }),
]
/** Ramal majzu': 'arudh shahihah; dharb shahih, musabbagh, atau mahdzuf. */
const RAMAL_MAJZU_DHARB = [
  ...FAILATUN,
  b('فَاعِلَاتَانْ', '10110100', 'tasbigh', { illah: true, lagu: 'لا نعم لال' }),
  ...FAILUN,
]

/** Kamil: 'arudh shahihah atau hadzdza'; dharb juga maqthu'. Idhmar (huruf kedua disukunkan) sangat lazim. */
const MUTAFAILUN = [
  b('مُتَفَاعِلُنْ', '1110110', undefined, { lagu: 'لَ لَ لا نعم' }),
  b('مُتْفَاعِلُنْ', '1010110', 'idhmar', { namaLain: 'مُسْتَفْعِلُنْ', nilai: 'hasan', lagu: 'لا لا نعم' }),
  b('مُفَاعِلُنْ', '110110', 'waqsh', { nilai: 'qabih', lagu: 'لَ لا نعم' }),
  b('مُتْفَعِلُنْ', '101110', 'khazl', { namaLain: 'مُفْتَعِلُنْ', nilai: 'qabih', lagu: 'لا لَ نعم' }),
]
const KAMIL_ARUDH = [
  ...MUTAFAILUN,
  b('مُتَفَا', '1110', 'hadzadz', { illah: true, namaLain: 'فَعِلُنْ', lagu: 'لَ لَ لا' }),
  b('مُتْفَا', '1010', 'hadzadz + idhmar', { illah: true, namaLain: 'فَعْلُنْ', lagu: 'لا لا' }),
]
const KAMIL_DHARB = [
  ...KAMIL_ARUDH,
  b('مُتَفَاعِلْ', '111010', "qath'", { illah: true, namaLain: 'فَعِلَاتُنْ', lagu: 'لَ لَ لا لا' }),
  b('مُتْفَاعِلْ', '101010', "qath' + idhmar", { illah: true, namaLain: 'مَفْعُولُنْ', lagu: 'لا لا لا' }),
]

/** Basith: فاعلن di hasyw; 'arudh makhbunah; dharb makhbun atau maqthu'. */
const FAILUN_ASLI = [b('فَاعِلُنْ', '10110', undefined, { lagu: 'لا نعم' }), b('فَعِلُنْ', '1110', 'khabn', { nilai: 'hasan', lagu: 'لَ نعم' })]
/** 'Arudh tam selalu makhbunah; فَاعِلُنْ di ujung syathr pertama hanya lewat tasri'. */
const BASITH_ARUDH = [FAILUN_ASLI[1]]
const BASITH_DHARB = [FAILUN_ASLI[1], b('فَاعِلْ', '1010', "qath'", { illah: true, namaLain: 'فَعْلُنْ', lagu: 'لا لا' })]

/** Thawil: 'arudh selalu maqbudhah; dharb shahih, maqbudh, atau mahdzuf. */
const FAULUN = [b('فَعُولُنْ', '11010', undefined, { lagu: 'نعم لا' }), b('فَعُولُ', '1101', 'qabdh', { nilai: 'hasan', lagu: 'نعم لَ' })]
const MAFAILUN = [
  b('مَفَاعِيلُنْ', '1101010', undefined, { lagu: 'نعم لا لا' }),
  b('مَفَاعِلُنْ', '110110', 'qabdh', { nilai: 'hasan', lagu: 'نعم لَ لا' }),
  b('مَفَاعِيلُ', '110101', 'kaff', { nilai: 'shalih', lagu: 'نعم لا لَ' }),
]
const THAWIL_ARUDH = [b('مَفَاعِلُنْ', '110110', 'qabdh', { lagu: 'نعم لَ لا' })]
const THAWIL_DHARB = [...MAFAILUN.slice(0, 2), b('مَفَاعِي', '11010', 'hadzf', { illah: true, namaLain: 'فَعُولُنْ', lagu: 'نعم لا' })]

/** Wafir tam: 'arudh dan dharb selalu maqthufah. 'Ashb (huruf kelima disukunkan) sangat lazim. */
const MUFAALATUN = [
  b('مُفَاعَلَتُنْ', '1101110', undefined, { lagu: 'نعم لَ لَ لا' }),
  b('مُفَاعَلْتُنْ', '1101010', "'ashb", { namaLain: 'مَفَاعِيلُنْ', nilai: 'hasan', lagu: 'نعم لا لا' }),
  b('مُفَاعَتُنْ', '110110', "'aql", { namaLain: 'مَفَاعِلُنْ', nilai: 'qabih', lagu: 'نعم لَ لا' }),
  b('مُفَاعَلْتُ', '110101', 'naqsh', { namaLain: 'مَفَاعِيلُ', nilai: 'qabih', lagu: 'نعم لا لَ' }),
]
const WAFIR_AKHIR = [b('مُفَاعَلْ', '11010', 'qathf', { illah: true, namaLain: 'فَعُولُنْ', lagu: 'نعم لا' })]

/** Mujtats: selalu majzu', dua taf'ilah per syathr. */
const MUSTAFILUN_MUJTATS = [
  b('مُسْتَفْعِلُنْ', '1010110', undefined, { lagu: 'لا لا نعم' }),
  b('مُتَفْعِلُنْ', '110110', 'khabn', { namaLain: 'مَفَاعِلُنْ', nilai: 'hasan', lagu: 'لَ لا نعم' }),
  b('مُسْتَفْعِلُ', '101011', 'kaff', { nilai: 'qabih', lagu: 'لا لا لَ لَ' }),
  b('مُتَفْعِلُ', '11011', 'syakl', { nilai: 'qabih', lagu: 'لَ لا لَ لَ' }),
]

const KUNCI_RAMAL: [string, string] = ['رَمَلُ الْأَبْحُرِ تَرْوِيهِ الثِّقَاتُ', 'فَاعِلَاتُنْ فَاعِلَاتُنْ فَاعِلَاتُ']
const MAKNA_RAMAL = 'Ramal di antara bahr-bahr: para perawi tepercaya meriwayatkannya.'

export const BAHR = {
  rajaz: {
    kode: 'rajaz',
    nama: 'Rajaz',
    namaAr: 'الرَّجَز',
    kunci: ['فِي أَبْحُرِ الْأَرْجَازِ بَحْرٌ يَسْهُلُ', 'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُ'],
    kunciMakna: 'Di antara bahr-bahr rajaz, ada satu bahr yang mudah dilalui.',
    dengar: {
      youtube: 'b3dA6ihqHjM',
      judul: 'Tanghim tafshili bahr rajaz',
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 64",
    },
    slot: [
      [MUSTAFILUN, MUSTAFILUN, MUSTAFILUN],
      [MUSTAFILUN, MUSTAFILUN, MUSTAFILUN_DHARB],
    ],
  },
  ramalMajzu: {
    kode: 'ramalMajzu',
    nama: "Ramal majzu'",
    namaAr: 'الرَّمَل الْمَجْزُوء',
    kunci: KUNCI_RAMAL,
    kunciMakna: MAKNA_RAMAL,
    dengar: {
      youtube: '68kAGgPL00o',
      judul: "Tanghim tafshili bahr ramal (majzu'), tiga surah",
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 52",
    },
    slot: [
      [FAILATUN, FAILATUN],
      [FAILATUN, RAMAL_MAJZU_DHARB],
    ],
  },
  ramal: {
    kode: 'ramal',
    nama: 'Ramal',
    namaAr: 'الرَّمَل',
    kunci: KUNCI_RAMAL,
    kunciMakna: MAKNA_RAMAL,
    dengar: {
      youtube: 'mJ75tXCWYgo',
      judul: 'Tanghim tafshili bahr ramal (tam), tiga surah',
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 51",
    },
    slot: [
      [FAILATUN, FAILATUN, RAMAL_ARUDH],
      [FAILATUN, FAILATUN, RAMAL_DHARB],
    ],
  },
  kamil: {
    kode: 'kamil',
    nama: 'Kamil',
    namaAr: 'الْكَامِل',
    kunci: ['كَمَلَ الْجَمَالُ مِنَ الْبُحُورِ الْكَامِلُ', 'مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُ'],
    kunciMakna: 'Keindahan menjadi sempurna: di antara semua bahr, kamil-lah yang sempurna.',
    dengar: {
      youtube: '6s-lq6-q3a0',
      judul: 'Tanghim tafshili bahr kamil (tam), enam surah',
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 48",
    },
    slot: [
      [MUTAFAILUN, MUTAFAILUN, KAMIL_ARUDH],
      [MUTAFAILUN, MUTAFAILUN, KAMIL_DHARB],
    ],
  },
  basith: {
    kode: 'basith',
    nama: 'Basith',
    namaAr: 'الْبَسِيط',
    kunci: ['إِنَّ الْبَسِيطَ لَدَيْهِ يُبْسَطُ الْأَمَلُ', 'مُسْتَفْعِلُنْ فَاعِلُنْ مُسْتَفْعِلُنْ فَعِلُ'],
    kunciMakna: 'Bahr basith: di sanalah harapan dibentangkan lebar.',
    dengar: {
      youtube: 'NgfEQyyIWU4',
      judul: 'Tanghim tafshili bahr basith (tam), dua surah',
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 45",
    },
    slot: [
      [MUSTAFILUN, FAILUN_ASLI, MUSTAFILUN, BASITH_ARUDH],
      [MUSTAFILUN, FAILUN_ASLI, MUSTAFILUN, BASITH_DHARB],
    ],
  },
  thawil: {
    kode: 'thawil',
    nama: 'Thawil',
    namaAr: 'الطَّوِيل',
    kunci: ['طَوِيلٌ لَهُ دُونَ الْبُحُورِ فَضَائِلُ', 'فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِلُ'],
    kunciMakna: 'Thawil punya keutamaan yang tidak dimiliki bahr lain.',
    dengar: {
      youtube: '27eH0PkRgJk',
      judul: 'Tanghim tafshili bahr thawil, tiga surah',
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 43",
    },
    slot: [
      [FAULUN, MAFAILUN, FAULUN, THAWIL_ARUDH],
      [FAULUN, MAFAILUN, FAULUN, THAWIL_DHARB],
    ],
  },
  wafir: {
    kode: 'wafir',
    nama: 'Wafir',
    namaAr: 'الْوَافِر',
    kunci: ['بُحُورُ الشِّعْرِ وَافِرُهَا جَمِيلُ', 'مُفَاعَلَتُنْ مُفَاعَلَتُنْ فَعُولُ'],
    kunciMakna: 'Di antara bahr-bahr syair, wafir itu indah.',
    dengar: {
      youtube: 'v-Arfui_3ts',
      judul: 'Tanghim tafshili bahr wafir, satu surah',
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 47",
    },
    slot: [
      [MUFAALATUN, MUFAALATUN, WAFIR_AKHIR],
      [MUFAALATUN, MUFAALATUN, WAFIR_AKHIR],
    ],
  },
  mujtats: {
    kode: 'mujtats',
    nama: 'Mujtats',
    namaAr: 'الْمُجْتَثّ',
    kunci: ['إِنْ جُثَّتِ الْحَرَكَاتُ', 'مُسْتَفْعِلُنْ فَاعِلَاتُ'],
    kunciMakna: 'Bila harakat-harakatnya dipangkas: itulah mujtats, artinya yang dipangkas.',
    dengar: {
      youtube: 'jVFTxXIoo9M',
      judul: "Tanghim tafshili bahr mudhari', muqtadhab, dan mujtats (mujtats di bagian akhir)",
      sumber: "Lisan Mubin (lm.edu.sa), 'Ilmul 'Arudh Level 1, pelajaran 59",
    },
    slot: [
      [MUSTAFILUN_MUJTATS, FAILATUN],
      [MUSTAFILUN_MUJTATS, FAILATUN],
    ],
  },
} satisfies Record<string, Bahr>

/** Urutan juga pemecah seri saat menebak: rajaz didahulukan dari kamil yang semuanya mudhmar. */
export const DAFTAR_BAHR: Bahr[] = [BAHR.rajaz, BAHR.ramalMajzu, BAHR.ramal, BAHR.kamil, BAHR.basith, BAHR.thawil, BAHR.wafir, BAHR.mujtats]

export function cariBahr(kode: string): Bahr | undefined {
  return DAFTAR_BAHR.find((x) => x.kode === kode)
}
