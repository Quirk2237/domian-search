"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-config"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Github, Mail, User } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { z } from "zod"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Validation schemas
const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignInForm = z.infer<typeof signInSchema>
type SignUpForm = z.infer<typeof signUpSchema>

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<SignUpForm & SignInForm>>({})
  const router = useRouter()
  const supabase = createClient()

  const validateSignIn = (): boolean => {
    try {
      signInSchema.parse({ email, password })
      setErrors({})
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Partial<SignInForm> = {}
        err.issues.forEach((error) => {
          const field = error.path[0] as keyof SignInForm
          fieldErrors[field] = error.message
        })
        setErrors(fieldErrors)
      }
      return false
    }
  }

  const validateSignUp = (): boolean => {
    try {
      signUpSchema.parse({ name, email, password })
      setErrors({})
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Partial<SignUpForm> = {}
        err.issues.forEach((error) => {
          const field = error.path[0] as keyof SignUpForm
          fieldErrors[field] = error.message
        })
        setErrors(fieldErrors)
      }
      return false
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateSignIn()) return
    
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      toast.success("Successfully signed in!")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateSignUp()) return
    
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: name,
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ') || '',
          },
        },
      })
      
      if (error) throw error
      
      toast.success("Check your email to confirm your account!")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign up")
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) throw error
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to sign in with ${provider}`)
      setLoading(false)
    }
  }

  // Animation variants
  const formVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  }

  const fieldVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3, ease: "easeOut" as const }
    }
  }

  const errorVariants = {
    hidden: { opacity: 0, scale: 0.95, height: 0 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      height: "auto" as const,
      transition: { duration: 0.2, ease: "easeOut" as const }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      height: 0,
      transition: { duration: 0.15, ease: "easeIn" as const }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome</DialogTitle>
          <DialogDescription>
            Sign in to your account or create a new one to get started.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="signin" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4">
            <motion.form 
              onSubmit={handleEmailSignIn} 
              className="space-y-4"
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="space-y-2" variants={fieldVariants}>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) {
                      const newErrors = { ...errors }
                      delete newErrors.email
                      setErrors(newErrors)
                    }
                  }}
                  disabled={loading}
                  className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p 
                      className="text-sm text-red-500"
                      variants={errorVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {errors.email}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.div className="space-y-2" variants={fieldVariants}>
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) {
                      const newErrors = { ...errors }
                      delete newErrors.password
                      setErrors(newErrors)
                    }
                  }}
                  disabled={loading}
                  className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                <AnimatePresence>
                  {errors.password && (
                    <motion.p 
                      className="text-sm text-red-500"
                      variants={errorVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.div variants={fieldVariants}>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  <motion.span
                    animate={loading ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
                    transition={loading ? { repeat: Infinity, duration: 1.5 } : {}}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </motion.span>
                </Button>
              </motion.div>
            </motion.form>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            
            <motion.div 
              className="grid grid-cols-2 gap-3"
              variants={fieldVariants}
            >
              <Button
                variant="outline"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loading}
                className="transition-all duration-200 hover:scale-105"
              >
                <Mail className="mr-2 h-4 w-4" />
                Google
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOAuthSignIn("github")}
                disabled={loading}
                className="transition-all duration-200 hover:scale-105"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </Button>
            </motion.div>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            <motion.form 
              onSubmit={handleEmailSignUp} 
              className="space-y-4"
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="space-y-2" variants={fieldVariants}>
                <Label htmlFor="signup-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) {
                        const newErrors = { ...errors }
                        delete newErrors.name
                        setErrors(newErrors)
                      }
                    }}
                    disabled={loading}
                    className={`pl-10 ${errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                </div>
                <AnimatePresence>
                  {errors.name && (
                    <motion.p 
                      className="text-sm text-red-500"
                      variants={errorVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {errors.name}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.div className="space-y-2" variants={fieldVariants}>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) {
                      const newErrors = { ...errors }
                      delete newErrors.email
                      setErrors(newErrors)
                    }
                  }}
                  disabled={loading}
                  className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p 
                      className="text-sm text-red-500"
                      variants={errorVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {errors.email}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.div className="space-y-2" variants={fieldVariants}>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) {
                      const newErrors = { ...errors }
                      delete newErrors.password
                      setErrors(newErrors)
                    }
                  }}
                  disabled={loading}
                  className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                <AnimatePresence>
                  {errors.password && (
                    <motion.p 
                      className="text-sm text-red-500"
                      variants={errorVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <motion.div variants={fieldVariants}>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  <motion.span
                    animate={loading ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
                    transition={loading ? { repeat: Infinity, duration: 1.5 } : {}}
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </motion.span>
                </Button>
              </motion.div>
            </motion.form>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            
            <motion.div 
              className="grid grid-cols-2 gap-3"
              variants={fieldVariants}
            >
              <Button
                variant="outline"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loading}
                className="transition-all duration-200 hover:scale-105"
              >
                <Mail className="mr-2 h-4 w-4" />
                Google
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOAuthSignIn("github")}
                disabled={loading}
                className="transition-all duration-200 hover:scale-105"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </Button>
            </motion.div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}