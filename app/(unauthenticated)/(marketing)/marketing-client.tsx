'use client'

import { DomainSearch } from '@/components/domain-search/domain-search'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '@/components/theme-toggle'
import { AuthButton } from '@/components/auth/auth-button'
import { useState, useEffect, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Search, Bookmark } from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

function MarketingContent() {
  const [hasContent, setHasContent] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  
  // Get initial values from URL
  const initialQuery = searchParams.get('q') || ''
  const initialMode = searchParams.get('mode') as 'domain' | 'suggestion' | null
  
  // Set initial hasContent based on URL params
  useEffect(() => {
    if (initialQuery) {
      setHasContent(true)
    }
  }, [initialQuery])
  
  const handleQueryChange = (query: string) => {
    setHasContent(query.trim().length > 0)
  }
  
  const handleResultsChange = (results: boolean) => {
    setHasResults(results)
  }
  
  // Unified animation configuration
  const animationConfig = {
    duration: 0.4,
    ease: "easeInOut" as const
  }
  return (
    <>
      {/* Header buttons - Outside AnimatePresence to prevent re-mounting */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <AuthButton />
        <ThemeToggle />
      </div>
      
      <AnimatePresence mode="wait">
        <motion.main 
          className="min-h-screen bg-background relative flex items-center"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ 
            duration: 0.3,
            ease: "easeInOut"
          }}
        >
          <div 
            className={cn(
              "container mx-auto px-4 w-full transition-all duration-400",
              hasResults ? "py-8 sm:py-12 lg:py-16" : ""
            )}
          >
        <motion.div 
          className="text-center mb-12"
          initial="initial"
          animate="animate"
          variants={{
            animate: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
        >
          <motion.h1 
            className={cn(
              "font-bold text-foreground mb-2 transition-all",
              hasResults 
                ? "text-xl sm:text-2xl lg:text-3xl" 
                : "text-2xl sm:text-4xl lg:text-6xl"
            )}
            initial={fadeInUp.initial}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={animationConfig}
          >
            Wicked Simple Domains
          </motion.h1>
          <motion.p
            className={cn(
              "text-muted-foreground transition-all",
              hasResults
                ? "text-sm sm:text-base"
                : "text-base sm:text-lg lg:text-xl"
            )}
            initial={fadeInUp.initial}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              ...animationConfig,
              delay: 0.1
            }}
          >
            Find and check available domain names instantly using AI
          </motion.p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.2,
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
        >
          {user && !authLoading ? (
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
                <TabsTrigger value="search" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="bookmarks" className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Bookmarks
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="search" className="mt-0">
                <DomainSearch 
                  className="mb-16" 
                  onQueryChange={handleQueryChange} 
                  onResultsChange={handleResultsChange}
                  initialQuery={initialQuery}
                  initialMode={initialMode || undefined}
                />
              </TabsContent>
              
              <TabsContent value="bookmarks" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-16"
                >
                  <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground">
                    Your bookmarked domains will appear here
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Coming soon...
                  </p>
                </motion.div>
              </TabsContent>
            </Tabs>
          ) : (
            <DomainSearch 
              className="mb-16" 
              onQueryChange={handleQueryChange} 
              onResultsChange={handleResultsChange}
              initialQuery={initialQuery}
              initialMode={initialMode || undefined}
            />
          )}
        </motion.div>
        
          </div>
        </motion.main>
      </AnimatePresence>
    </>
  )
}

export default function MarketingClient() {
  return (
    <Suspense fallback={null}>
      <MarketingContent />
    </Suspense>
  )
}