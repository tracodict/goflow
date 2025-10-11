const body = JSON.stringify({
  success: false,
  error: {
    code: 'deprecated_endpoint',
    message: 'Datasource detail APIs moved to the Flow Service. Call `${flowServiceUrl}/api/datasources/:id` from the frontend.'
  }
})

export async function GET() {
  return new Response(body, {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function PATCH() {
  return GET()
}

export async function DELETE() {
  return GET()
}
