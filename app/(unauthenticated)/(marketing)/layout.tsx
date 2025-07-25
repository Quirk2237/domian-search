import { SimpleHeader } from "./_components/simple-header"

export default async function MarketingLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SimpleHeader />
      {children}
    </>
  )
}