'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'

interface EvaluationScoreProps {
  searchId: string | null
  className?: string
}

interface ScoreData {
  overall_score: number
  scored_at: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  criteria_scores: Record<string, number>
}

export function EvaluationScore({ searchId, className }: EvaluationScoreProps) {
  const [score, setScore] = useState<ScoreData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const maxPolls = 10 // Stop polling after 10 attempts (30 seconds)

  useEffect(() => {
    if (!searchId) {
      setScore(null)
      setPollCount(0)
      return
    }

    // Reset state for new search
    setScore(null)
    setPollCount(0)
    setIsLoading(true)

    // Start polling for score
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/domains/score?searchId=${searchId}`)
        const data = await response.json()

        if (data.score) {
          setScore(data.score)
          setIsLoading(false)
          clearInterval(pollInterval)
        } else {
          setPollCount(prev => {
            const newCount = prev + 1
            if (newCount >= maxPolls) {
              setIsLoading(false)
              clearInterval(pollInterval)
            }
            return newCount
          })
        }
      } catch (error) {
        console.error('Error fetching score:', error)
        setIsLoading(false)
        clearInterval(pollInterval)
      }
    }, 3000) // Poll every 3 seconds

    // Initial fetch
    fetch(`/api/domains/score?searchId=${searchId}`)
      .then(res => res.json())
      .then(data => {
        if (data.score) {
          setScore(data.score)
          setIsLoading(false)
          clearInterval(pollInterval)
        }
      })
      .catch(error => {
        console.error('Error fetching score:', error)
        setIsLoading(false)
      })

    return () => clearInterval(pollInterval)
  }, [searchId])

  if (!searchId) return null

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 7) return <TrendingUp className="h-4 w-4" />
    return <TrendingDown className="h-4 w-4" />
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Evaluating domain quality...</span>
        </motion.div>
      )}

      {score && (
        <motion.div
          className={cn('space-y-3', className)}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Quality Score:</span>
              <div className={cn('flex items-center gap-1 font-semibold', getScoreColor(score.overall_score))}>
                {getScoreIcon(score.overall_score)}
                <span className="text-lg">{score.overall_score.toFixed(1)}/10</span>
              </div>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-medium mb-2">AI Evaluation Summary</p>
                  <p className="text-sm mb-3">{score.summary}</p>
                  
                  {score.strengths.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-green-600 mb-1">Strengths:</p>
                      <ul className="text-sm space-y-0.5">
                        {score.strengths.slice(0, 3).map((strength, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {score.weaknesses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-orange-600 mb-1">Areas for Improvement:</p>
                      <ul className="text-sm space-y-0.5">
                        {score.weaknesses.slice(0, 3).map((weakness, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-orange-600 mt-0.5">•</span>
                            <span>{weakness}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            <Progress value={score.overall_score * 10} className="h-2" />
            
            {Object.keys(score.criteria_scores).length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(score.criteria_scores).slice(0, 4).map(([criterion, value]) => (
                  <div key={criterion} className="flex items-center justify-between">
                    <span className="text-muted-foreground capitalize">
                      {criterion.replace(/_/g, ' ').replace(/\s*\(\d+%\)/, '')}:
                    </span>
                    <span className={cn('font-medium', getScoreColor(value as number))}>
                      {(value as number).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}