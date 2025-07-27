'use client'

import { DomainSearch } from '@/components/domain-search/domain-search'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState } from 'react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function MarketingPage() {
  const [hasContent, setHasContent] = useState(false)
  
  const handleQueryChange = (query: string) => {
    setHasContent(query.trim().length > 0)
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
          <motion.div 
            className="container mx-auto px-4 w-full"
            animate={{
              paddingTop: hasContent ? '4rem' : '0',
              paddingBottom: hasContent ? '4rem' : '0'
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
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
            className="font-bold text-foreground mb-4 transition-all duration-500"
            variants={fadeInUp}
            animate={{
              fontSize: hasContent ? '1.875rem' : '3.75rem' // text-3xl vs text-6xl
            }}
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
          <DomainSearch className="mb-16" onQueryChange={handleQueryChange} />
        </motion.div>
        
        <AnimatePresence>
          {!hasContent && (
            <motion.div 
              className="text-center text-sm text-muted-foreground mt-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p>Enter a word or describe your idea to get started</p>
            </motion.div>
          )}
        </AnimatePresence>
          </motion.div>
        </motion.main>
      </AnimatePresence>
    </>
  )
}