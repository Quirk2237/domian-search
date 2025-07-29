import { Metadata } from 'next'
import MarketingClient from './marketing-client'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const query = params.q
  const mode = params.mode
  
  // Default metadata
  if (!query) {
    return {
      title: 'Wicked Simple Domains',
      description: 'Find your perfect domain name with ease.',
    }
  }
  
  // Dynamic metadata based on search
  const title = mode === 'suggestion' 
    ? `AI Suggested domains for "${query}" - Wicked Simple Domains`
    : `Domain availability for "${query}" - Wicked Simple Domains`
    
  const description = mode === 'suggestion'
    ? `Discover AI-powered domain suggestions for "${query}". Find the perfect domain name for your project.`
    : `Check domain availability for "${query}" across popular extensions. Register your domain today.`
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default function MarketingPage() {
  return <MarketingClient />
}