export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  // Placeholder for FS provider
  return Response.json({ error: "Local workspace provider not implemented yet" }, { status: 501 })
}