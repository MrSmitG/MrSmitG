type AgentDebugEntry = {
  hypothesisId: string
  location: string
  message: string
  data: Record<string, unknown>
  timestamp: number
}

export function agentDebugLog(entry: AgentDebugEntry): void {
  if (!import.meta.env.DEV) return
  void fetch('/__agent-debug', {
    method: 'POST',
    headers: { 'content-type': 'application/x-ndjson' },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => {})
}
