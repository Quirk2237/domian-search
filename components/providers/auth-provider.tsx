"use client"

import { ClerkProvider } from "@clerk/nextjs"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isMvpMode = process.env.NEXT_PUBLIC_MVP_MODE === "true"
  
  if (isMvpMode) {
    return <>{children}</>
  }
  
  return <ClerkProvider>{children}</ClerkProvider>
}