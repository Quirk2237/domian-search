'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = () => {
    if (!buttonRef.current || isAnimating) return

    const button = buttonRef.current
    const rect = button.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Calculate the maximum radius needed to cover the entire screen
    const maxRadius = Math.max(
      Math.hypot(centerX, centerY),
      Math.hypot(window.innerWidth - centerX, centerY),
      Math.hypot(centerX, window.innerHeight - centerY),
      Math.hypot(window.innerWidth - centerX, window.innerHeight - centerY)
    )

    // Create the animation overlay
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100vw'
    overlay.style.height = '100vh'
    overlay.style.zIndex = '9999'
    overlay.style.pointerEvents = 'none'
    
    // Set the theme color based on what we're transitioning TO
    const isDarkMode = theme === 'dark'
    overlay.style.backgroundColor = isDarkMode ? 'white' : 'black'
    
    // Create the circular clip path
    overlay.style.clipPath = `circle(0px at ${centerX}px ${centerY}px)`
    overlay.style.transition = 'clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1)'
    
    document.body.appendChild(overlay)
    setIsAnimating(true)

    // Start the animation
    requestAnimationFrame(() => {
      overlay.style.clipPath = `circle(${maxRadius}px at ${centerX}px ${centerY}px)`
    })

    // Change theme midway through animation
    setTimeout(() => {
      setTheme(isDarkMode ? 'light' : 'dark')
    }, 300)

    // Clean up after animation
    setTimeout(() => {
      overlay.remove()
      setIsAnimating(false)
    }, 600)
  }

  if (!mounted) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={handleThemeChange}
        className="bg-background/80 backdrop-blur-sm hover:bg-accent relative"
        disabled={isAnimating}
      >
        <motion.div
          animate={{ rotate: theme === 'dark' ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </motion.div>
        <span className="sr-only">Toggle theme</span>
      </Button>
    </motion.div>
  )
}