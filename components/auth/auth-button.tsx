'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { AuthDialog } from './auth-dialog'
import { LogOut, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AuthButton() {
  const { user, loading, signOut } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </Button>
    )
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 shrink-0">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline-block truncate max-w-[120px]">
              {user.email?.split('@')[0]}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 min-w-[14rem]"
          sideOffset={8}
          alignOffset={0}
        >
          <DropdownMenuItem className="font-medium text-sm break-all cursor-default focus:bg-transparent">
            {user.email}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={signOut} 
            variant="destructive"
            className="cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAuthDialogOpen(true)}
      >
        Sign In
      </Button>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  )
}