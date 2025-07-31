'use client'

import * as React from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Search, CornerDownLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AutoExpandingInput } from './auto-expanding-input'

interface EnhancedSearchInputProps extends Omit<React.ComponentProps<'textarea'>, 'rows'> {
  className?: string
  minHeight?: number
  maxHeight?: number
  onHeightChange?: (height: number) => void
  isLoading?: boolean
  onSearch?: () => void
  searchDisabled?: boolean
}

// Animation variants for icon transitions
const iconVariants: Variants = {
  search: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.25
    }
  },
  enter: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.25
    }
  },
  loading: {
    opacity: 1,
    rotate: 360,
    transition: {
      rotate: {
        duration: 1.2,
        repeat: Infinity,
        ease: "linear",
        repeatType: "loop"
      }
    }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    rotate: -10,
    transition: {
      duration: 0.2,
      ease: "easeInOut"
    }
  }
}

const EnhancedSearchInput = React.forwardRef<HTMLTextAreaElement, EnhancedSearchInputProps>(
  ({ 
    className, 
    minHeight = 24, 
    maxHeight = 500, 
    onHeightChange, 
    value, 
    onChange, 
    onKeyDown, 
    isLoading = false,
    onSearch,
    searchDisabled = false,
    ...props 
  }, ref) => {
    const [height, setHeight] = React.useState(minHeight)
    const [isFocused, setIsFocused] = React.useState(false)
    
    // Determine which icon to show
    const hasText = Boolean(value?.toString().trim())
    const currentIcon = isLoading ? 'loading' : hasText ? 'enter' : 'search'
    
    // Handle icon click
    const handleIconClick = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      if (!isLoading && hasText && !searchDisabled && onSearch) {
        onSearch()
      }
    }, [isLoading, hasText, searchDisabled, onSearch])

    // Handle key down events
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!isLoading && hasText && !searchDisabled && onSearch) {
          onSearch()
        }
      }
      onKeyDown?.(e)
    }, [isLoading, hasText, searchDisabled, onSearch, onKeyDown])

    // Handle height changes
    const handleHeightChange = React.useCallback((newHeight: number) => {
      setHeight(newHeight)
      onHeightChange?.(newHeight)
    }, [onHeightChange])

    // Get icon component and aria label
    const getIconContent = () => {
      switch (currentIcon) {
        case 'loading':
          return {
            component: <Loader2 className="h-5 w-5" />,
            label: 'Searching...',
            clickable: false
          }
        case 'enter':
          return {
            component: <CornerDownLeft className="h-5 w-5" />,
            label: 'Press Enter or click to search',
            clickable: !searchDisabled
          }
        case 'search':
        default:
          return {
            component: <Search className="h-5 w-5" />,
            label: 'Search',
            clickable: false
          }
      }
    }

    const iconContent = getIconContent()

    return (
      <motion.div 
        className={cn(
          "relative rounded-xl shadow-lg border border-input bg-background",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          "transition-all duration-200"
        )}
        animate={{ 
          borderColor: (isFocused || hasText) ? "var(--primary)" : "var(--border)",
          boxShadow: (isFocused || hasText)
            ? "0 0 0 2px rgba(var(--primary-rgb), 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" 
            : "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="pl-4 pr-12 py-3">
          <AutoExpandingInput
            ref={ref}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            onHeightChange={handleHeightChange}
            className={cn(
              "text-base placeholder:text-muted-foreground",
              className
            )}
            placeholder="Search domains or describe your business..."
            minHeight={minHeight}
            maxHeight={maxHeight}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </div>

        {/* Dynamic Icon with smooth positioning */}
        <motion.div
          className="absolute right-3 z-10 flex items-center"
          animate={{
            top: height <= 36 ? "50%" : "auto",
            bottom: height > 36 ? "12px" : "auto",
            y: height <= 36 ? "-50%" : "0%"
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: 0.3
          }}
        >
          <motion.button
            type="button"
            onClick={handleIconClick}
            disabled={!iconContent.clickable || isLoading}
            className={cn(
              "flex items-center justify-center transition-colors duration-200",
              iconContent.clickable && !isLoading
                ? "text-muted-foreground hover:text-primary cursor-pointer"
                : isLoading 
                  ? "text-primary cursor-default"
                  : "text-muted-foreground cursor-default",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
              "rounded-sm p-1"
            )}
            aria-label={iconContent.label}
            tabIndex={iconContent.clickable ? 0 : -1}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIcon}
                variants={iconVariants}
                initial="exit"
                animate={currentIcon}
                exit="exit"
                style={{ originX: 0.5, originY: 0.5 }}
              >
                {iconContent.component}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </motion.div>
      </motion.div>
    )
  }
)

EnhancedSearchInput.displayName = 'EnhancedSearchInput'

export { EnhancedSearchInput, type EnhancedSearchInputProps }