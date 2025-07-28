'use client'

import { Check, ExternalLink } from 'lucide-react'
import { EXTENSION_PRICES } from '@/lib/domain-utils'
import { motion } from 'framer-motion'

interface SuggestionResult {
  domain: string
  available: boolean
  extension: string
  reason?: string
}

interface SuggestionResultsProps {
  results: SuggestionResult[]
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

export function SuggestionResults({ results }: SuggestionResultsProps) {
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
        AI-Powered Suggestions
      </motion.h3>
      {results.map((result, index) => (
        <motion.div
          key={`${result.domain}-${index}`}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-card border border-border rounded-lg min-h-[56px] gap-3"
          variants={item}
          whileHover={{ 
            scale: 1.02,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.08 + 0.2, type: "spring", stiffness: 400, damping: 20 }}
              >
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              </motion.div>
              <span className="text-lg text-foreground">{result.domain}</span>
            </div>
            {result.reason && (
              <motion.p 
                className="mt-1 ml-8 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08 + 0.3 }}
              >
                {result.reason}
              </motion.p>
            )}
          </div>
          
          <div className="flex items-center space-x-4 sm:ml-4">
            <span className="text-lg font-medium text-foreground whitespace-nowrap">
              ${EXTENSION_PRICES[result.extension] || 29.99}/year
            </span>
            <motion.a
              href={`https://www.namecheap.com/domains/registration/results/?domain=${result.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label={`Register ${result.domain}`}
              whileHover={{ scale: 1.1 }}
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