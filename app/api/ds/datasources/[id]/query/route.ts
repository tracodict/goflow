export async function POST() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'deprecated_endpoint',
        message: 'Access datasource queries via the Flow Service `flowServiceUrl` instead of Next.js routes.'
      }
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}