import { createContext, useContext } from 'react'

/** Konteks jilid pelajaran yang sedang dibuka (spec 077): mode salim dan modul untuk menyaring laci. */
export interface InfoJilid {
  /** Jilid 1: taf'ilah yang berubah belum lulus. */
  salim: boolean
  /** Nomor modul yang sedang dibuka; laci hanya menampilkan kata sampai modul ini. */
  modul?: number
}

export const Jilid = createContext<InfoJilid>({ salim: false })

export const useJilid = () => useContext(Jilid)
