export type ProviderKind = 'ollama' | 'lmstudio' | 'openai-compatible' | 'demo'
export type AgentMode = 'ask' | 'edit' | 'agent'

export interface AppConfig {
  provider: ProviderKind
  baseUrl: string
  apiKey: string
  selectedModel: string
  modelsPath: string
  workspacePath: string
  temperature: number
  contextWindowHint: number
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

export interface CatalogModel {
  id: string
  name: string
  family: string
  sizeLabel: string
  params: string
  description: string
  tags: string[]
  ollamaName: string
  installed: boolean
}

export interface LocalModel {
  id: string
  name: string
  sizeBytes?: number
  modifiedAt?: string
  source: string
  installed: boolean
}

export interface ModelsResponse {
  provider: ProviderKind
  selectedModel: string
  modelsPath: string
  installed: LocalModel[]
  disk: LocalModel[]
  catalog: CatalogModel[]
  providerError: string | null
}

export interface HealthResponse {
  app: string
  version: string
  config: Pick<
    AppConfig,
    'provider' | 'baseUrl' | 'selectedModel' | 'modelsPath' | 'workspacePath'
  >
  provider: { ok: boolean; provider: ProviderKind; message: string; models: number }
}

export interface ChatEdit {
  path: string
  content: string
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => fetch('/api/health').then((r) => json<HealthResponse>(r)),
  getConfig: () => fetch('/api/config').then((r) => json<AppConfig>(r)),
  saveConfig: (patch: Partial<AppConfig>) =>
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<AppConfig>(r)),
  models: () => fetch('/api/models').then((r) => json<ModelsResponse>(r)),
  selectModel: (model: string) =>
    fetch('/api/models/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    }).then((r) => json<AppConfig>(r)),
  deleteModel: (name: string) =>
    fetch(`/api/models/${encodeURIComponent(name)}`, { method: 'DELETE' }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  tree: () =>
    fetch('/api/workspace/tree').then((r) => json<{ root: string; tree: FileNode[] }>(r)),
  readFile: (path: string) =>
    fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`).then((r) =>
      json<{ path: string; content: string; language: string }>(r),
    ),
  writeFile: (path: string, content: string) =>
    fetch('/api/workspace/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    }).then((r) => json<{ path: string }>(r)),
  search: (q: string) =>
    fetch(`/api/workspace/search?q=${encodeURIComponent(q)}`).then((r) =>
      json<{ hits: Array<{ path: string; line: number; preview: string }> }>(r),
    ),
  applyEdits: (edits: ChatEdit[]) =>
    fetch('/api/edits/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits }),
    }).then((r) => json<{ applied: string[] }>(r)),
}

export async function streamChat(
  body: {
    prompt: string
    mode: AgentMode
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    openFiles: string[]
    activeFile?: string
    selection?: string
    applyEdits?: boolean
  },
  handlers: {
    onToken: (t: string) => void
    onDone: (full: string, edits: ChatEdit[], applied: string[]) => void
    onError: (msg: string) => void
  },
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    handlers.onError((err as { error?: string }).error || 'Chat request failed')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        const data = JSON.parse(line.slice(5).trim()) as {
          type: string
          content?: string
          edits?: ChatEdit[]
          applied?: string[]
        }
        if (data.type === 'token' && data.content) handlers.onToken(data.content)
        if (data.type === 'error') handlers.onError(data.content || 'Unknown error')
        if (data.type === 'done') {
          handlers.onDone(data.content || '', data.edits || [], data.applied || [])
        }
      } catch {
        /* ignore */
      }
    }
  }
}

export async function streamPull(
  model: string,
  ollamaName: string,
  onEvent: (e: { status: string; percent?: number; error?: string; done?: boolean }) => void,
): Promise<void> {
  const res = await fetch('/api/models/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, ollamaName }),
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    onEvent({ status: 'error', error: (err as { error?: string }).error || 'Pull failed', done: true })
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        onEvent(JSON.parse(line.slice(5).trim()))
      } catch {
        /* ignore */
      }
    }
  }
}

export function formatBytes(n?: number): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
