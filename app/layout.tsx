import { CheckoutRedirect } from "@/components/payments/checkout-redirect"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TailwindIndicator } from "@/components/utility/tailwind-indicator"
import { AuthProvider } from "@/components/providers/auth-provider"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import localFont from "next/font/local"
import { Toaster } from "sonner"
import "./globals.css"

const geistMono = localFont({
  src: [
    {
      path: "../public/fonts/GeistMono-Thin.woff2",
      weight: "100",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Light.woff2",
      weight: "200",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Light.woff2",
      weight: "300",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Regular.woff2",
      weight: "400",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Medium.woff2",
      weight: "500",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-SemiBold.woff2",
      weight: "600",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Bold.woff2",
      weight: "700",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Bold.woff2",
      weight: "800",
      style: "normal"
    },
    {
      path: "../public/fonts/GeistMono-Black.woff2",
      weight: "900",
      style: "normal"
    }
  ],
  variable: "--font-geist-mono",
  display: "swap"
})

export const metadata: Metadata = {
  title: "Wicked Simple Domains",
  description: "Find your perfect domain name with ease."
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AuthProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistMono.variable} antialiased`}
        >
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TooltipProvider>
              {children}
              <CheckoutRedirect />

              <TailwindIndicator />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </AuthProvider>
  )
}
