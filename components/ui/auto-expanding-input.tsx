'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface AutoExpandingInputProps extends Omit<React.ComponentProps<'textarea'>, 'rows'> {
  className?: string
  minHeight?: number
  maxHeight?: number
  onHeightChange?: (height: number) => void
}

const AutoExpandingInput = React.forwardRef<HTMLTextAreaElement, AutoExpandingInputProps>(
  ({ className, minHeight = 24, maxHeight = 500, onHeightChange, value, onChange, onKeyDown, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const [height, setHeight] = React.useState(minHeight)
    
    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)
    
    // Scroll to cursor position to ensure it's visible
    const scrollToCursor = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      
      // Get cursor position
      const cursorPos = textarea.selectionStart
      const textBeforeCursor = textarea.value.substring(0, cursorPos)
      
      // Create a temporary element to measure text width
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context) {
        const computedStyle = window.getComputedStyle(textarea)
        context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`
        
        // Measure width of text before cursor
        const textWidth = context.measureText(textBeforeCursor).width
        const containerWidth = textarea.clientWidth
        
        // If text extends beyond visible area, scroll to show cursor
        if (textWidth > textarea.scrollLeft + containerWidth - 20) {
          textarea.scrollLeft = textWidth - containerWidth + 40
        } else if (textWidth < textarea.scrollLeft + 20) {
          textarea.scrollLeft = Math.max(0, textWidth - 20)
        }
      }
    }, [])

    // Auto-resize logic
    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      
      // Store current scroll positions
      const scrollPosY = textarea.scrollTop
      const scrollPosX = textarea.scrollLeft
      
      // Reset height to measure actual content
      textarea.style.height = 'auto'
      
      // Calculate new height
      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      
      // Apply new height
      textarea.style.height = `${newHeight}px`
      
      // If content exceeds maxHeight, enable vertical scrolling
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto'
      } else {
        textarea.style.overflowY = 'hidden'
      }
      
      // Restore scroll positions
      textarea.scrollTop = scrollPosY
      textarea.scrollLeft = scrollPosX
      
      // Update state and notify parent
      if (newHeight !== height) {
        setHeight(newHeight)
        onHeightChange?.(newHeight)
      }
      
      // Ensure cursor is visible after height adjustment
      scrollToCursor()
    }, [height, minHeight, maxHeight, onHeightChange, scrollToCursor])
    
    // Adjust height on mount and when value changes
    React.useLayoutEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])
    
    // Handle input changes
    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e)
      // Use RAF to ensure DOM updates before measuring and scrolling
      requestAnimationFrame(() => {
        adjustHeight()
        // Small delay to ensure text is rendered before scrolling
        setTimeout(scrollToCursor, 0)
      })
    }, [onChange, adjustHeight, scrollToCursor])

    // Handle key events for cursor position changes
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // For navigation keys, ensure cursor remains visible
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        setTimeout(scrollToCursor, 0)
      }
      onKeyDown?.(e)
    }, [scrollToCursor, onKeyDown])

    // Handle selection changes (mouse clicks, etc.)
    const handleSelect = React.useCallback(() => {
      setTimeout(scrollToCursor, 0)
    }, [scrollToCursor])
    
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        {...props}
        className={cn(
          // Base styles matching Chat CN textarea
          "flex w-full border-0 bg-transparent outline-none",
          // Typography - consistent with Chat CN patterns
          "text-base md:text-sm placeholder:text-muted-foreground",
          // Remove default padding/margin
          "p-0 m-0",
          // Disable resize handle and enable scrolling
          "resize-none overflow-y-auto overflow-x-auto",
          // Smooth scrolling behavior
          "scroll-smooth",
          // Smooth height transitions
          "transition-[height] duration-200 ease-out",
          // Selection styling matching Chat CN
          "selection:bg-primary selection:text-primary-foreground",
          // Custom scrollbar styling for better UX
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/30 hover:scrollbar-thumb-border/50",
          // Vertical scrollbar styling
          "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full",
          // Ensure proper text rendering and cursor visibility
          "text-left field-sizing-content",
          className
        )}
        style={{
          height: `${height}px`,
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
          // Ensure consistent line height
          lineHeight: '1.5',
          ...props.style
        }}
        rows={1}
      />
    )
  }
)

AutoExpandingInput.displayName = 'AutoExpandingInput'

export { AutoExpandingInput, type AutoExpandingInputProps }