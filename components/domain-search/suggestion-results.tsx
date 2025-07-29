'use client'

import { Check, ExternalLink, Share2 } from 'lucide-react'
import { EXTENSION_PRICES } from '@/lib/domain-utils'
import { motion, useReducedMotion } from 'framer-motion'
import { useCallback } from 'react'
import { toast } from 'sonner'

interface SuggestionResult {
  domain: string
  available: boolean
  extension: string
  reason?: string
}

interface SuggestionResultsProps {
  results: SuggestionResult[]
  searchQuery?: string
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function SuggestionResults({ results, searchQuery }: SuggestionResultsProps) {
  const shouldReduceMotion = useReducedMotion()
  
  const handleDomainClick = useCallback(async (domain: string) => {
    try {
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
        }),
      })
    } catch (error) {
      console.error('Failed to track domain click:', error)
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
          AI-Powered Suggestions
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
      {results.map((result, index) => (
        <motion.div
          key={`${result.domain}-${index}`}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-card border border-border rounded-lg min-h-[64px] gap-3 sm:gap-4"
          variants={item}
          whileHover={shouldReduceMotion ? {} : { 
            scale: 1.01,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
          }}
          whileTap={shouldReduceMotion ? {} : { scale: 0.99 }}
          transition={shouldReduceMotion ? {} : { type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.08 + 0.2, type: "spring", stiffness: 400, damping: 20 }}
                className="flex-shrink-0"
              >
                <Check className="h-5 w-5 text-green-500" />
              </motion.div>
              <span className="text-lg font-medium text-foreground truncate">{result.domain}</span>
            </div>
            {result.reason && (
              <motion.p 
                className="mt-1.5 ml-8 text-sm text-muted-foreground line-clamp-2 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08 + 0.3 }}
              >
                {result.reason}
              </motion.p>
            )}
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-4 sm:ml-4 pl-8 sm:pl-0">
            <span className="text-lg font-semibold text-foreground whitespace-nowrap">
              ${EXTENSION_PRICES[result.extension] || 29.99}/year
            </span>
            <motion.a
              href={`https://www.namecheap.com/domains/registration/results/?domain=${result.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 sm:p-2.5 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors touch-manipulation"
              aria-label={`Register ${result.domain}`}
              onClick={() => handleDomainClick(result.domain)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ExternalLink className="h-5 w-5" />
            </motion.a>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}