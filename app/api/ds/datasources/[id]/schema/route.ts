export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'deprecated_endpoint',
        message: 'Schema introspection now handled by the Flow Service. Call `${flowServiceUrl}/api/datasources/:id/schema` directly from the frontend.'
      }
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}