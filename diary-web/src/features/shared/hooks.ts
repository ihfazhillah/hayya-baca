import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useSession } from '@/auth/SessionProvider'
import type { PMDoc } from '@/api/types'

export function useApi() {
  return useSession().api
}

export function usePostTypes() {
  const api = useApi()
  return useQuery({ queryKey: ['post-types'], queryFn: () => api.postTypes() })
}

export function useMyPosts(status?: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['my-posts', status ?? 'all'],
    queryFn: () => api.myPosts(status),
  })
}

export function usePostDetail(id: number) {
  const api = useApi()
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => api.post(id),
  })
}

export function useFeed(child?: number) {
  const api = useApi()
  return useQuery({
    queryKey: ['feed', child ?? 'all'],
    queryFn: () => api.feed({ child }),
  })
}

export function useBadges() {
  const api = useApi()
  return useQuery({ queryKey: ['badges'], queryFn: () => api.badges() })
}

// Reactions/comments render inline in the guardian feed too, so refresh the
// detail query AND the feed list after a mutation. A guardian comment/reaction
// also marks the post seen server-side, so refresh badges too.
function invalidatePostAndFeed(qc: ReturnType<typeof useQueryClient>, postId: number) {
  qc.invalidateQueries({ queryKey: ['post', postId] })
  qc.invalidateQueries({ queryKey: ['feed'] })
  qc.invalidateQueries({ queryKey: ['badges'] })
}

export function useAddComment(postId: number) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PMDoc) => api.addComment(postId, body),
    onSuccess: () => invalidatePostAndFeed(qc, postId),
  })
}

export function useToggleReaction(postId: number) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ emoji, active }: { emoji: string; active: boolean }) =>
      active ? api.removeReaction(postId, emoji) : api.addReaction(postId, emoji),
    onSuccess: () => invalidatePostAndFeed(qc, postId),
  })
}
