import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SessionProvider } from '@/components/auth/session-context'
import { SystemSettingsProvider } from '@/components/petri/system-settings-context'

export const metadata: Metadata = {
  title: 'goFlow Editor',
  description: 'Visual Editor for goFlow Workflow',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
  <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <style>{`
/* Prefer system-ui stack; Geist provides metrics & variable hooks as fallback */
html {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono: ${GeistMono.variable}, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
        `}</style>
      </head>
  <body className="font-sans">
        <SystemSettingsProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </SystemSettingsProvider>
        <Toaster />
      </body>
    </html>
  )
}
