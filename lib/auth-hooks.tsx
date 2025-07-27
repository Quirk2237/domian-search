"use client"

import { useRouter } from "next/navigation"
import { createContext, useContext } from "react"

// Mock auth context for MVP mode
const MockAuthContext = createContext({
  isSignedIn: true,
  userId: "mvp-user-123",
  signOut: () => {}
})

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  
  const signOut = () => {
    router.push("/")
  }
  
  return (
    <MockAuthContext.Provider value={{ isSignedIn: true, userId: "mvp-user-123", signOut }}>
      {children}
    </MockAuthContext.Provider>
  )
}

// Export auth hooks
export function useAuth() {
  const context = useContext(MockAuthContext)
  return {
    isSignedIn: context.isSignedIn,
    userId: context.userId
  }
}

export function useClerk() {
  const context = useContext(MockAuthContext)
  return {
    signOut: context.signOut
  }
}