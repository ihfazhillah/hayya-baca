// Typed endpoint methods over an ApiClient (Spec 060 plan §2).
import type { ApiClient } from './client'
import type {
  AuthResult,
  ChildBadges,
  CommentItem,
  DiaryAccountResult,
  FeedPage,
  GuardianBadges,
  Me,
  Panel,
  PMDoc,
  Post,
  PostDetail,
  PostType,
  ReactionSummary,
  ReadReceiptItem,
  SetupTokenResult,
  TelegramLinkResult,
} from './types'

export function createEndpoints(c: ApiClient) {
  return {
    // Auth / bootstrap
    me: () => c.get<Me>('/api/diary/me/'),
    childLogin: (username: string, password: string) =>
      c.post<AuthResult>('/api/auth/child-login/', { username, password }),
    guardianLogin: (username: string, password: string) =>
      c.post<{ token: string }>('/api/auth/login/', { username, password }),
    childSetup: (code: string, password: string) =>
      c.post<AuthResult>('/api/auth/child-setup/', { code, password }),
    logout: () => c.post<void>('/api/auth/logout/'),

    // Post types
    postTypes: () => c.get<PostType[]>('/api/diary/post-types/'),

    // Child posts
    myPosts: (status?: string) =>
      c.get<Post[]>(
        '/api/diary/my/posts/' + (status ? `?status=${status}` : ''),
      ),
    createPost: (payload: { type: string; title?: string; body?: PMDoc | null }) =>
      c.post<Post>('/api/diary/my/posts/', payload),
    updatePost: (
      id: number,
      payload: Partial<{ title: string; body: PMDoc | null; status: string }>,
      retries = 0,
    ) => c.patch<Post>(`/api/diary/my/posts/${id}/`, payload, { retries }),
    deletePost: (id: number) => c.del<void>(`/api/diary/my/posts/${id}/`),

    // Panels
    uploadPanel: (postId: number, file: File, caption = '') => {
      const fd = new FormData()
      fd.append('image', file)
      if (caption) fd.append('caption', caption)
      return c.post<Panel>(`/api/diary/my/posts/${postId}/panels/`, fd)
    },
    patchPanel: (
      postId: number,
      panelId: number,
      payload: Partial<{ order: number; caption: string }>,
    ) =>
      c.patch<Panel>(
        `/api/diary/my/posts/${postId}/panels/${panelId}/`,
        payload,
      ),
    deletePanel: (postId: number, panelId: number) =>
      c.del<void>(`/api/diary/my/posts/${postId}/panels/${panelId}/`),

    // Feed / detail
    feed: (opts: { child?: number; cursor?: string } = {}) => {
      const params = new URLSearchParams()
      if (opts.child) params.set('child', String(opts.child))
      if (opts.cursor) params.set('cursor', opts.cursor)
      const q = params.toString()
      return c.get<FeedPage>('/api/diary/feed/' + (q ? `?${q}` : ''))
    },
    post: (id: number) => c.get<PostDetail>(`/api/diary/posts/${id}/`),
    markSeen: (id: number) =>
      c.post<{ read_by: ReadReceiptItem[] }>(`/api/diary/posts/${id}/seen/`),

    // Comments
    comments: (postId: number) =>
      c.get<CommentItem[]>(`/api/diary/posts/${postId}/comments/`),
    addComment: (postId: number, body: PMDoc) =>
      c.post<CommentItem>(`/api/diary/posts/${postId}/comments/`, { body }),
    editComment: (commentId: number, body: PMDoc) =>
      c.patch<CommentItem>(`/api/diary/comments/${commentId}/`, { body }),
    deleteComment: (commentId: number) =>
      c.del<void>(`/api/diary/comments/${commentId}/`),

    // Reactions
    addReaction: (postId: number, emoji: string) =>
      c.put<ReactionSummary>(`/api/diary/posts/${postId}/reactions/`, { emoji }),
    removeReaction: (postId: number, emoji: string) =>
      c.del<ReactionSummary>(`/api/diary/posts/${postId}/reactions/`, { emoji }),

    // Badges
    badges: () => c.get<GuardianBadges | ChildBadges>('/api/diary/badges/'),

    // Guardian admin
    createDiaryAccount: (childId: number, username: string) =>
      c.post<DiaryAccountResult>(
        `/api/children/${childId}/diary-account/`,
        { username },
      ),
    createSetupToken: (childId: number) =>
      c.post<SetupTokenResult>(
        `/api/children/${childId}/diary-account/setup-token/`,
      ),

    // Telegram
    telegramLink: () =>
      c.post<TelegramLinkResult>('/api/diary/telegram/link/'),
    telegramUnlink: () => c.del<void>('/api/diary/telegram/link/'),
  }
}

export type Endpoints = ReturnType<typeof createEndpoints>
