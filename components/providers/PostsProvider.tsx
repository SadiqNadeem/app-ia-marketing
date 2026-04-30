'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Post, PostStatus } from '@/types'

interface CachedDraft {
  id: string
  content: string
  created_at: string
}

interface PostsContextValue {
  posts: Post[]
  loading: boolean
  error: string | null
  refreshPosts: () => Promise<void>
  addOrUpdatePost: (post: Post) => void
  updatePostStatus: (postId: string, status: PostStatus) => void
  lastDraft: CachedDraft | null
  setLastDraftFromPost: (post: Post) => void
}

const LAST_DRAFT_KEY = 'publify:last-draft'

const PostsContext = createContext<PostsContextValue | null>(null)

function readPostContent(post: Post): string {
  if (post.content_text && post.content_text.trim().length > 0) return post.content_text
  if (post.content && post.content.trim().length > 0) return post.content
  return ''
}

function sortByCreatedAtDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()
    return bTime - aTime
  })
}

export function PostsProvider({
  businessId,
  children,
}: {
  businessId: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastDraft, setLastDraft] = useState<CachedDraft | null>(() => {
    if (typeof window === 'undefined') return null
    const cached = window.localStorage.getItem(LAST_DRAFT_KEY)
    if (!cached) return null
    try {
      const parsed = JSON.parse(cached) as CachedDraft
      return parsed?.id && parsed?.content ? parsed : null
    } catch {
      return null
    }
  })

  const refreshPosts = useCallback(async () => {
    if (!businessId) return

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setPosts((data ?? []) as Post[])
    setLoading(false)
  }, [businessId, supabase])

  const setLastDraftFromPost = useCallback((post: Post) => {
    const content = readPostContent(post)
    const nextDraft: CachedDraft = {
      id: post.id,
      content,
      created_at: post.created_at,
    }
    setLastDraft(nextDraft)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_DRAFT_KEY, JSON.stringify(nextDraft))
    }
  }, [])

  const addOrUpdatePost = useCallback((post: Post) => {
    setPosts((current) => {
      const next = [post, ...current.filter((item) => item.id !== post.id)]
      return sortByCreatedAtDesc(next)
    })

    if (post.status === 'draft') {
      setLastDraftFromPost(post)
    }
  }, [setLastDraftFromPost])

  const updatePostStatus = useCallback((postId: string, status: PostStatus) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              status,
              published_at: status === 'published' ? new Date().toISOString() : post.published_at,
            }
          : post
      )
    )
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshPosts()
  }, [refreshPosts, pathname])

  const value = useMemo<PostsContextValue>(
    () => ({
      posts,
      loading,
      error,
      refreshPosts,
      addOrUpdatePost,
      updatePostStatus,
      lastDraft,
      setLastDraftFromPost,
    }),
    [
      posts,
      loading,
      error,
      refreshPosts,
      addOrUpdatePost,
      updatePostStatus,
      lastDraft,
      setLastDraftFromPost,
    ]
  )

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
}

export function usePosts(): PostsContextValue {
  const context = useContext(PostsContext)
  if (!context) {
    throw new Error('usePosts must be used inside <PostsProvider>')
  }
  return context
}
