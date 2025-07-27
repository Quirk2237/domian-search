'use client'

import { Check, X, ExternalLink } from 'lucide-react'
import { EXTENSION_PRICES } from '@/lib/domain-utils'
import { motion } from 'framer-motion'

interface DomainResult {
  domain: string
  available: boolean
  extension: string
  requested?: boolean
}

interface DomainResultsProps {
  results: DomainResult[]
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
}

export function DomainResults({ results }: DomainResultsProps) {
  // Separate requested domain from alternatives
  const requestedDomain = results.find(r => r.requested)
  const alternativeDomains = results.filter(r => !r.requested)
  
  return (
    <motion.div 
      className="space-y-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {requestedDomain && (
        <>
          <motion.h3 
            className="text-sm font-medium text-muted-foreground mb-2"
            variants={item}
          >
            Requested Domain
          </motion.h3>
          <motion.div
            className={`flex items-center justify-between p-4 border-2 rounded-lg min-h-[56px] ${
              requestedDomain.available 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}
            variants={item}
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex items-center space-x-3">
              {requestedDomain.available ? (
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <X className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <span className={`text-lg font-medium ${requestedDomain.available ? 'text-green-900' : 'text-red-900'}`}>
                {requestedDomain.domain}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {requestedDomain.available && (
                <>
                  <span className="text-lg font-medium text-green-900">
                    ${EXTENSION_PRICES[requestedDomain.extension] || 29.99}/year
                  </span>
                  <a
                    href={`https://www.namecheap.com/domains/registration/results/?domain=${requestedDomain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                    aria-label={`Register ${requestedDomain.domain}`}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </>
              )}
              {!requestedDomain.available && (
                <span className="text-sm font-medium text-red-900">Already Taken</span>
              )}
            </div>
          </motion.div>
          
          {alternativeDomains.length > 0 && (
            <motion.h3 
              className="text-sm font-medium text-muted-foreground mb-2 mt-6"
              variants={item}
            >
              Alternative Extensions
            </motion.h3>
          )}
        </>
      )}
      
      {!requestedDomain && (
        <motion.h3 
          className="text-sm font-medium text-muted-foreground mb-4"
          variants={item}
        >
          Domain Availability
        </motion.h3>
      )}
      
      {(requestedDomain ? alternativeDomains : results).map((result, index) => (
        <motion.div
          key={result.domain}
          className="flex items-center justify-between p-4 bg-card border border-border rounded-lg min-h-[56px]"
          variants={item}
          whileHover={{ 
            scale: 1.02,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="flex items-center space-x-3">
            {result.available ? (
              <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <X className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-lg ${result.available ? 'text-foreground' : 'text-muted-foreground'}`}>
              {result.domain}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {result.available && (
              <>
                <span className="text-lg font-medium text-foreground">
                  ${EXTENSION_PRICES[result.extension] || 29.99}/year
                </span>
                <a
                  href={`https://www.namecheap.com/domains/registration/results/?domain=${result.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label={`Register ${result.domain}`}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </>
            )}
            {!result.available && (
              <span className="text-sm text-muted-foreground">Taken</span>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}