import type { Babak, Istilah, KataBank, Modul } from './jenis'
import modul00 from './modul-00.json'
import peta from './peta.json'
import rujukan from './rujukan.json'

export const MODUL: Modul[] = [modul00 as Modul]
export const BABAK: Babak[] = peta.babak as Babak[]
export const ISTILAH: Istilah[] = rujukan.istilah
export const BANK_KATA: KataBank[] = rujukan.bankKata

export function cariModul(nomor: number): Modul | undefined {
  return MODUL.find((m) => m.nomor === nomor)
}
