/** Same-origin API — nginx proxies /api/ to the shared Django gunicorn.
 *  Auth: DRF token in localStorage, sent as `Authorization: Token <key>`.
 *  A 401 clears the token and notifies the app (→ login screen).
 */
import type {
  Alat, Beranda, Buku, Dasbor, HadiahBaru, HadiahItem, HasilGunting, HasilKembar, HasilKlik,
  Ide, Jawaban, JejakCerita, KartuLatihan, Lembar, Me, MisiDetail, ModulDetail, ModulTerkunci,
  NaskahDetail, NaskahOrtu, NaskahRingkas, PemeriksaanDetail, PemeriksaanRingkas, PenukaranItem,
  Peta4, PromptAnak, Sorotan, Delta, StempelSlot, TokohNaskah, VersiDetail, AlatRingkas,
} from './types'

const TOKEN_KEY = 'penerbit.token'
const PENULIS_KEY = 'penerbit.penulis'
const SIMULASI_KEY = 'penerbit.simulasi'
const P = '/api/penerbit'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
    this.name = 'ApiError'
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Penulis yang sedang dilihat Pemeriksa (keluarga dengan lebih dari satu anak). */
export function getPenulisDipilih(): number | null {
  const v = localStorage.getItem(PENULIS_KEY)
  return v ? Number(v) : null
}
export function setPenulisDipilih(id: number | null) {
  if (id) localStorage.setItem(PENULIS_KEY, String(id))
  else localStorage.removeItem(PENULIS_KEY)
}

