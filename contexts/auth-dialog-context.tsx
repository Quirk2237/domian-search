"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface AuthDialogContextType {
  isOpen: boolean
  openAuthDialog: () => void
  closeAuthDialog: () => void
}

const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined)

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openAuthDialog = () => setIsOpen(true)
  const closeAuthDialog = () => setIsOpen(false)

  return (
    <AuthDialogContext.Provider value={{ isOpen, openAuthDialog, closeAuthDialog }}>
      {children}
    </AuthDialogContext.Provider>
  )
}

export function useAuthDialog() {
  const context = useContext(AuthDialogContext)
  if (!context) {
    throw new Error("useAuthDialog must be used within an AuthDialogProvider")
  }
  return context
}