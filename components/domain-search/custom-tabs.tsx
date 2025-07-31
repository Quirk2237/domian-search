'use client'

import { Search, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomTabsProps {
  activeTab: 'search' | 'bookmarks'
  onTabChange: (tab: 'search' | 'bookmarks') => void
  className?: string
}

export function CustomTabs({ activeTab, onTabChange, className }: CustomTabsProps) {
  const tabs = [
    {
      id: 'search' as const,
      label: 'Search',
      icon: Search
    },
    {
      id: 'bookmarks' as const,
      label: 'Bookmarks',
      icon: Bookmark
    }
  ] as const

  return (
    <div className={cn('flex items-center gap-3 mt-3', className)}>
      {tabs.map((tab, index) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md',
              'transition-colors duration-200 select-none',
              'focus:outline-none',
              isActive 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >

            <Icon 
              className={cn(
                "h-3.5 w-3.5",
                isActive && tab.id === 'search' && "fill-[#9F7BE7] text-[#9F7BE7]",
                isActive && tab.id === 'bookmarks' && "fill-yellow-400 text-yellow-500"
              )} 
            />

            <span>{tab.label}</span>

          </button>
        )
      })}
    </div>
  )
}