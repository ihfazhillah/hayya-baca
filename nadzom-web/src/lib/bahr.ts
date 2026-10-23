/** Definisi bahr. Bahr baru = data baru di sini. Bentuk tanpa `zihaf` = utuh. */
import type { Bahr, Bentuk } from './jenis'

type Tambahan = Pick<Bentuk, 'illah' | 'namaLain' | 'nilai'>
const b = (nama: string, bit: string, zihaf?: string, lain: Tambahan = {}): Bentuk =>
  zihaf ? { nama, bit, zihaf, ...lain } : { nama, bit, ...lain }

const MUSTAFILUN = [
  b('مُسْتَفْعِلُنْ', '1010110'),
  b('مُتَفْعِلُنْ', '110110', 'khabn', { namaLain: 'مَفَاعِلُنْ', nilai: 'hasan' }),
  b('مُسْتَعِلُنْ', '101110', 'thayy', { namaLain: 'مُفْتَعِلُنْ', nilai: 'shalih' }),
  b('مُتَعِلُنْ', '11110', 'khabl', { namaLain: 'فَعِلَتُنْ', nilai: 'qabih' }),
]
const MUSTAFILUN_DHARB = [
  ...MUSTAFILUN,
  b('مُسْتَفْعِلْ', '101010', "qath'", { illah: true, namaLain: 'مَفْعُولُنْ' }),
  b('مُتَفْعِلْ', '11010', "khabn + qath'", { illah: true, namaLain: 'فَعُولُنْ' }),
]
const FAILATUN = [b('فَاعِلَاتُنْ', '1011010'), b('فَعِلَاتُنْ', '111010', 'khabn', { nilai: 'hasan' })]
const FAILUN = [
  b('فَاعِلُنْ', '10110', 'hadzf', { illah: true }),
  b('فَعِلُنْ', '1110', 'khabn + hadzf', { illah: true }),
]
/** Ramal tam: 'arudh selalu mahdzufah; dharb shahih, maqshur, atau mahdzuf. */
const RAMAL_ARUDH = FAILUN
const RAMAL_DHARB = [
  ...FAILATUN,
  ...FAILUN,
  b('فَاعِلَانْ', '101100', 'qashr', { illah: true }),
  b('فَعِلَانْ', '11100', 'khabn + qashr', { illah: true }),
]
/** Ramal majzu': 'arudh shahihah; dharb shahih, musabbagh, atau mahdzuf. */
const RAMAL_MAJZU_DHARB = [
  ...FAILATUN,
  b('فَاعِلَاتَانْ', '10110100', 'tasbigh', { illah: true }),
  ...FAILUN,
]

const KUNCI_RAMAL: [string, string] = ['رَمَلُ الْأَبْحُرِ تَرْوِيهِ الثِّقَاتُ', 'فَاعِلَاتُنْ فَاعِلَاتُنْ فَاعِلَاتُ']

export const BAHR = {
  rajaz: {
    kode: 'rajaz',
    nama: 'Rajaz',
    namaAr: 'الرَّجَز',
    kunci: ['فِي أَبْحُرِ الْأَرْجَازِ بَحْرٌ يَسْهُلُ', 'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُ'],
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
    slot: [
      [FAILATUN, FAILATUN, RAMAL_ARUDH],
      [FAILATUN, FAILATUN, RAMAL_DHARB],
    ],
  },
} satisfies Record<string, Bahr>

export const DAFTAR_BAHR: Bahr[] = [BAHR.rajaz, BAHR.ramalMajzu, BAHR.ramal]

export function cariBahr(kode: string): Bahr | undefined {
  return DAFTAR_BAHR.find((x) => x.kode === kode)
}
