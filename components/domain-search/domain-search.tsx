'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import debounce from 'lodash.debounce'
import { Search, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { detectSearchMode } from '@/lib/domain-utils'
import { DomainResults } from './domain-results'
import { SuggestionResults } from './suggestion-results'
import { EvaluationScore } from './evaluation-score'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'

interface DomainSearchProps {
  className?: string
  onQueryChange?: (query: string) => void
  onResultsChange?: (hasResults: boolean) => void
  initialQuery?: string
  initialMode?: 'domain' | 'suggestion'
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

function DomainSearchInner({ className, onQueryChange, onResultsChange, initialQuery = '', initialMode }: DomainSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [searchMode, setSearchMode] = useState<'domain' | 'suggestion'>(initialMode || 'domain')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Searching...')
  const [domainResults, setDomainResults] = useState<DomainResult[]>([])
  const [suggestionResults, setSuggestionResults] = useState<SuggestionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSingleLine, setIsSingleLine] = useState(true)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSearchedQuery = useRef<string>('')
  const searchParams = useSearchParams()
  const isInitialLoad = useRef(true)

  // Initialize session ID on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('domain_search_session')) {
      // Generate a UUID v4
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
      localStorage.setItem('domain_search_session', uuid)
    }
  }, [])


  // Update URL with search parameters
  const updateURL = useCallback((searchQuery: string, mode: 'domain' | 'suggestion') => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (searchQuery) {
      params.set('q', searchQuery)
      params.set('mode', mode)
    } else {
      params.delete('q')
      params.delete('mode')
    }
    
    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname
    // Use replaceState to avoid navigation and history changes
    window.history.replaceState({}, '', newURL)
  }, [searchParams])

  // Create debounced search function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, skipURLUpdate = false) => {
      // Get the actual content without just whitespace/newlines
      const trimmedQuery = searchQuery.trim()
      
      if (!trimmedQuery) {
        setDomainResults([])
        setSuggestionResults([])
        setError(null)
        setCurrentSearchId(null)
        lastSearchedQuery.current = ''
        if (!skipURLUpdate) updateURL('', 'domain')
        return
      }

      // Skip if this exact query was just searched
      if (trimmedQuery === lastSearchedQuery.current) {
        return
      }

      const mode = detectSearchMode(trimmedQuery)
      setSearchMode(mode)

      // For suggestion mode, require at least 3 characters
      if (mode === 'suggestion' && trimmedQuery.length < 3) {
        setDomainResults([])
        setSuggestionResults([])
        setError(null)
        setCurrentSearchId(null)
        return
      }

      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Update last searched query
      lastSearchedQuery.current = trimmedQuery

      setIsLoading(true)
      setError(null)
      setLoadingMessage(mode === 'domain' ? 'Checking availability...' : 'Finding perfect domains for you...')

      try {
        if (mode === 'domain') {
          const sessionId = localStorage.getItem('domain_search_session')
          const response = await fetch('/api/domains/check', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-session-id': sessionId || ''
            },
            body: JSON.stringify({ domain: trimmedQuery }),
            signal: abortControllerRef.current.signal
          })
          
          const data = await response.json()
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to check domain')
          }
          
          setDomainResults(data.results)
          setSuggestionResults([])
          setCurrentSearchId(null) // Domain mode doesn't have scores
          
          // Update URL after successful results
          if (!skipURLUpdate) updateURL(trimmedQuery, mode)
        } else {
          const sessionId = localStorage.getItem('domain_search_session')
          const response = await fetch('/api/domains/suggest', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-session-id': sessionId || ''
            },
            body: JSON.stringify({ query: trimmedQuery }),
            signal: abortControllerRef.current.signal
          })
          
          const data = await response.json()
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to get suggestions')
          }
          
          console.log('Received suggestions:', data.suggestions)
          setSuggestionResults(data.suggestions || [])
          setDomainResults([])
          setCurrentSearchId(data.searchId || null) // Set the search ID for score polling
          
          // Update URL after successful results
          if (!skipURLUpdate) updateURL(trimmedQuery, mode)
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }, 800), // Increased from 500ms to reduce API calls during typing
    [updateURL]
  )

  // Handle initial load from URL parameters
  useEffect(() => {
    if (isInitialLoad.current && initialQuery) {
      isInitialLoad.current = false
      // Set initial mode based on query
      const mode = detectSearchMode(initialQuery)
      setSearchMode(mode)
      setIsSingleLine(!initialQuery.includes('\n'))
      // Skip URL update on initial load since we're loading from URL
      debouncedSearch(initialQuery, true)
    } else if (isInitialLoad.current) {
      // No initial query, mark as loaded
      isInitialLoad.current = false
    }
  }, [initialQuery, debouncedSearch])

  useEffect(() => {
    // Always trigger search when query changes
    debouncedSearch(query)
    
    // Cleanup function
    return () => {
      debouncedSearch.cancel()
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, debouncedSearch])

  // Check for overflow on mount and when query changes
  useEffect(() => {
    if (textareaRef.current) {
      const hasScroll = textareaRef.current.scrollHeight > textareaRef.current.clientHeight
      setHasOverflow(hasScroll)
      
      // Check if at bottom
      if (hasScroll) {
        const { scrollTop, scrollHeight, clientHeight } = textareaRef.current
        const atBottom = scrollTop + clientHeight >= scrollHeight - 5 // 5px threshold
        setIsAtBottom(atBottom)
      } else {
        setIsAtBottom(true)
      }
    }
  }, [query])
  
  // Notify parent when results change
  useEffect(() => {
    if (onResultsChange) {
      const hasResults = domainResults.length > 0 || suggestionResults.length > 0
      onResultsChange(hasResults)
    }
  }, [domainResults, suggestionResults, onResultsChange])
  
  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (textareaRef.current && hasOverflow) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current
      const atBottom = scrollTop + clientHeight >= scrollHeight - 5 // 5px threshold
      setIsAtBottom(atBottom)
    }
  }, [hasOverflow])

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
          className={cn(
            "absolute left-3 z-10",
            isSingleLine ? "top-1/2 -translate-y-1/2" : "top-3"
          )}
        >
          <Search className="text-muted-foreground h-5 w-5" />
        </motion.div>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => {
              const newValue = e.target.value
              setQuery(newValue)
              // Check if it's single line (no newlines)
              setIsSingleLine(!newValue.includes('\n'))
              
              // Check for overflow
              if (textareaRef.current) {
                const hasScroll = textareaRef.current.scrollHeight > textareaRef.current.clientHeight
                setHasOverflow(hasScroll)
              }
              
              // Call the onQueryChange callback if provided
              if (onQueryChange) {
                onQueryChange(newValue)
              }
            }}
            onScroll={handleScroll}
            className={cn(
              "pl-10 pr-10 min-h-[40px] sm:min-h-[56px] max-h-[300px] text-sm sm:text-base lg:text-lg rounded-xl shadow-lg border-input focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none overflow-y-auto transition-all duration-300",
              isSingleLine ? "py-2 sm:py-3 lg:py-4" : "py-1 sm:py-2"
            )}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={(e) => {
              // Allow Enter to create new lines instead of submitting
              if (e.key === 'Enter' && !e.shiftKey) {
                e.stopPropagation()
              }
            }}
          />
          {hasOverflow && !isAtBottom && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />
          )}
        </div>
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className={cn(
                "absolute right-3",
                isSingleLine ? "top-1/2 -translate-y-1/2" : "top-3"
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
        {!error && query.trim() && !isLoading && (
          <motion.div 
            className="mt-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {searchMode === 'domain' && domainResults.length > 0 && (
                <motion.div
                  key="domain-results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <DomainResults results={domainResults} searchQuery={query.trim()} />
                </motion.div>
              )}
              {searchMode === 'suggestion' && suggestionResults.length > 0 && (
                <motion.div
                  key="suggestion-results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <SuggestionResults results={suggestionResults} searchQuery={query.trim()} />
                  <EvaluationScore searchId={currentSearchId} className="mt-6 pt-6 border-t" />
                </motion.div>
              )}
              {searchMode === 'suggestion' && suggestionResults.length === 0 && (
                <motion.div 
                  className="text-center py-8 text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  No available domains found. Try a different search term.
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function DomainSearch(props: DomainSearchProps) {
  return (
    <Suspense fallback={null}>
      <DomainSearchInner {...props} />
    </Suspense>
  )
}