'use client'

import { DomainSearch } from '@/components/domain-search/domain-search'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from '@/components/theme-toggle'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function MarketingPage() {
  return (
    <>
      {/* Theme Toggle Button - Outside AnimatePresence to prevent re-mounting */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <AnimatePresence mode="wait">
        <motion.main 
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