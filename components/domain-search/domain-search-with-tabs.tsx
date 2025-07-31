'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EnhancedSearchInput } from '@/components/ui/enhanced-search-input'
import { CustomTabs } from './custom-tabs'
import { DomainResults } from './domain-results'
import { SuggestionResults } from './suggestion-results'
import { EvaluationScore } from './evaluation-score'
import { BookmarksTab } from './bookmarks-tab'
import { Bookmark } from 'lucide-react'
import { detectSearchMode } from '@/lib/domain-utils'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

interface DomainSearchWithTabsProps {
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
  requested?: boolean
  suggested?: boolean
}

interface SuggestionResult {
  domain: string
  available: boolean
  extension: string
  reason?: string
}

function DomainSearchWithTabsInner({ 
  className, 
  onQueryChange, 
  onResultsChange, 
  initialQuery = '', 
  initialMode 
}: DomainSearchWithTabsProps) {
  const [query, setQuery] = useState(initialQuery)
  const [searchMode, setSearchMode] = useState<'domain' | 'suggestion'>(initialMode || 'domain')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Searching...')
  const [domainResults, setDomainResults] = useState<DomainResult[]>([])
  const [suggestionResults, setSuggestionResults] = useState<SuggestionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [inputHeight, setInputHeight] = useState(24)
  const [isSingleLine, setIsSingleLine] = useState(true)
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'search' | 'bookmarks'>('search')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const searchParams = useSearchParams()
  const isInitialLoad = useRef(true)
  const { user, loading: authLoading } = useAuth()

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

  const handleSearch = useCallback(async (skipURLUpdate = false) => {
    // Get the actual content without just whitespace/newlines
    const trimmedQuery = query.trim()
    
    if (!trimmedQuery) {
      setDomainResults([])
      setSuggestionResults([])
      setError(null)
      setCurrentSearchId(null)
      if (!skipURLUpdate) updateURL('', 'domain')
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
  }, [query, updateURL])

  // Handle initial load from URL parameters
  useEffect(() => {
    if (isInitialLoad.current && initialQuery) {
      isInitialLoad.current = false
      // Set initial mode based on query
      const mode = detectSearchMode(initialQuery)
      setSearchMode(mode)
      setIsSingleLine(!initialQuery.includes('\n'))
      // Skip URL update on initial load since we're loading from URL
      handleSearch(true)
    } else if (isInitialLoad.current) {
      // No initial query, mark as loaded
      isInitialLoad.current = false
    }
  }, [initialQuery, handleSearch])

  // Handle height changes for smooth animations
  const handleHeightChange = useCallback((newHeight: number) => {
    setInputHeight(newHeight)
  }, [])
  
  // Notify parent when results change
  useEffect(() => {
    if (onResultsChange) {
      const hasResults = domainResults.length > 0 || suggestionResults.length > 0
      onResultsChange(hasResults)
    }
  }, [domainResults, suggestionResults, onResultsChange])


  const hasResults = domainResults.length > 0 || suggestionResults.length > 0
  const showTabs = user && !authLoading  // Only show tabs when user is logged in
  // Simplified: always show content when tabs are shown and activeTab is bookmarks, or when search has results
  const showTabContent = showTabs && (activeTab === 'bookmarks' || (activeTab === 'search' && query.trim() !== '' && hasResults && !error && !isLoading))

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      <div className="relative">
        <EnhancedSearchInput
          ref={textareaRef}
          value={query}
          onChange={(e) => {
            const newValue = e.target.value
            setQuery(newValue)
            // Check if it's single line (no newlines)
            setIsSingleLine(!newValue.includes('\n'))
            
            // Clear results when query changes
            if (newValue.trim() !== query.trim()) {
              setDomainResults([])
              setSuggestionResults([])
              setCurrentSearchId(null)
              setError(null)
            }
            
            // Clear URL when input is cleared
            if (!newValue.trim()) {
              updateURL('', 'domain')
            }
            
            // Call the onQueryChange callback if provided
            if (onQueryChange) {
              onQueryChange(newValue)
            }
          }}
          onHeightChange={handleHeightChange}
          onSearch={() => handleSearch()}
          isLoading={isLoading}
          searchDisabled={!query.trim()}
          className="text-base placeholder:text-muted-foreground"
          placeholder=""
          minHeight={24}
          maxHeight={500}
        />

        {/* Custom tabs positioned under the search input */}
        <AnimatePresence>
          {showTabs && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                mass: 0.8
              }}
            >
              <CustomTabs
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab)
                  // Focus the search input when switching to search tab
                  if (tab === 'search' && textareaRef.current) {
                    textareaRef.current.focus()
                  }
                }}
                className="justify-center"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error display */}
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

      {/* Tab content with results for logged-in users */}
      {showTabs && (
        <AnimatePresence mode="wait">
          {showTabContent && (
            <motion.div
              className="mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.4,
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
            >
              <AnimatePresence mode="wait">
                {activeTab === 'search' && (
                  <motion.div
                    key="search-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AnimatePresence mode="wait">
                      {searchMode === 'domain' && domainResults.length > 0 && (
                        <motion.div
                          key="domain-results"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ 
                            duration: 0.3,
                            type: "spring",
                            stiffness: 100,
                            damping: 15
                          }}
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
                          transition={{ 
                            duration: 0.3,
                            type: "spring",
                            stiffness: 100,
                            damping: 15
                          }}
                          className="space-y-4"
                        >
                          <SuggestionResults results={suggestionResults} searchQuery={query.trim()} />
                          <EvaluationScore searchId={currentSearchId} className="mt-6 pt-6 border-t" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {activeTab === 'bookmarks' && (
                  <motion.div
                    key="bookmarks-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BookmarksTab />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Regular results for non-logged-in users */}
      {!showTabs && (
        <AnimatePresence mode="wait">
          {!error && query.trim() && !isLoading && (domainResults.length > 0 || suggestionResults.length > 0) && (
            <motion.div 
              className="mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

export function DomainSearchWithTabs(props: DomainSearchWithTabsProps) {
  return (
    <Suspense fallback={null}>
      <DomainSearchWithTabsInner {...props} />
    </Suspense>
  )
}