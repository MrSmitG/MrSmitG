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
  autoSave?: boolean
  tabAutocomplete?: boolean
  recentWorkspaces?: string[]
  activeSessionId?: string
  offlineMode?: boolean
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
  offlineMode?: boolean
  installed: LocalModel[]
  disk: LocalModel[]
  catalog: CatalogModel[]
  providerError: string | null
}

export interface HealthResponse {
  app: string
  version: string
  offlineMode?: boolean
  config: Pick<
    AppConfig,
    'provider' | 'baseUrl' | 'selectedModel' | 'modelsPath' | 'workspacePath'
  > & { offlineMode?: boolean }
  provider: { ok: boolean; provider: ProviderKind; message: string; models: number }
  features?: string[]
}

export interface ChatEdit {
  path: string
  content: string
}

export interface DiffPreview {
  path: string
  before: string
  after: string
  isNew: boolean
}

export interface TerminalResult {
  command: string
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  truncated: boolean
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
  createFile: (path: string, content = '') =>
    fetch('/api/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    }).then((r) => json<{ path: string }>(r)),
  deleteFile: (path: string) =>
    fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  search: (q: string) =>
    fetch(`/api/workspace/search?q=${encodeURIComponent(q)}`).then((r) =>
      json<{ hits: Array<{ path: string; line: number; preview: string }> }>(r),
    ),
  rules: () => fetch('/api/workspace/rules').then((r) => json<{ rules: string }>(r)),
  applyEdits: (edits: ChatEdit[]) =>
    fetch('/api/edits/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits }),
    }).then((r) => json<{ applied: string[] }>(r)),
  previewEdits: (edits: ChatEdit[]) =>
    fetch('/api/edits/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits }),
    }).then((r) => json<{ previews: DiffPreview[] }>(r)),
  terminal: (command: string) =>
    fetch('/api/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    }).then((r) => json<TerminalResult>(r)),
}

export type StreamHandlers = {
  onToken: (t: string) => void
  onTool?: (name: string, detail?: string) => void
  onDone: (full: string, edits: ChatEdit[], applied: string[]) => void
  onError: (msg: string) => void
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
    mentionedFiles?: string[]
  },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    handlers.onError((err as { error?: string }).error || 'Chat request failed')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let collectedEdits: ChatEdit[] = []

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
          tool?: { name: string; args?: Record<string, string> }
          result?: string
        }
        if (data.type === 'token' && data.content) handlers.onToken(data.content)
        if (data.type === 'tool' && data.tool) {
          handlers.onTool?.(data.tool.name, JSON.stringify(data.tool.args ?? {}))
        }
        if (data.type === 'tool_result' && data.content) {
          handlers.onTool?.('result', data.content)
        }
        if (data.type === 'edit' && data.edits) {
          collectedEdits = [...collectedEdits, ...data.edits]
        }
        if (data.type === 'error') handlers.onError(data.content || 'Unknown error')
        if (data.type === 'done') {
          handlers.onDone(
            data.content || '',
            data.edits?.length ? data.edits : collectedEdits,
            data.applied || [],
          )
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

export function flattenFiles(nodes: FileNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path)
    if (n.children) out.push(...flattenFiles(n.children))
  }
  return out
}

export function parseMentions(text: string): string[] {
  const hits = text.match(/@([\w./-]+)/g) || []
  return [...new Set(hits.map((h) => h.slice(1)))]
}
