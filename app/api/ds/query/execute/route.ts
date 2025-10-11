export async function POST() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'deprecated_endpoint',
        message: 'Use the Flow Service `flowServiceUrl` `/api/query/execute` endpoint for ad-hoc queries.'
      }
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
