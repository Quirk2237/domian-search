'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Search, MousePointerClick, Globe, TrendingUp, Clock, DollarSign, Zap, GitBranch, ChevronDown, Edit3, Download, FileText, Pause, Play } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'

interface StatsData {
  totalSearches: number
  totalDomains: number
  totalClicks: number
  availableDomains: number
  clickThroughRate: number
  searchesByMode: {
    domain: number
    suggestion: number
  }
  recentSearches: number
  topClickedDomains: Array<{
    domain: string
    clicks: number
  }>
}

interface CostData {
  summary: {
    totalSearches: number
    totalCost: string
    avgCostPerSearch: string
    totalTokens: number
    avgTokensPerSearch: number
    totalGroqCost: number
    totalDomainrRequests: number
  }
  costPer1000Searches: string
  estimatedMonthlyCost: string
}

interface SearchHistoryItem {
  id: string
  query: string
  search_mode: 'domain' | 'suggestion'
  created_at: string
}

interface SearchHistoryResponse {
  searches: SearchHistoryItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface SystemFlowData {
  currentState: {
    prompt: {
      version: number
      id: string
      createdAt: string
      improvementNotes: string
      content: string
    } | null
    checklist: {
      version: number
      id: string
      createdAt: string
      content: string
    } | null
    improvementTemplate: {
      version: number
      id: string
      createdAt: string
      content: string
      notes: string
    } | null
  }
  metrics: {
    averageRecentScore: string
    totalSearches: number
    improvementsTriggered: number
    improvementRate: string
    modelDistribution: Record<string, number>
  }
  versionHistory: Array<{
    id: string
    version: number
    createdAt: string
    improvementNotes: string
    triggerScore: number | null
    scoreDetails: {
      criteria_scores?: Record<string, number>
      quality_filters?: Record<string, boolean>
      naming_techniques_analysis?: {
        techniques_used: string[]
        effectiveness: string
      }
      industry_relevance_assessment?: string
      strengths?: string[]
      weaknesses?: string[]
      summary?: string
    } | null
  }>
  recentActivity: Array<{
    query: string
    createdAt: string
    model: string
    temperature: number
    score: number | null
    domainCount: number
    availableCount: number
  }>
}

// Animated counter component
function AnimatedCounter({ value }: { value: number }) {
  const { number } = useSpring({
    from: { number: 0 },
    to: { number: value },
    config: { duration: 1000 }
  })

  return (
    <animated.span>
      {number.to(n => n.toFixed(0).toLocaleString())}
    </animated.span>
  )
}

// Card animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25
    }
  }
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [costData, setCostData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [searchHistoryLoading, setSearchHistoryLoading] = useState(false)
  const [searchHistoryError, setSearchHistoryError] = useState<string | null>(null)
  const [systemFlowData, setSystemFlowData] = useState<SystemFlowData | null>(null)
  const [editingNode, setEditingNode] = useState<{ type: string; id: string; content: string } | null>(null)
  const [selectedPromptVersion, setSelectedPromptVersion] = useState<{ id: string; content: string } | null>(null)
  const [evaluationEnabled, setEvaluationEnabled] = useState<boolean | null>(null)
  const [evaluationLoading, setEvaluationLoading] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchCostData()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/analytics/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchCostData = async () => {
    try {
      const response = await fetch('/api/analytics/costs?range=7d')
      if (!response.ok) throw new Error('Failed to fetch cost data')
      const data = await response.json()
      setCostData(data)
    } catch (err) {
      console.error('Error fetching cost data:', err)
      // Don't set main error state for cost data failure
    }
  }

  const fetchSystemFlowData = async () => {
    try {
      const response = await fetch('/api/analytics/system-flow')
      if (!response.ok) throw new Error('Failed to fetch system flow data')
      const data = await response.json()
      setSystemFlowData(data)
      // Also fetch evaluation setting when loading system flow
      fetchEvaluationSetting()
    } catch (err) {
      console.error('Error fetching system flow data:', err)
    }
  }

  const fetchEvaluationSetting = async () => {
    try {
      const response = await fetch('/api/settings/evaluation')
      if (!response.ok) throw new Error('Failed to fetch evaluation setting')
      const data = await response.json()
      setEvaluationEnabled(data.enabled)
    } catch (err) {
      console.error('Error fetching evaluation setting:', err)
      // Default to true if error
      setEvaluationEnabled(true)
    }
  }

  const updateEvaluationSetting = async (enabled: boolean) => {
    setEvaluationLoading(true)
    try {
      const response = await fetch('/api/settings/evaluation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      if (!response.ok) throw new Error('Failed to update evaluation setting')
      setEvaluationEnabled(enabled)
    } catch (err) {
      console.error('Error updating evaluation setting:', err)
      // Revert on error
      setEvaluationEnabled(!enabled)
    } finally {
      setEvaluationLoading(false)
    }
  }

  const loadPromptVersion = async (versionId: string) => {
    try {
      const response = await fetch(`/api/analytics/system-flow?versionId=${versionId}`)
      if (!response.ok) throw new Error('Failed to fetch version')
      const data = await response.json()
      setSelectedPromptVersion({
        id: data.version.id,
        content: data.version.prompt_content
      })
    } catch (err) {
      console.error('Error fetching version:', err)
    }
  }

  const fetchSearchHistory = async () => {
    setSearchHistoryLoading(true)
    setSearchHistoryError(null)
    try {
      const response = await fetch('/api/analytics/searches?limit=50')
      if (!response.ok) throw new Error('Failed to fetch search history')
      const data: SearchHistoryResponse = await response.json()
      setSearchHistory(data.searches)
    } catch (err) {
      setSearchHistoryError(err instanceof Error ? err.message : 'Failed to load search history')
    } finally {
      setSearchHistoryLoading(false)
    }
  }

  const handleTotalSearchesClick = () => {
    setSearchHistoryOpen(true)
    if (searchHistory.length === 0 && !searchHistoryLoading) {
      fetchSearchHistory()
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[80px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {error || 'Failed to load stats'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="systemFlow" onClick={() => !systemFlowData && fetchSystemFlowData()}>
            Prompts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Metric Cards */}
          <motion.div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={cardVariants}>
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleTotalSearchesClick}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Searches
                  </CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <AnimatedCounter value={stats.totalSearches} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.recentSearches} in last 24h
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Domains Served
                  </CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <AnimatedCounter value={stats.totalDomains} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.availableDomains} available
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Clicks
                  </CardTitle>
                  <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <AnimatedCounter value={stats.totalClicks} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Domain registrations
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Click-through Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.clickThroughRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Of available domains
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Success Rate Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Success Rate</CardTitle>
                <CardDescription>
                  Percentage of suggested domains that users clicked
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <Progress 
                    value={stats.clickThroughRate} 
                    className="h-4"
                  />
                </motion.div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Click-through rate</span>
                  <span className="font-medium">{stats.clickThroughRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Search Mode Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Search Mode Distribution</CardTitle>
                <CardDescription>
                  Breakdown of search types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Domain Check</Badge>
                      <span className="text-sm text-muted-foreground">
                        Direct domain availability checks
                      </span>
                    </div>
                    <span className="font-medium">
                      {stats.searchesByMode.domain.toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">AI Suggestions</Badge>
                      <span className="text-sm text-muted-foreground">
                        AI-powered domain suggestions
                      </span>
                    </div>
                    <span className="font-medium">
                      {stats.searchesByMode.suggestion.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Clicked Domains */}
          {stats.topClickedDomains.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Top Clicked Domains</CardTitle>
                  <CardDescription>
                    Most popular domains users clicked to register
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topClickedDomains.map((domain, index) => (
                      <motion.div
                        key={domain.domain}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                        whileHover={{ x: 5 }}
                      >
                        <span className="font-medium">{domain.domain}</span>
                        <Badge variant="secondary">
                          {domain.clicks} clicks
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          {costData ? (
            <>
              {/* Cost Metric Cards */}
              <motion.div
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Cost (7d)
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${parseFloat(costData.summary.totalCost).toFixed(4)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Past 7 days
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Avg Cost/Search
                      </CardTitle>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${parseFloat(costData.summary.avgCostPerSearch).toFixed(4)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Per domain search
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Cost/1K Searches
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${costData.costPer1000Searches}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Per thousand searches
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={cardVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Est. Monthly
                      </CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${costData.estimatedMonthlyCost}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        At current rate
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Token Usage Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Token Usage</CardTitle>
                    <CardDescription>
                      AI model token consumption over the past 7 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tokens</p>
                        <p className="text-2xl font-bold">
                          {costData.summary.totalTokens.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Tokens/Search</p>
                        <p className="text-2xl font-bold">
                          {Math.round(costData.summary.avgTokensPerSearch).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Cost Breakdown Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Cost Breakdown</CardTitle>
                    <CardDescription>
                      API usage and costs by provider
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Groq AI</Badge>
                          <span className="text-sm text-muted-foreground">
                            Domain suggestions (Gemma2-9b)
                          </span>
                        </div>
                        <span className="font-medium">
                          ${costData.summary.totalGroqCost.toFixed(4)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Domainr</Badge>
                          <span className="text-sm text-muted-foreground">
                            Availability checks ({costData.summary.totalDomainrRequests} requests)
                          </span>
                        </div>
                        <span className="font-medium text-green-600">
                          Free tier
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">Loading cost data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Trends</CardTitle>
              <CardDescription>
                Historical data and trends (coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Charts and trend analysis will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Performance</CardTitle>
              <CardDescription>
                Compare performance across different prompt versions (coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Prompt version comparison and A/B testing results will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systemFlow" className="space-y-6">
          {systemFlowData ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">System Prompts</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportSystemFlowDocumentation()}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Documentation
                </Button>
              </div>

              {/* Flow Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Step 1: Domain Suggestion Prompt */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow h-full"
                    onClick={() => setEditingNode({
                      type: 'prompt',
                      id: systemFlowData.currentState.prompt?.id || '',
                      content: systemFlowData.currentState.prompt?.content || ''
                    })}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-sm font-semibold">
                            1
                          </div>
                          <div>
                            <CardTitle className="text-base">Domain Suggestions</CardTitle>
                            <CardDescription className="text-xs">
                              Generates AI domain suggestions
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          v{systemFlowData.currentState.prompt?.version || 'N/A'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        Last updated: {systemFlowData.currentState.prompt?.createdAt ? 
                          formatRelativeTime(systemFlowData.currentState.prompt.createdAt) : 'Never'}
                      </div>
                      <div className="text-xs mt-2 text-muted-foreground">
                        Click to view and edit
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Step 2: Quality Checklist */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow h-full"
                    onClick={() => setEditingNode({
                      type: 'checklist',
                      id: systemFlowData.currentState.checklist?.id || '',
                      content: systemFlowData.currentState.checklist?.content || ''
                    })}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-sm font-semibold">
                            2
                          </div>
                          <div>
                            <CardTitle className="text-base">Quality Checklist</CardTitle>
                            <CardDescription className="text-xs">
                              Evaluates domain quality
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          v{systemFlowData.currentState.checklist?.version || 'N/A'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        Last updated: {systemFlowData.currentState.checklist?.createdAt ? 
                          formatRelativeTime(systemFlowData.currentState.checklist.createdAt) : 'Never'}
                      </div>
                      <div className="text-xs mt-2 text-muted-foreground">
                        Click to view and edit
                      </div>
                      
                      {/* Evaluation Toggle */}
                      <div 
                        className="mt-4 pt-4 border-t" 
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label htmlFor="evaluation-toggle" className="text-sm font-medium cursor-pointer">
                              Auto Evaluation
                            </label>
                            {evaluationEnabled === false && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Pause className="h-3 w-3" />
                                Paused
                              </Badge>
                            )}
                          </div>
                          <Switch
                            id="evaluation-toggle"
                            checked={evaluationEnabled ?? true}
                            onCheckedChange={(checked) => {
                              updateEvaluationSetting(checked);
                            }}
                            disabled={evaluationLoading || evaluationEnabled === null}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {evaluationEnabled ? 'Domains are scored and prompts improved automatically' : 'Evaluation and improvement are paused'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Step 3: Improvement Template */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-shadow h-full"
                    onClick={() => setEditingNode({
                      type: 'template',
                      id: systemFlowData.currentState.improvementTemplate?.id || '',
                      content: systemFlowData.currentState.improvementTemplate?.content || ''
                    })}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-sm font-semibold">
                            3
                          </div>
                          <div>
                            <CardTitle className="text-base">Improvement Template</CardTitle>
                            <CardDescription className="text-xs">
                              Improves prompts when score {'<'} 8
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          v{systemFlowData.currentState.improvementTemplate?.version || 'N/A'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        Last updated: {systemFlowData.currentState.improvementTemplate?.createdAt ? 
                          formatRelativeTime(systemFlowData.currentState.improvementTemplate.createdAt) : 'Never'}
                      </div>
                      <div className="text-xs mt-2 text-muted-foreground">
                        Click to view and edit
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* System Metrics Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">System Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{systemFlowData.metrics.averageRecentScore}/10</div>
                      <div className="text-xs text-muted-foreground">Avg Score</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{systemFlowData.metrics.totalSearches}</div>
                      <div className="text-xs text-muted-foreground">Total Searches</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{systemFlowData.metrics.improvementsTriggered}</div>
                      <div className="text-xs text-muted-foreground">Improvements</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{systemFlowData.metrics.improvementRate}%</div>
                      <div className="text-xs text-muted-foreground">Improvement Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Loading prompts...</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Search History Dialog */}
      <Dialog open={searchHistoryOpen} onOpenChange={setSearchHistoryOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] p-0 gap-0">
          <div className="flex flex-col h-[min(85vh,600px)]">
            <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-4 border-b">
              <DialogTitle>Search History</DialogTitle>
              <DialogDescription>
                Recent domain searches
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="px-4 sm:px-6 py-4">
              {searchHistoryLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  ))}
                </div>
              ) : searchHistoryError ? (
                <div className="text-destructive text-sm p-4 text-center">
                  {searchHistoryError}
                </div>
              ) : searchHistory.length === 0 ? (
                <div className="text-muted-foreground text-sm p-4 text-center">
                  No search history available
                </div>
              ) : (
                <div className="space-y-3">
                  {searchHistory.map((search, index) => (
                    <motion.div
                      key={search.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        delay: index * 0.05,
                        duration: 0.3,
                        ease: "easeOut"
                      }}
                      className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-2">
                        <p className="font-medium text-sm break-words">
                          {search.query}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {search.search_mode === 'domain' ? 'Domain Check' : 'AI Suggestions'}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            {formatRelativeTime(search.created_at)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingNode} onOpenChange={(open) => {
        if (!open) {
          setEditingNode(null)
          setSelectedPromptVersion(null)
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[900px] p-0 gap-0">
          <div className="flex flex-col h-[min(90vh,700px)]">
            <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-4 border-b">
              <DialogTitle>
                {editingNode?.type === 'prompt' ? 'Domain Suggestion Prompt' : 
                 editingNode?.type === 'checklist' ? 'Quality Checklist' : 
                 'Improvement Template'}
              </DialogTitle>
              <DialogDescription>
                View and edit the {editingNode?.type}. Changes will create a new version.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="px-4 sm:px-6 py-4 space-y-4">
              {/* Version selector for prompts */}
              {editingNode?.type === 'prompt' && systemFlowData && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="text-sm font-medium">Version:</label>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1">
                    <select 
                      className="text-sm border rounded px-3 py-2 w-full sm:w-auto"
                      onChange={(e) => {
                        const selectedVersion = systemFlowData.versionHistory.find(v => v.version === parseInt(e.target.value))
                        if (selectedVersion && selectedVersion.id) {
                          loadPromptVersion(selectedVersion.id)
                        }
                      }}
                      value={selectedPromptVersion ? 
                        systemFlowData.versionHistory.find(v => v.id === selectedPromptVersion.id)?.version : 
                        systemFlowData.currentState.prompt?.version}
                    >
                      {systemFlowData.versionHistory.map(v => (
                        <option key={v.version} value={v.version}>
                          v{v.version} {v.version === systemFlowData.currentState.prompt?.version && '(active)'}
                          {v.improvementNotes && ` - ${v.improvementNotes.slice(0, 30)}...`}
                        </option>
                      ))}
                    </select>
                    {selectedPromptVersion && selectedPromptVersion.id !== systemFlowData.currentState.prompt?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          if (confirm('Make this version active?')) {
                            const response = await fetch('/api/analytics/system-flow', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                type: 'activate',
                                id: selectedPromptVersion.id
                              })
                            })
                            if (response.ok) {
                              setSelectedPromptVersion(null)
                              setEditingNode(null)
                              fetchSystemFlowData()
                            }
                          }
                        }}
                      >
                        Make Active
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Content editor */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Content:</label>
                <Textarea
                  value={editingNode?.type === 'prompt' && selectedPromptVersion ? 
                    selectedPromptVersion.content : 
                    editingNode?.content || ''}
                  onChange={(e) => {
                    if (editingNode?.type === 'prompt' && selectedPromptVersion) {
                      setSelectedPromptVersion({ ...selectedPromptVersion, content: e.target.value })
                    } else {
                      setEditingNode(editingNode ? { ...editingNode, content: e.target.value } : null)
                    }
                  }}
                  className="min-h-[300px] sm:min-h-[400px] font-mono text-xs sm:text-sm resize-none"
                  placeholder="Enter content..."
                />
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex-shrink-0 border-t px-4 sm:px-6 py-4">
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
              <div className="flex-1">
                {editingNode?.type === 'prompt' && systemFlowData?.currentState.prompt && (
                  <span className="text-xs text-muted-foreground">
                    Active: v{systemFlowData.currentState.prompt.version}
                  </span>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={() => {
                    setEditingNode(null)
                    setSelectedPromptVersion(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 sm:flex-initial"
                  onClick={async () => {
                    if (!editingNode) return
                    
                    const content = editingNode.type === 'prompt' && selectedPromptVersion ? 
                      selectedPromptVersion.content : 
                      editingNode.content
                    
                    try {
                      const response = await fetch('/api/analytics/system-flow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: editingNode.type,
                          id: editingNode.id,
                          content: content,
                          notes: `Updated via System Flow UI`
                        })
                      })
                      
                      if (response.ok) {
                        setEditingNode(null)
                        setSelectedPromptVersion(null)
                        fetchSystemFlowData()
                      } else {
                        console.error('Failed to update')
                      }
                    } catch (error) {
                      console.error('Error updating:', error)
                    }
                  }}
                >
                  Save New Version
                </Button>
              </div>
            </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Export function
function exportSystemFlowDocumentation() {
  // This would be implemented to fetch the current state and generate markdown
  fetch('/api/analytics/system-flow')
    .then(res => res.json())
    .then(data => {
      const markdown = generateMarkdownDocumentation(data)
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `domain-system-flow-${new Date().toISOString().split('T')[0]}.md`
      a.click()
      URL.revokeObjectURL(url)
    })
}

function generateMarkdownDocumentation(data: SystemFlowData): string {
  return `# Domain Search System Flow Documentation
Generated: ${new Date().toISOString()}

## Active Components

### Domain Suggestion Prompt (v${data.currentState.prompt?.version || 'N/A'})
Model: ${Object.keys(data.metrics.modelDistribution)[0] || 'gemma2-9b-it'}

\`\`\`
${data.currentState.prompt?.content || 'No prompt content available'}
\`\`\`

### Quality Checklist (v${data.currentState.checklist?.version || 'N/A'})
\`\`\`
${data.currentState.checklist?.content || 'No checklist content available'}
\`\`\`

### Improvement Template (v${data.currentState.improvementTemplate?.version || 'N/A'})
\`\`\`
${data.currentState.improvementTemplate?.content || 'No template content available'}
\`\`\`

## System Flow
1. User searches → AI generates domains using prompt v${data.currentState.prompt?.version || 'N/A'}
2. Domains scored against checklist v${data.currentState.checklist?.version || 'N/A'}
3. If score < 8.0 → Improvement triggered using template v${data.currentState.improvementTemplate?.version || 'N/A'}
4. New prompt version created and activated

## Recent Performance
- Average Score: ${data.metrics.averageRecentScore}/10
- Total Searches: ${data.metrics.totalSearches}
- Improvements Triggered: ${data.metrics.improvementsTriggered}
- Improvement Rate: ${data.metrics.improvementRate}%

## Version History
${data.versionHistory.slice(0, 5).map(v => 
  `- v${v.version}: ${v.improvementNotes || 'Initial version'} (Score: ${v.triggerScore || 'N/A'})`
).join('\n')}

## Model Distribution
${Object.entries(data.metrics.modelDistribution).map(([model, count]) => 
  `- ${model}: ${count} searches`
).join('\n')}
`
}