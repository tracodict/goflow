import { notFound } from 'next/navigation'
import { PageRouteClient } from './page-client'

interface PageRouteProps {
  params: Promise<{ segments: string[] }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PageRoute({ params, searchParams }: PageRouteProps) {
  const { segments } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const path = `/${segments.join('/')}`
  
  console.log('[PageRoute] Handling path:', path, 'segments:', segments)
  
  return <PageRouteClient path={path} searchParams={resolvedSearchParams} />
}