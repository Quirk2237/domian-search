'use client'

import { DomainSearch } from '@/components/domain-search/domain-search'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function MarketingPage() {
  const [hasContent, setHasContent] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  
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
      {/* Theme Toggle Button - Outside AnimatePresence to prevent re-mounting */}
      <div className="fixed top-4 right-4 z-50">
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
              "font-bold text-foreground mb-4 transition-all",
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
          <DomainSearch className="mb-16" onQueryChange={handleQueryChange} onResultsChange={handleResultsChange} />
        </motion.div>
        
        <AnimatePresence>
          {!hasContent && (
            <motion.div 
              className="text-center text-sm text-muted-foreground mt-16"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={animationConfig}
            >
              <p>Enter a word or describe your idea to get started.</p>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </motion.main>
      </AnimatePresence>
    </>
  )
}