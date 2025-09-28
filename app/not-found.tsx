"use client"

export default function NotFound() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <h2 className="text-xl font-medium text-muted-foreground">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          The page you're looking for doesn't exist in the site structure.
        </p>
        <div className="pt-4">
          <a 
            href="/" 
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  )
}