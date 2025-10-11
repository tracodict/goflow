const body = JSON.stringify({
  success: false,
  error: {
    code: 'deprecated_endpoint',
    message: 'Datasource APIs now live behind the Flow Service. Call `${flowServiceUrl}/api/datasources` instead.'
  }
})

export async function GET() {
  return new Response(body, {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function POST() {
  return GET()
}
