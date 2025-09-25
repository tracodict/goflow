import { Builder } from "@/components/builder/Builder"

// Server component wrapper (async to support awaited searchParams in newer Next.js versions)
export default function Home() {
  return <Builder />
}