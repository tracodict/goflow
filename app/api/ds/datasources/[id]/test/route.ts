export async function POST() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'deprecated_endpoint',
        message: 'Datasource connection tests moved to the Flow Service `flowServiceUrl`.'
      }
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
