'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DomainResults } from './domain-results'
import { SuggestionResults } from './suggestion-results'
import { EvaluationScore } from './evaluation-score'
import { Bookmark, Search } from 'lucide-react'

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

interface DomainSearchTabsProps {
  searchMode: 'domain' | 'suggestion'
  domainResults: DomainResult[]
  suggestionResults: SuggestionResult[]
  searchQuery: string
  currentSearchId: string | null
  isVisible: boolean
}

export function DomainSearchTabs({
  searchMode,
  domainResults,
  suggestionResults,
  searchQuery,
  currentSearchId,
  isVisible
}: DomainSearchTabsProps) {
  const hasResults = domainResults.length > 0 || suggestionResults.length > 0

  if (!isVisible || !hasResults) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        transition={{ 
          duration: 0.4,
          type: "spring",
          stiffness: 100,
          damping: 15
        }}
      >
        <Tabs defaultValue="search" className="w-full">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto mb-6">
              <TabsTrigger 
                value="search" 
                className="flex items-center gap-2 text-sm font-medium transition-all duration-200"
              >
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger 
                value="bookmarks"
                className="flex items-center gap-2 text-sm font-medium transition-all duration-200"
              >
                <Bookmark className="h-4 w-4" />
                Bookmarks
              </TabsTrigger>
            </TabsList>
          </motion.div>

          <TabsContent value="search" className="mt-0">
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
                  <DomainResults results={domainResults} searchQuery={searchQuery} />
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
                  <SuggestionResults results={suggestionResults} searchQuery={searchQuery} />
                  <EvaluationScore searchId={currentSearchId} className="mt-6 pt-6 border-t" />
                </motion.div>
              )}
              {searchMode === 'suggestion' && suggestionResults.length === 0 && (
                <motion.div 
                  className="text-center py-12 text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No available domains found</p>
                  <p className="text-sm">Try a different search term or approach.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="bookmarks" className="mt-0">
            <motion.div
              className="text-center py-16 text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.4,
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="space-y-4"
              >
                <Bookmark className="h-16 w-16 mx-auto opacity-20" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Bookmarks Coming Soon</h3>
                  <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Save your favorite domains and keep track of the ones you want to register later.
                  </p>
                </div>
                <motion.div
                  className="pt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <div className="text-sm text-muted-foreground/60">
                    This feature is currently in development
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AnimatePresence>
  )
}