'use client'

import { DomainSearch } from '@/components/domain-search/domain-search'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function MarketingPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {/* Theme Toggle Button - Outside AnimatePresence to prevent re-mounting */}
      {mounted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 right-4 z-50"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="bg-background/80 backdrop-blur-sm hover:bg-accent"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </motion.div>
      )}
      
      <AnimatePresence mode="wait">
        <motion.main 
          key={theme}
          className="min-h-screen bg-background relative"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ 
            duration: 0.3,
            ease: "easeInOut"
          }}
        >
          <div className="container mx-auto px-4 py-16 sm:py-24">
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
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4"
            variants={fadeInUp}
          >
            Wicked Simple Domains
          </motion.h1>
          <motion.p 
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            Find the perfect domain name for your idea in seconds. 
            Powered by AI suggestions and instant availability checking.
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
          <DomainSearch className="mb-16" />
        </motion.div>
        
        <motion.div 
          className="text-center text-sm text-muted-foreground mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <p>Over 1,000+ domain names found and registered</p>
        </motion.div>
      </div>
        </motion.main>
      </AnimatePresence>
    </>
  )
}