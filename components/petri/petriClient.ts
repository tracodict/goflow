// petriClient.ts
// HTTP client for Petri net workflow API

export async function fetchWorkflowList(flowServiceUrl: string) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/list`);
  if (!resp.ok) throw new Error(`Failed to fetch workflow list: ${resp.status}`);
  return resp.json();
}

export async function fetchWorkflow(flowServiceUrl: string, id: string) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/get?id=${encodeURIComponent(id)}`);
  if (!resp.ok) throw new Error(`Failed to fetch workflow: ${resp.status}`);
  return resp.json();
}

export async function saveWorkflow(flowServiceUrl: string, workflowData: any) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowData),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Save failed: ${resp.status} ${msg}`);
  }
  return resp.json();
}
