// Helper for FlowWorkspace: handle add-workflow event from ExplorerPanel
import { fetchWorkflow, fetchWorkflowList } from "./petriClient";

export async function handleAddServerWorkflow(settings, setServerWorkflows, setServerWorkflowsFetched, setServerWorkflowCache, fetchServerWorkflowList) {
  if (!settings.flowServiceUrl) return;
  // You may want to show a dialog for name, for now just use a default
  const name = prompt("Enter new workflow name:", "New Workflow");
  if (!name) return;
  try {
    // POST to create new workflow (assuming API exists)
    const resp = await fetch(`${settings.flowServiceUrl}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    // Refresh workflow list
    await fetchServerWorkflowList();
  } catch (err) {
    alert("Failed to create workflow: " + (err?.message || err));
  }
}
