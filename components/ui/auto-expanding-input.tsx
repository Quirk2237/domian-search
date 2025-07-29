'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AutoExpandingInputProps extends Omit<React.ComponentProps<'textarea'>, 'rows'> {
  className?: string
  minHeight?: number
  maxHeight?: number
  onHeightChange?: (height: number) => void
}

const AutoExpandingInput = React.forwardRef<HTMLTextAreaElement, AutoExpandingInputProps>(
  ({ className, minHeight = 40, maxHeight = 300, onHeightChange, ...props }, ref) => {
    const [height, setHeight] = React.useState(minHeight)
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const combinedRef = React.useMemo(() => {
      return (node: HTMLTextAreaElement) => {
        textareaRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }
    }, [ref])

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      // Reset height to allow shrinking
      textarea.style.height = `${minHeight}px`
      
      // Calculate the required height
      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      
      // Only update if height actually changed to avoid unnecessary re-renders
      if (newHeight !== height) {
        setHeight(newHeight)
        onHeightChange?.(newHeight)
      }
    }, [height, minHeight, maxHeight, onHeightChange])

    // Adjust height when value changes
    React.useEffect(() => {
      adjustHeight()
    }, [props.value, adjustHeight])

    // Handle input changes
    const handleInput = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      props.onChange?.(e)
      // Slight delay to ensure DOM is updated before measuring
      requestAnimationFrame(adjustHeight)
    }, [props, adjustHeight])

    return (
      <motion.div
        animate={{ height }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          duration: 0.2
        }}
        style={{ overflow: 'hidden' }}
      >
        <textarea
          ref={combinedRef}
          {...props}
          onChange={handleInput}
          className={cn(
            // Base styles
            "w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none",
            // Typography
            "text-sm sm:text-base lg:text-lg",
            // Remove default textarea styles
            "field-sizing-content",
            className
          )}
          style={{
            height: `${height}px`,
            minHeight: `${minHeight}px`,
            maxHeight: `${maxHeight}px`,
          }}
          rows={1}
        />
      </motion.div>
    )
  }
)

AutoExpandingInput.displayName = 'AutoExpandingInput'

export { AutoExpandingInput, type AutoExpandingInputProps }