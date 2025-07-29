'use client'

import { Check, X, ExternalLink, Share2 } from 'lucide-react'
import { EXTENSION_PRICES } from '@/lib/domain-utils'
import { motion, useReducedMotion } from 'framer-motion'
import { useCallback } from 'react'
import { toast } from 'sonner'

interface DomainResult {
  domain: string
  available: boolean
  extension: string
  requested?: boolean
  suggested?: boolean
}

interface DomainResultsProps {
  results: DomainResult[]
  searchQuery?: string
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

export function DomainResults({ results, searchQuery }: DomainResultsProps) {
  const shouldReduceMotion = useReducedMotion()
  
  // Sort results: requested first (if any), then exact matches, then suggestions
  const sortedResults = [...results].sort((a, b) => {
    if (a.requested) return -1
    if (b.requested) return 1
    if (!a.suggested && b.suggested) return -1
    if (a.suggested && !b.suggested) return 1
    return 0
  })

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
  
  const handleShare = useCallback(async () => {
    try {
      const url = window.location.href
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy link')
      console.error('Error copying to clipboard:', error)
    }
  }, [])
  
  return (
    <motion.div 
      className="space-y-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div 
        className="flex items-center justify-between mb-4"
        variants={item}
      >
        <h3 className="text-sm font-medium text-muted-foreground">
          Available Domains
        </h3>
        {searchQuery && (
          <motion.button
            onClick={handleShare}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Share search results"
          >
            <Share2 className="h-4 w-4" />
          </motion.button>
        )}
      </motion.div>
      
      {sortedResults.map((result, index) => (
        <motion.div
          key={result.domain}
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg min-h-[64px] gap-3 ${
            result.requested && !result.available 
              ? 'bg-red-50 border-2 border-red-200'
              : 'bg-card border border-border'
          }`}
          variants={item}
          whileHover={shouldReduceMotion ? {} : { 
            scale: 1.02,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
          }}
          whileTap={shouldReduceMotion ? {} : { scale: 0.99 }}
          transition={shouldReduceMotion ? {} : { type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05 + 0.1, type: "spring", stiffness: 400, damping: 20 }}
              className="flex-shrink-0"
            >
              {result.available ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <X className="h-5 w-5 text-red-500" />
              )}
            </motion.div>
            <span className={`text-lg font-medium ${
              result.available ? 'text-foreground' : 'text-muted-foreground'
            } truncate`}>
              {result.domain}
            </span>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-4 sm:ml-4 pl-8 sm:pl-0">
            {result.available && (
              <>
                <span className="text-lg font-semibold text-foreground whitespace-nowrap">
                  ${EXTENSION_PRICES[result.extension] || 29.99}/year
                </span>
                <motion.a
                  href={`https://www.namecheap.com/domains/registration/results/?domain=${result.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 sm:p-2.5 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors touch-manipulation"
                  aria-label={`Register ${result.domain}`}
                  onClick={() => trackClick(result.domain)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ExternalLink className="h-5 w-5" />
                </motion.a>
              </>
            )}
            {!result.available && (
              <span className="text-sm text-muted-foreground">Taken</span>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}