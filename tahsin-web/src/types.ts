export interface Item {
  id: number
  name: string
  code: string
  order: number
  is_active: boolean
}

export interface Santri {
  id: number
  name: string
  is_pengampu: boolean
  pengampu: number | null
  is_active: boolean
  notes: string
  has_login: boolean
}

export interface Me {
  role: 'guardian' | 'pengampu'
  display_name: string
  santri_id: number | null
  items: Item[]
  santri: Santri[]
}

export interface ScoreIn {
  item: number
  value: number
}

export interface TahsinRecord {
  id: number
  santri: number
  date: string
  page: number | null
  page_detail: string
  notes: string
  scores: ScoreIn[]
  created_by_name: string | null
  created_at: string
}

export interface RecordInput {
  santri: number
  date: string
  page: number | null
  page_detail: string
  notes: string
  scores: ScoreIn[]
}

export interface SummaryItem {
  id: number
  code: string
  name: string
  avg: number | null
  count: number
  prev_avg: number | null
}

export interface SummarySantri {
  id: number
  name: string
  pengampu_id: number | null
  is_pengampu: boolean
  sessions: number
  last_date: string | null
  last_page: number | null
  last_page_detail: string
  scores: Record<number, number | null>
}

export interface Summary {
  period: 'week' | 'month'
  start: string
  end: string
  prev_start: string
  prev_end: string
  items: SummaryItem[]
  santri: SummarySantri[]
}

export interface LoginCode {
  code: string
  url: string
}
