"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle } from "lucide-react"
import { useState } from "react"
import { motion } from "framer-motion"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const pricingPlans = [
  {
    name: "Starter",
    description: "Perfect for individuals and small projects",
    monthlyPrice: 9,
    yearlyPrice: 90,
    features: [
      "Up to 3 projects",
      "1 user",
      "2GB storage",
      "Basic support",
      "API access",
    ],
    notIncluded: [
      "Advanced analytics",
      "Priority support",
      "Custom integrations",
    ],
  },
  {
    name: "Professional",
    description: "Ideal for growing teams and businesses",
    monthlyPrice: 29,
    yearlyPrice: 290,
    popular: true,
    features: [
      "Unlimited projects",
      "Up to 10 users",
      "50GB storage",
      "Priority support",
      "API access",
      "Advanced analytics",
      "Custom integrations",
    ],
    notIncluded: [
      "White-label options",
    ],
  },
  {
    name: "Enterprise",
    description: "For large organizations with custom needs",
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: [
      "Unlimited projects",
      "Unlimited users",
      "500GB storage",
      "24/7 dedicated support",
      "API access",
      "Advanced analytics",
      "Custom integrations",
      "White-label options",
      "SLA guarantee",
      "Custom features",
    ],
    notIncluded: [],
  },
]

const faqs = [
  {
    question: "Can I change my plan later?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes, all plans come with a 14-day free trial. No credit card required to start.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and wire transfers for enterprise customers.",
  },
  {
    question: "Can I cancel my subscription?",
    answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.",
  },
  {
    question: "Do you offer discounts for non-profits?",
    answer: "Yes, we offer a 50% discount for registered non-profit organizations. Contact our sales team for more information.",
  },
]

const comparisonFeatures = [
  { feature: "Projects", starter: "Up to 3", professional: "Unlimited", enterprise: "Unlimited" },
  { feature: "Users", starter: "1", professional: "Up to 10", enterprise: "Unlimited" },
  { feature: "Storage", starter: "2GB", professional: "50GB", enterprise: "500GB" },
  { feature: "Support", starter: "Basic", professional: "Priority", enterprise: "24/7 Dedicated" },
  { feature: "API Access", starter: true, professional: true, enterprise: true },
  { feature: "Analytics", starter: false, professional: true, enterprise: true },
  { feature: "Custom Integrations", starter: false, professional: true, enterprise: true },
  { feature: "White-label", starter: false, professional: false, enterprise: true },
  { feature: "SLA Guarantee", starter: false, professional: false, enterprise: true },
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Choose the perfect plan for your needs. Always flexible to scale.
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={!isYearly ? "font-semibold" : "text-muted-foreground"}>Monthly</span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
          />
          <span className={isYearly ? "font-semibold" : "text-muted-foreground"}>
            Yearly <Badge variant="secondary" className="ml-2">Save 20%</Badge>
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {pricingPlans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ 
              y: -8,
              transition: { duration: 0.2 }
            }}
          >
            <Card className={`h-full relative overflow-hidden transition-shadow duration-300 hover:shadow-xl ${plan.popular ? "border-primary shadow-lg" : ""}`}>
              {plan.popular && (
                <motion.div 
                  className="bg-primary text-primary-foreground text-center py-2 text-sm font-medium"
                  initial={{ y: -50 }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  Most Popular
                </motion.div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <motion.div 
                  className="mt-4"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                >
                  <span className="text-4xl font-bold">
                    ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground">
                    /{isYearly ? "year" : "month"}
                  </span>
                </motion.div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, featureIndex) => (
                    <motion.li 
                      key={feature} 
                      className="flex items-start gap-2"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + featureIndex * 0.05 }}
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </motion.li>
                  ))}
                  {plan.notIncluded.map((feature, featureIndex) => (
                    <motion.li 
                      key={feature} 
                      className="flex items-start gap-2 opacity-50"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 0.5, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + (plan.features.length + featureIndex) * 0.05 }}
                    >
                      <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <motion.div 
                  className="w-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    Start Free Trial
                  </Button>
                </motion.div>
              </CardFooter>
              
              {/* Hover gradient effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 pointer-events-none"
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Feature Comparison Table */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Compare Plans</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Feature</TableHead>
                <TableHead className="text-center">Starter</TableHead>
                <TableHead className="text-center">Professional</TableHead>
                <TableHead className="text-center">Enterprise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonFeatures.map((item) => (
                <TableRow key={item.feature}>
                  <TableCell className="font-medium">{item.feature}</TableCell>
                  <TableCell className="text-center">
                    {typeof item.starter === "boolean" ? (
                      item.starter ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                      )
                    ) : (
                      item.starter
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {typeof item.professional === "boolean" ? (
                      item.professional ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                      )
                    ) : (
                      item.professional
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {typeof item.enterprise === "boolean" ? (
                      item.enterprise ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                      )
                    ) : (
                      item.enterprise
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* CTA Section */}
      <div className="text-center mt-16 py-12 bg-muted rounded-lg">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-xl text-muted-foreground mb-8">
          Start your 14-day free trial today. No credit card required.
        </p>
        <Button size="lg">Start Free Trial</Button>
      </div>
    </div>
  )
}