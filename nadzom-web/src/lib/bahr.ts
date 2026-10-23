/** Definisi bahr. Bahr baru = data baru di sini. Bentuk tanpa `zihaf` = utuh. */
import type { Bahr, Bentuk } from './jenis'

const b = (nama: string, bit: string, zihaf?: string): Bentuk => (zihaf ? { nama, bit, zihaf } : { nama, bit })

const MUSTAFILUN = [
  b('مُسْتَفْعِلُنْ', '1010110'),
  b('مُتَفْعِلُنْ', '110110', 'khabn'),
  b('مُسْتَعِلُنْ', '101110', 'thayy'),
  b('مُتَعِلُنْ', '11110', 'khabl'),
]
const MUSTAFILUN_DHARB = [
  ...MUSTAFILUN,
  b('مُسْتَفْعِلْ', '101010', "qath'"),
  b('مُتَفْعِلْ', '11010', "khabn + qath'"),
]
const FAILATUN = [b('فَاعِلَاتُنْ', '1011010'), b('فَعِلَاتُنْ', '111010', 'khabn')]
const FAILUN_ARUDH = [b('فَاعِلُنْ', '10110', 'hadzf'), b('فَعِلُنْ', '1110', 'khabn + hadzf'), ...FAILATUN]

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
      [FAILATUN, FAILATUN],
    ],
  },
  ramal: {
    kode: 'ramal',
    nama: 'Ramal',
    namaAr: 'الرَّمَل',
    kunci: KUNCI_RAMAL,
    slot: [
      [FAILATUN, FAILATUN, FAILUN_ARUDH],
      [FAILATUN, FAILATUN, FAILUN_ARUDH],
    ],
  },
} satisfies Record<string, Bahr>

export const DAFTAR_BAHR: Bahr[] = [BAHR.rajaz, BAHR.ramalMajzu, BAHR.ramal]

export function cariBahr(kode: string): Bahr | undefined {
  return DAFTAR_BAHR.find((x) => x.kode === kode)
}
