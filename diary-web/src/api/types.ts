// API contract types mirroring the Django backend (Spec 060 plan §2).

export type Role = 'child' | 'guardian'

export interface ChildProfile {
  id: number
  name: string
  age: number | null
  avatar_color: string
  coins: number
  stars: number
  created_at: string
}

export interface ChildSummary {
  id: number
  name: string
  avatar_color: string
}

export interface MeChild {
  role: 'child'
  user_id: number
  child: ChildProfile
}

export interface GuardianChild extends ChildProfile {
  has_diary_account: boolean
  username: string | null
}

export interface MeGuardian {
  role: 'guardian'
  user_id: number
  children: GuardianChild[]
  telegram_linked: boolean
}

export type Me = MeChild | MeGuardian

export interface AuthResult {
  token: string
  child?: ChildProfile
}

// ProseMirror document — validated server-side against a small whitelist.
export interface PMNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: PMNode[]
}
export type PMDoc = PMNode

export type PostKind = 'text' | 'comic'
export type PostStatus = 'draft' | 'published'

export interface PostType {
  slug: string
  label: string
  emoji: string
  kind: PostKind
  order: number
}

export interface Post {
  id: number
  type: string
  title: string
  body: PMDoc | null
  status: PostStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Panel {
  id: number
  order: number
  caption: string
  image_url: string | null
}

export interface CommentItem {
  id: number
  body: PMDoc
  author_id: number
  author_label: string
  author_role: Role
  created_at: string
  updated_at: string
}

export interface ReactionSummary {
  counts: Record<string, number>
  mine: string[]
}

export interface ReadReceiptItem {
  label: string
  at: string
}

export interface PostDetail extends Post {
  child: ChildSummary
  panels: Panel[]
  comments: CommentItem[]
  reactions: ReactionSummary
  read_by: ReadReceiptItem[]
}

export interface FeedItem {
  id: number
  type: string
  title: string
  status: PostStatus
  published_at: string | null
  created_at: string
  child: ChildSummary
  comment_count: number
  reaction_count: number
  is_unread: boolean
}

export interface FeedPage {
  next: string | null
  previous: string | null
  results: FeedItem[]
}

export interface GuardianBadges {
  children: { child_id: number; unread: number }[]
  total: number
}

export interface ChildBadges {
  posts: number[]
  total: number
}

export interface SetupTokenResult {
  code: string
  setup_url: string
  expires_at: string
}

export interface DiaryAccountResult {
  username: string
  child_id: number
}

export interface TelegramLinkResult {
  deep_link: string
  link_code: string
}

export const REACTION_EMOJIS = ['❤️', '👏', '🌟', '😄'] as const
