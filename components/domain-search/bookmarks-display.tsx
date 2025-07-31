'use client'

import { Check, X, ExternalLink, Trash2, Calendar } from 'lucide-react'
import { EXTENSION_PRICES } from '@/lib/domain-utils'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useBookmarks } from '@/hooks/use-bookmarks'
import { useAuth } from '@/hooks/use-auth'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { AnimatedBookmarkButton } from '@/components/ui/animated-bookmark-button'

interface BookmarkedDomain {
  id: string
  domain: string
  extension: string
  available?: boolean
  bookmarkedAt: Date
  isPremium?: boolean
  price?: number
}

interface BookmarksDisplayProps {
  className?: string
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
}

const emptyStateVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  }
}

export function BookmarksDisplay({ className }: BookmarksDisplayProps) {
  const shouldReduceMotion = useReducedMotion()
  const { user } = useAuth()
  const { bookmarks, loading, toggleBookmark } = useBookmarks()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState<Set<string>>(new Set())

  // Convert bookmarks to display format
  const bookmarkedDomains: BookmarkedDomain[] = bookmarks.map(bookmark => ({
    id: bookmark.id,
    domain: `${bookmark.domain}.${bookmark.extension}`,
    extension: bookmark.extension,
    bookmarkedAt: new Date(bookmark.created_at),
    // We'll add availability checking later
    available: undefined,
    isPremium: false,
    price: EXTENSION_PRICES[bookmark.extension] || 29.99
  }))

  const trackClick = useCallback(async (domain: string) => {
    try {
      // Get session ID from localStorage
      const sessionId = localStorage.getItem('domain_search_session')
      if (!sessionId) return

      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          sessionId
        })
      })
    } catch (error) {
      console.error('Error tracking click:', error)
    }
  }, [])

  const handleRemoveBookmark = useCallback(async (bookmark: BookmarkedDomain) => {
    const domainParts = bookmark.domain.split('.')
    const domainName = domainParts.slice(0, -1).join('.')
    const extension = bookmark.extension
    
    const response = await toggleBookmark(domainName, extension)
    
    if (response?.requiresAuth) {
      setAuthDialogOpen(true)
    } else if (response?.success) {
      toast.success('Bookmark removed', {
        description: `${bookmark.domain} has been removed from your bookmarks`,
        duration: 3000,
      })
    }
  }, [toggleBookmark])

  const checkAvailability = useCallback(async (bookmark: BookmarkedDomain) => {
    const domainKey = bookmark.domain
    if (checkingAvailability.has(domainKey)) return

    setCheckingAvailability(prev => new Set(prev).add(domainKey))

    try {
      const sessionId = localStorage.getItem('domain_search_session')
      const response = await fetch('/api/domains/check', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session-id': sessionId || ''
        },
        body: JSON.stringify({ domain: bookmark.domain }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.results?.[0]) {
        const result = data.results[0]
        // Update the bookmark's availability status
        // Note: In a real implementation, you'd want to update this in state
        toast.info(`${bookmark.domain} is ${result.available ? 'available' : 'taken'}`, {
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      toast.error('Failed to check availability')
    } finally {
      setCheckingAvailability(prev => {
        const newSet = new Set(prev)
        newSet.delete(domainKey)
        return newSet
      })
    }
  }, [checkingAvailability])

  const formatBookmarkedDate = (date: Date) => {
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <motion.div 
        className="space-y-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Your Bookmarks
          </h3>
        </div>
        
        {/* Loading skeleton */}
        {[...Array(3)].map((_, index) => (
          <motion.div
            key={index}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg min-h-[64px] gap-3 bg-card border border-border"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded animate-pulse" />
              <div className="w-32 h-6 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 h-6 bg-muted rounded animate-pulse" />
              <div className="w-8 h-8 bg-muted rounded animate-pulse" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    )
  }

  if (bookmarkedDomains.length === 0) {
    return (
      <motion.div
        className="text-center py-16 text-muted-foreground"
        variants={emptyStateVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="space-y-4"
        >
          <div className="relative mx-auto w-16 h-16 opacity-20">
            <motion.div
              initial={{ rotate: -15 }}
              animate={{ rotate: 0 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
            >
              <svg
                className="w-16 h-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                />
              </svg>
            </motion.div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">No bookmarks yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
              Start searching for domains and bookmark the ones you like. They'll appear here for easy access.
            </p>
          </div>
          <motion.div
            className="pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <div className="text-sm text-muted-foreground/60">
              Click the bookmark icon when viewing search results
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className={`space-y-3 ${className || ''}`}
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div 
        className="flex items-center justify-between mb-4"
        variants={item}
      >
        <h3 className="text-sm font-medium text-muted-foreground">
          Your Bookmarks ({bookmarkedDomains.length})
        </h3>
      </motion.div>
      
      <AnimatePresence>
        {bookmarkedDomains.map((bookmark, index) => {
          const isChecking = checkingAvailability.has(bookmark.domain)
          
          return (
            <motion.div
              key={bookmark.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg min-h-[64px] gap-3 bg-card border border-border"
              variants={item}
              whileHover={shouldReduceMotion ? {} : { 
                scale: 1.02,
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
              }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.99 }}
              transition={shouldReduceMotion ? {} : { type: "spring", stiffness: 300, damping: 25 }}
              layout
              exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 + 0.1, type: "spring", stiffness: 400, damping: 20 }}
                  className="flex-shrink-0"
                >
                  {bookmark.available === true ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : bookmark.available === false ? (
                    <X className="h-5 w-5 text-red-500" />
                  ) : (
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 border-muted-foreground/20 cursor-pointer hover:border-[#9F7BE7] transition-colors"
                      onClick={() => checkAvailability(bookmark)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      animate={isChecking ? { rotate: 360 } : {}}
                      transition={isChecking ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                    />
                  )}
                </motion.div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium text-foreground truncate">
                      {bookmark.domain}
                    </span>
                    {bookmark.isPremium && (
                      <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                        Premium
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Bookmarked {formatBookmarkedDate(bookmark.bookmarkedAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:ml-4 pl-8 sm:pl-0">
                <span className="text-lg font-semibold text-foreground whitespace-nowrap">
                  ${bookmark.price}/year
                </span>
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => handleRemoveBookmark(bookmark)}
                    className="p-3 sm:p-2.5 text-red-500 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors touch-manipulation"
                    aria-label={`Remove ${bookmark.domain} from bookmarks`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                  <motion.a
                    href={`https://www.namecheap.com/domains/registration/results/?domain=${bookmark.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 sm:p-2.5 text-[#9F7BE7] hover:bg-purple-50 active:bg-purple-100 rounded-lg transition-colors touch-manipulation"
                    aria-label={`Register ${bookmark.domain}`}
                    onClick={() => trackClick(bookmark.domain)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </motion.a>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
      
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </motion.div>
  )
}