/** Orang tua sedang "Lihat sebagai anak": semua request memakai profil simulasinya. */
export function sedangSimulasi(): boolean {
  return localStorage.getItem(SIMULASI_KEY) === '1'
}
export function setSimulasi(aktif: boolean) {
  if (aktif) localStorage.setItem(SIMULASI_KEY, '1')
  else localStorage.removeItem(SIMULASI_KEY)
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Token ${token}`
  if (sedangSimulasi()) headers['X-Penerbit-Sebagai'] = 'simulasi'
  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(path, { method, headers, body: payload })
  if (res.status === 401) {
    setToken(null)
    onUnauthorized?.()
    throw new ApiError(401, 'Sesi berakhir, silakan masuk lagi.')
  }
  if (!res.ok) {
    let detail = `Error ${res.status}`
    let data: unknown
    try {
      data = await res.json()
      const d = data as Record<string, unknown>
      const first = Array.isArray(d) ? d[0] : (d.detail ?? Object.values(d)?.[0])
      detail = Array.isArray(first) ? String(first[0]) : String(first ?? detail)
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail, data)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Tambah ?penulis= untuk endpoint Pemeriksa. */
function q(path: string, extra?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  const p = getPenulisDipilih()
  if (p) params.set('penulis', String(p))
  for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined && v !== '') params.set(k, String(v))
  const s = params.toString()
  return s ? `${path}?${s}` : path
}

// ---- Auth ----
/** Anak masuk lewat child-login; akun orang tua ditolak di sana (403) lalu lewat login biasa. */
export async function login(username: string, password: string): Promise<string> {
  try {
    const r = await request<{ token: string }>('POST', '/api/auth/child-login/', { username, password })
    return r.token
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      const r = await request<{ token: string }>('POST', '/api/auth/login/', { username, password })
      return r.token
    }
    if (e instanceof ApiError && e.status === 401) {
      throw new ApiError(401, 'Kata sandinya belum cocok. Coba lagi, atau minta bantuan Ayah.')
    }
    throw e
  }
}

export const getMe = () => request<Me>('GET', `${P}/me/`)
export const ulangSimulasi = () => request<{ id: number }>('POST', `${P}/simulasi/ulang/`)
export const aktifkanPenulis = (child_id: number, nama_panggilan?: string) =>
  request<{ id: number; nama: string }>('POST', `${P}/ortu/penulis/`, { child_id, nama_panggilan })

// ---- Penulis ----
export const getBeranda = () => request<Beranda>('GET', `${P}/beranda/`)
export const getAlat = () => request<{ alat: Alat[] }>('GET', `${P}/alat/`)
export const getModul = (nomor: number) =>
  request<ModulDetail | ModulTerkunci>('GET', `${P}/modul/${nomor}/`)

export const getMisi = (id: number) => request<MisiDetail>('GET', `${P}/misi/${id}/`)
export const klikMisi = (id: number, target: { token?: number; celah?: number }) =>
  request<HasilKlik>('POST', `${P}/misi/${id}/klik/`, target)
export const petunjukMisi = (id: number) =>
  request<{ kalimat: [number, number][] }>('POST', `${P}/misi/${id}/petunjuk/`)
export const berhentiMisi = (id: number) =>
  request<Jawaban & { selesai: true; ditemukan: number; hadiah_baru: HadiahBaru[] }>(
    'POST', `${P}/misi/${id}/berhenti/`)
export const periksaGunting = (id: number, potong: number[]) =>
  request<HasilGunting>('POST', `${P}/misi/${id}/periksa/`, { potong })
export const periksaKembar = (id: number, kata: string) =>
  request<HasilKembar>('POST', `${P}/misi/${id}/periksa/`, { kata })
export const tandaiMisi = (id: number, log?: string) =>
  request<{ selesai: true; hadiah_baru: HadiahBaru[] }>('POST', `${P}/misi/${id}/tandai/`, { log })
export const cetakMisi = (id: number) =>
  request<{ status: 'menunggu'; lembar: string }>('POST', `${P}/misi/${id}/cetak/`)
export const jawabUjian = (id: number, pilihan: 'a' | 'b') =>
  request<{ benar: boolean; jawaban: 'a' | 'b'; alasan: string }>('POST', `${P}/ujian/${id}/jawab/`, { pilihan })
export const jawabBertanya = (modul: number, pilihan: 'a' | 'b') =>
  request<{ benar: boolean; jawaban: 'a' | 'b'; bagian: number[]; penjelasan: string }>(
    'POST', `${P}/bertanya/${modul}/jawab/`, { pilihan })

export const getLatihan = () => request<{ kartu: KartuLatihan[]; pesan?: string }>('GET', `${P}/latihan/`)
export const pilihAlatLatihan = (id: number, alat: string) =>
  request<{ benar: boolean; alat?: AlatRingkas; pesan?: string }>('POST', `${P}/latihan/${id}/alat/`, { alat })
export const klikLatihan = (id: number, target: { token?: number; celah?: number }) =>
  request<HasilKlik>('POST', `${P}/latihan/${id}/klik/`, target)
export const berhentiLatihan = (id: number) =>
  request<Jawaban & { selesai: true; hadiah_baru: HadiahBaru[] }>('POST', `${P}/latihan/${id}/berhenti/`)
export const periksaGuntingLatihan = (id: number, potong: number[]) =>
  request<HasilGunting>('POST', `${P}/latihan/${id}/periksa/`, { potong })
export const periksaKembarLatihan = (id: number, kata: string) =>
  request<HasilKembar>('POST', `${P}/latihan/${id}/periksa/`, { kata })

export const listIde = () => request<Ide[]>('GET', `${P}/ide/`)
export const tambahIde = (teks: string, sumur: Ide['sumur']) =>
  request<Ide>('POST', `${P}/ide/`, { teks, sumur })
export const ubahIde = (id: number, body: Partial<Pick<Ide, 'teks' | 'bintang'>>) =>
  request<Ide>('PATCH', `${P}/ide/${id}/`, body)
export const hapusIde = (id: number) => request<void>('DELETE', `${P}/ide/${id}/`)

export const listNaskah = () => request<NaskahRingkas[]>('GET', `${P}/naskah/`)
export const naskahBaru = (body: { judul: string; ide?: number | null; peta: Peta4 }) =>
  request<NaskahDetail>('POST', `${P}/naskah/`, body)
export const getNaskah = (id: number) => request<NaskahDetail>('GET', `${P}/naskah/${id}/`)
export const ubahNaskah = (id: number, body: Partial<{ judul: string; kartu_tebakan: string; peta: Peta4 }>) =>
  request<NaskahDetail>('PATCH', `${P}/naskah/${id}/`, body)
export interface IsiSimpan {
  isi: Delta
  teks: string
  sorotan: Sorotan[]
  waktu_klien: number
  lapis?: string
  menulis_tambahan_dari?: number | null
}
export const simpanNaskah = (id: number, body: IsiSimpan) =>
  request<{ tersimpan: string; waktu_klien: number }>('POST', `${P}/naskah/${id}/simpan/`, body)
export const simpanVersi = (id: number, lapis?: string) =>
  request<{ nomor: number; lapis: string; jejak?: Record<string, number | string>; hadiah_baru: HadiahBaru[] }>(
    'POST', `${P}/naskah/${id}/versi/`, lapis ? { lapis } : {})
/** Sorotan stabilo di versi lama (teks versi tetap tidak bisa diubah). */
export const sorotVersi = (id: number, nomor: number, sorotan: Sorotan[]) =>
  request<{ nomor: number; sorotan: Sorotan[] }>('PATCH', `${P}/naskah/${id}/versi/${nomor}/`, { sorotan })
export const getVersi = (id: number, nomor: number) =>
  request<VersiDetail>('GET', `${P}/naskah/${id}/versi/${nomor}/`)
export const bukaLaci = (id: number) =>
  request<{ kartu_tebakan: string; tahap: string }>('POST', `${P}/naskah/${id}/buka-laci/`)
export const sorotanSistem = (id: number, alat: string[]) =>
  request<Sorotan[]>('GET', `${P}/naskah/${id}/sorotan-sistem/?alat=${alat.join(',')}`)
export const ubahTokoh = (id: number, body: { tambah: string } | { hapus: string }) =>
  request<{ tokoh: TokohNaskah; hadiah_baru: HadiahBaru[] }>('POST', `${P}/naskah/${id}/tokoh/`, body)
export const mintaStempel = (id: number, lapis: string) =>
  request<{ stempel_diminta: string }>('POST', `${P}/naskah/${id}/minta-stempel/`, { lapis })
export const simpanFavorit = (id: number, sebelum: string, sesudah: string) =>
  request<{ sebelum: string; sesudah: string }>('POST', `${P}/naskah/${id}/favorit/`, { sebelum, sesudah })
export const getJejak = () =>
  request<{ cerita: JejakCerita[]; kalimat_utama: string; emas: { alat: string; tanggal: string }[] }>(
    'GET', `${P}/jejak/`)

export const buatPrompt = (modul: number, bagian?: string[]) =>
  request<{ id: number; teks: string }>('POST', `${P}/prompt/`, { modul, bagian })
export const refleksiPrompt = (id: number, refleksi_bantu: string, refleksi_ubah: string) =>
  request<{ id: number }>('PATCH', `${P}/prompt/${id}/`, { refleksi_bantu, refleksi_ubah })

export const getPenukaran = () =>
  request<{ total: number; hadiah: HadiahItem[]; penukaran: PenukaranItem[] }>('GET', `${P}/penukaran/`)
export const ajukanPenukaran = (hadiah: number) =>
  request<{ id: number; status: string }>('POST', `${P}/penukaran/`, { hadiah })

export const getRak = () => request<{ penulis: string; buku: Buku[] }>('GET', q(`${P}/rak/`))
export const getBuku = (id: number) => request<Buku>('GET', q(`${P}/rak/${id}/`))
export const getLembarCetak = (kode: string) =>
  request<Lembar>('GET', `${P}/cetak/${encodeURIComponent(kode)}/`)

// ---- Pemeriksa ----
export const getDasbor = () => request<Dasbor>('GET', q(`${P}/ortu/dasbor/`))
export const listPemeriksaan = (filter?: { status?: string; kode?: string }) =>
  request<PemeriksaanRingkas[]>('GET', q(`${P}/ortu/lembar/`, filter))
export const getPemeriksaan = (id: number) =>
  request<PemeriksaanDetail>('GET', `${P}/ortu/lembar/${id}/`)
export const simpanPemeriksaan = (id: number, body: { status: 'bagus' | 'coba_lagi'; catatan?: string; stiker?: string | null }) =>
  request<PemeriksaanRingkas & { hadiah_baru: HadiahBaru[] }>('POST', `${P}/ortu/lembar/${id}/`, body)
export const listNaskahOrtu = () => request<NaskahRingkas[]>('GET', q(`${P}/ortu/naskah/`))
export const getNaskahOrtu = (id: number) => request<NaskahOrtu>('GET', `${P}/ortu/naskah/${id}/`)
export const beriStempel = (id: number, lapis: string, catatan = '') =>
  request<{ stempel: StempelSlot[] }>('POST', `${P}/ortu/naskah/${id}/stempel/`, { lapis, catatan })
export const tambahCatatan = (id: number, teks: string) =>
  request<{ id: number }>('POST', `${P}/ortu/naskah/${id}/catatan/`, { teks })
export const ulasanOrtu = (id: number, body: { favorit: string; membingungkan: string; pertanyaan: string }) =>
  request<{ id: number }>('POST', `${P}/ortu/naskah/${id}/ulasan/`, body)
export const bukaLaciOrtu = (id: number) => request<{ tahap: string }>('POST', `${P}/ortu/naskah/${id}/buka-laci/`)
export const bagikanNaskah = (id: number, username: string) =>
  request<{ dibagikan: string; versi: number }>('POST', `${P}/ortu/naskah/${id}/bagikan/`, { username })
export const terbitkan = (id: number, data: FormData) =>
  request<{ nomor_terbitan: string; hadiah_baru: HadiahBaru[] }>('POST', `${P}/ortu/naskah/${id}/terbitkan/`, data)
export const beraniHapus = (id: number, catatan: string) =>
  request<{ total_poin: number }>('POST', `${P}/ortu/naskah/${id}/berani-hapus/`, { catatan })
export const logBagus = (id: number, catatan: string) =>
  request<{ total_poin: number }>('POST', `${P}/ortu/naskah/${id}/log-bagus/`, { catatan })
export const ubahEjaan = (id: number, kesalahan_ejaan: number | null) =>
  request<{ kesalahan_ejaan: number }>('PATCH', `${P}/ortu/naskah/${id}/ejaan/`, { kesalahan_ejaan })
export const getStikerOrtu = () =>
  request<{ alat: Alat[]; stempel: { naskah: string; id: number; stempel: StempelSlot[] }[] }>(
    'GET', q(`${P}/ortu/stiker/`))
export const beriStiker = (alat: string, tingkat: string, catatan = '') =>
  request<{ hadiah_baru: HadiahBaru[] }>('POST', q(`${P}/ortu/stiker/`), { alat, tingkat, catatan })
export const getHadiahOrtu = () =>
  request<{
    total: number
    hadiah: HadiahItem[]
    penukaran: PenukaranItem[]
    riwayat_poin: { minggu: string; total: number; baris: { jumlah: number; alasan: string; tanggal: string }[] }[]
  }>('GET', q(`${P}/ortu/hadiah/`))
export const tambahHadiah = (nama: string, harga: number) =>
  request<HadiahItem>('POST', q(`${P}/ortu/hadiah/`), { nama, harga })
export const ubahHadiah = (id: number, body: Partial<HadiahItem>) =>
  request<HadiahItem>('PATCH', `${P}/ortu/hadiah/${id}/`, body)
export const putuskanPenukaran = (id: number, status: 'disetujui' | 'ditunda') =>
  request<PenukaranItem>('POST', `${P}/ortu/penukaran/${id}/`, { status })
export const getCetakModul = (modul: number) =>
  request<{ modul: { nomor: number; judul: string }; lembar: Lembar[] }>('GET', `${P}/ortu/cetak/?modul=${modul}`)
export const listPromptAnak = () => request<PromptAnak[]>('GET', q(`${P}/ortu/prompt/`))
export const catatanPrompt = (id: number, catatan_ortu: string) =>
  request<PromptAnak>('PATCH', `${P}/ortu/prompt/${id}/`, { catatan_ortu })

// ---- Editor Tamu ----
export const listUlasan = () =>
  request<{ id: number; judul: string; penulis: string; versi: number; tanggal: string }[]>('GET', `${P}/ulasan/`)
export const getUlasan = (id: number) =>
  request<{
    id: number; judul: string; penulis: string; versi: number; teks: string; isi: Delta
    ulasan_saya: { favorit: string; membingungkan: string; pertanyaan: string; tanggal: string }[]
  }>('GET', `${P}/ulasan/${id}/`)
export const kirimUlasan = (id: number, body: { favorit: string; membingungkan: string; pertanyaan: string }) =>
  request<{ id: number }>('POST', `${P}/ulasan/${id}/`, body)
