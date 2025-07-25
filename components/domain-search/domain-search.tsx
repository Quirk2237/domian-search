'use client'

import { useState, useCallback, useEffect } from 'react'
import debounce from 'lodash.debounce'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { detectSearchMode } from '@/lib/domain-utils'
import { DomainResults } from './domain-results'
import { SuggestionResults } from './suggestion-results'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface DomainSearchProps {
  className?: string
}

interface DomainResult {
  domain: string
  available: boolean
  extension: string
}

interface SuggestionResult {
  domain: string
  available: boolean
  extension: string
  reason?: string
}

export function DomainSearch({ className }: DomainSearchProps) {
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'domain' | 'suggestion'>('domain')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Searching...')
  const [domainResults, setDomainResults] = useState<DomainResult[]>([])
  const [suggestionResults, setSuggestionResults] = useState<SuggestionResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // Create debounced search function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setDomainResults([])
        setSuggestionResults([])
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      const mode = detectSearchMode(searchQuery)
      setSearchMode(mode)
      setLoadingMessage(mode === 'domain' ? 'Checking availability...' : 'Finding perfect domains for you...')

      try {
        if (mode === 'domain') {
          const response = await fetch('/api/domains/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: searchQuery })
          })
          
          if (!response.ok) throw new Error('Failed to check domain')
          
          const data = await response.json()
          setDomainResults(data.results)
          setSuggestionResults([])
        } else {
          const response = await fetch('/api/domains/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery })
          })
          
          if (!response.ok) throw new Error('Failed to get suggestions')
          
          const data = await response.json()
          console.log('Received suggestions:', data.suggestions)
          setSuggestionResults(data.suggestions || [])
          setDomainResults([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }, 150),
    []
  )

  useEffect(() => {
    debouncedSearch(query)
  }, [query, debouncedSearch])

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      <motion.div 
        className="relative"
        whileFocus={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <motion.div
          animate={{ scale: query ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        </motion.div>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a word or describe your idea"
          className="pl-10 pr-10 h-14 text-base sm:text-lg rounded-xl shadow-lg border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
            initial={{ opacity: 0, y: -10 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              x: [0, -2, 2, -2, 0]
            }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ 
              duration: 0.4,
              x: { duration: 0.4, delay: 0.2 }
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!error && query.trim() && (
          <motion.div 
            className="mt-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? (
              <motion.div 
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  animate={{ 
                    scale: [0.95, 1.05, 0.95],
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                </motion.div>
                <motion.p 
                  className="text-gray-600"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {loadingMessage}
                </motion.p>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {searchMode === 'domain' && domainResults.length > 0 && (
                  <motion.div
                    key="domain-results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DomainResults results={domainResults} />
                  </motion.div>
                )}
                {searchMode === 'suggestion' && suggestionResults.length > 0 && (
                  <motion.div
                    key="suggestion-results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SuggestionResults results={suggestionResults} />
                  </motion.div>
                )}
                {searchMode === 'suggestion' && suggestionResults.length === 0 && (
                  <motion.div 
                    className="text-center py-8 text-gray-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    No available domains found. Try a different search term.
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}