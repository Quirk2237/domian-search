"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "./use-auth"
import { createClient } from "@/lib/supabase-config"

interface Bookmark {
  id: string
  user_id: string
  domain: string
  extension: string
  search_id?: string
  created_at: string
}

interface PendingBookmark {
  domain: string
  extension: string
  search_id?: string
}

export function useBookmarks() {
  const { user, loading: authLoading } = useAuth()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingBookmark, setPendingBookmark] = useState<PendingBookmark | null>(null)
  const supabase = createClient()

  // Fetch user's bookmarks
  const fetchBookmarks = useCallback(async () => {
    if (!user) {
      setBookmarks([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("domain_bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setBookmarks(data || [])
    } catch (error) {
      console.error("Error fetching bookmarks:", error)
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  // Check if a domain is bookmarked
  const isBookmarked = useCallback(
    (domain: string, extension: string) => {
      return bookmarks.some(
        (b) => b.domain === domain && b.extension === extension
      )
    },
    [bookmarks]
  )

  // Toggle bookmark
  const toggleBookmark = useCallback(
    async (domain: string, extension: string, search_id?: string) => {
      if (!user) {
        // Store as pending bookmark for after auth
        setPendingBookmark({ domain, extension, search_id })
        return { requiresAuth: true }
      }

      const isCurrentlyBookmarked = isBookmarked(domain, extension)

      try {
        if (isCurrentlyBookmarked) {
          // Remove bookmark
          const bookmarkToRemove = bookmarks.find(
            (b) => b.domain === domain && b.extension === extension
          )
          
          if (bookmarkToRemove) {
            // Optimistic update
            setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkToRemove.id))

            const { error } = await supabase
              .from("domain_bookmarks")
              .delete()
              .eq("id", bookmarkToRemove.id)

            if (error) throw error
          }
        } else {
          // Add bookmark
          const newBookmark = {
            user_id: user.id,
            domain,
            extension,
            search_id,
          }

          const { data, error } = await supabase
            .from("domain_bookmarks")
            .insert(newBookmark)
            .select()
            .single()

          if (error) {
            if (error.code === "23505") {
              // Unique constraint violation - bookmark already exists
              // Refresh bookmarks to sync state
              await fetchBookmarks()
            } else {
              throw error
            }
          } else {
            // Optimistic update
            setBookmarks((prev) => [data, ...prev])
          }
        }

        return { success: true }
      } catch (error) {
        console.error("Error toggling bookmark:", error)
        // Revert optimistic update by refetching
        await fetchBookmarks()
        return { success: false }
      }
    },
    [user, bookmarks, isBookmarked, fetchBookmarks, supabase]
  )

  // Process pending bookmark after auth
  const processPendingBookmark = useCallback(async () => {
    if (pendingBookmark && user) {
      const { domain, extension, search_id } = pendingBookmark
      await toggleBookmark(domain, extension, search_id)
      setPendingBookmark(null)
      // Clear from localStorage
      localStorage.removeItem("pendingBookmark")
    }
  }, [pendingBookmark, user, toggleBookmark])

  // Load pending bookmark from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("pendingBookmark")
    if (stored) {
      try {
        setPendingBookmark(JSON.parse(stored))
      } catch (error) {
        localStorage.removeItem("pendingBookmark")
      }
    }
  }, [])

  // Save pending bookmark to localStorage
  useEffect(() => {
    if (pendingBookmark) {
      localStorage.setItem("pendingBookmark", JSON.stringify(pendingBookmark))
    }
  }, [pendingBookmark])

  // Fetch bookmarks when user changes
  useEffect(() => {
    if (!authLoading) {
      fetchBookmarks()
    }
  }, [user, authLoading, fetchBookmarks])

  // Process pending bookmark when user logs in
  useEffect(() => {
    if (user && pendingBookmark) {
      processPendingBookmark()
    }
  }, [user, pendingBookmark, processPendingBookmark])

  // Create a map for quick lookup
  const bookmarkMap = useMemo(() => {
    const map = new Map<string, boolean>()
    bookmarks.forEach((b) => {
      map.set(`${b.domain}.${b.extension}`, true)
    })
    return map
  }, [bookmarks])

  return {
    bookmarks,
    loading: loading || authLoading,
    isBookmarked,
    toggleBookmark,
    pendingBookmark,
    bookmarkMap,
    refetch: fetchBookmarks,
  }
}