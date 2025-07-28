'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Search, MousePointerClick, Globe, TrendingUp, Clock, ArrowRight } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [searchHistoryLoading, setSearchHistoryLoading] = useState(false)
  const [searchHistoryError, setSearchHistoryError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
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
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
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
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <span>View history</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
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
      </Tabs>

      {/* Search History Sheet */}
      <Sheet open={searchHistoryOpen} onOpenChange={setSearchHistoryOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Search History</SheetTitle>
            <SheetDescription>
              Recent domain searches
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {searchHistoryLoading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                ))}
              </>
            ) : searchHistoryError ? (
              <div className="text-destructive text-sm">
                {searchHistoryError}
              </div>
            ) : searchHistory.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No search history available
              </div>
            ) : (
              <div className="space-y-3">
                {searchHistory.map((search) => (
                  <motion.div
                    key={search.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {search.query}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {search.search_mode === 'domain' ? 'Domain Check' : 'AI Suggestions'}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(search.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}