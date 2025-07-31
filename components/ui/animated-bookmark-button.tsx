'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnimatedBookmarkButtonProps {
  isBookmarked: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function AnimatedBookmarkButton({
  isBookmarked,
  onToggle,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: AnimatedBookmarkButtonProps) {
  const shouldReduceMotion = useReducedMotion()

  const handleClick = () => {
    if (disabled) return
    onToggle()
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative h-10 w-10 sm:h-9 sm:w-9 rounded-lg transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-95',
        className
      )}
      whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      
      <motion.div
        className="relative flex items-center justify-center h-full w-full"
        initial={false}
        animate={isBookmarked ? { rotate: 0 } : { rotate: 0 }}
        whileHover={shouldReduceMotion ? {} : { rotate: isBookmarked ? -5 : 5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div
          initial={false}
          animate={isBookmarked ? {
            scale: 1,
            rotate: 0,
          } : {
            scale: 1,
            rotate: 0,
          }}
          whileTap={shouldReduceMotion ? {} : {
            scale: 1.2,
            rotate: isBookmarked ? -15 : 15,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 500, 
            damping: 15,
            duration: 0.15
          }}
        >
          <Bookmark
            className={cn(
              'h-4 w-4 transition-all duration-200',
              isBookmarked
                ? 'fill-yellow-400 text-yellow-500'
                : 'fill-none text-muted-foreground hover:text-foreground'
            )}
          />
        </motion.div>
      </motion.div>

      {/* Sparkle effect when bookmarked */}
      {isBookmarked && !shouldReduceMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full"
              initial={{
                opacity: 0,
                scale: 0,
                x: '50%',
                y: '50%',
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: ['50%', `${50 + (i - 1) * 30}%`],
                y: ['50%', `${50 + (i % 2 === 0 ? -20 : 20)}%`],
              }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.button>
  )
}