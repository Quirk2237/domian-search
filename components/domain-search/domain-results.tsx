'use client'

import { Check, X, ExternalLink } from 'lucide-react'
import { EXTENSION_PRICES } from '@/lib/domain-utils'
import { motion } from 'framer-motion'
import { useCallback } from 'react'

interface DomainResult {
  domain: string
  available: boolean
  extension: string
  requested?: boolean
  suggested?: boolean
}

interface DomainResultsProps {
  results: DomainResult[]
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

export function DomainResults({ results }: DomainResultsProps) {
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
  
  return (
    <motion.div 
      className="space-y-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.h3 
        className="text-sm font-medium text-muted-foreground mb-4"
        variants={item}
      >
        Available Domains
      </motion.h3>
      
      {sortedResults.map((result, index) => (
        <motion.div
          key={result.domain}
          className={`flex items-center justify-between p-4 rounded-lg min-h-[56px] ${
            result.requested && !result.available 
              ? 'bg-red-50 border-2 border-red-200'
              : 'bg-card border border-border'
          }`}
          variants={item}
          whileHover={{ 
            scale: 1.02,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="flex items-center space-x-3">
            {result.available ? (
              <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <X className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-lg ${
              result.available ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {result.domain}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {result.available && (
              <>
                <span className="text-lg font-medium text-foreground">
                  ${EXTENSION_PRICES[result.extension] || 29.99}/year
                </span>
                <a
                  href={`https://www.namecheap.com/domains/registration/results/?domain=${result.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label={`Register ${result.domain}`}
                  onClick={() => trackClick(result.domain)}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
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