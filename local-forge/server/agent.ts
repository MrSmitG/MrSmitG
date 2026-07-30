import { loadConfig } from './config.ts'
import { chatCompletion } from './llm.ts'
import { buildSystemPrompt, type AgentMode } from './prompts.ts'
import {
  gatherContextFiles,
  listTree,
  readWorkspaceFile,
  searchWorkspace,
  writeWorkspaceFile,
  type FileNode,
} from './workspace.ts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ToolCall {
  name: 'read_file' | 'search' | 'list_dir' | 'write_file' | 'finish'
  args: Record<string, string>
}

export interface AgentEvent {
  type: 'token' | 'tool' | 'tool_result' | 'edit' | 'done' | 'error' | 'status'
  content?: string
  tool?: ToolCall
  result?: string
  edits?: Array<{ path: string; content: string }>
  applied?: string[]
}

function flattenFiles(nodes: FileNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path)
    if (n.children) out.push(...flattenFiles(n.children))
  }
  return out
}

export function loadProjectRules(workspacePath: string): string {
  for (const name of ['.localforgerules', '.localforge/rules.md', 'LOCALFORGE.md']) {
    const p = join(workspacePath, name)
    if (existsSync(p)) {
      try {
        return readFileSync(p, 'utf8').slice(0, 8000)
      } catch {
        /* skip */
      }
    }
  }
  return ''
}

const TOOL_INSTRUCTIONS = `You are operating as a coding AGENT with tools.
When you need information or want to change files, emit EXACTLY one tool call in this format (no other text in that step):

<<<TOOL
{"name":"read_file","args":{"path":"relative/path.ts"}}
TOOL>>>

Available tools:
- read_file: {"path":"..."}
- search: {"query":"..."}
- list_dir: {"path":""}  (optional path prefix; empty = root)
- write_file: {"path":"...","content":"full file contents"}
- finish: {"summary":"what you did"}

Rules:
- Prefer search/read before writing.
- After enough context, write_file for each change, then finish.
- Keep write_file contents complete (full file).
- Do not invent paths; list_dir or search first if unsure.
`

function parseTool(text: string): ToolCall | null {
  const m = text.match(/<<<TOOL\s*([\s\S]*?)\s*TOOL>>>/)
  if (!m) return null
  try {
    const raw = JSON.parse(m[1].trim()) as ToolCall
    if (!raw?.name) return null
    return { name: raw.name, args: raw.args ?? {} }
  } catch {
    return null
  }
}

async function collectCompletion(
  config: ReturnType<typeof loadConfig>,
  messages: Array<{ role: string; content: string }>,
  onToken?: (t: string) => void,
): Promise<string> {
  if (config.provider === 'demo') {
    // Deterministic multi-step demo agent script based on last user text
    const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
    if (last.includes('TOOL RESULT') && last.includes('write_file')) {
      return `<<<TOOL
{"name":"finish","args":{"summary":"Updated the target file in demo agent mode."}}
TOOL>>>`
    }
    if (last.includes('TOOL RESULT') && /read_file|list_dir|search/.test(last)) {
      const content = [
        'export function welcome(name: string): string {',
        '  return `Welcome, ${name}!`',
        '}',
        '',
        'export function sum(values: number[]): number {',
        '  return values.reduce((a, b) => a + b, 0)',
        '}',
        '',
        'if (import.meta.main) {',
        "  console.log(welcome('LocalForge'))",
        "  console.log('sum', sum([1, 2, 3, 4]))",
        '}',
        '',
      ].join('\n')
      return `<<<TOOL\n${JSON.stringify({ name: 'write_file', args: { path: 'src/main.ts', content } })}\nTOOL>>>`
    }
    // First step: read active/default file — tool markup is not streamed as chat tokens
    void onToken
    return `<<<TOOL
{"name":"read_file","args":{"path":"src/main.ts"}}
TOOL>>>`
  }

  const upstream = await chatCompletion(config, { messages, stream: true })
  const reader = upstream.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  const isNdjson =
    config.provider === 'ollama' && !config.baseUrl.includes('/v1')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    if (isNdjson) {
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line) as { message?: { content?: string } }
          const token = json.message?.content ?? ''
          if (token) {
            full += token
            onToken?.(token)
          }
        } catch {
          /* ignore */
        }
      }
    } else {
      const chunks = buffer.split('\n')
      buffer = chunks.pop() ?? ''
      for (const line of chunks) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const token = json.choices?.[0]?.delta?.content ?? ''
          if (token) {
            full += token
            onToken?.(token)
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
  return full
}

function runTool(
  workspacePath: string,
  tool: ToolCall,
): { result: string; edit?: { path: string; content: string } } {
  switch (tool.name) {
    case 'read_file': {
      const path = tool.args.path || ''
      const file = readWorkspaceFile(workspacePath, path)
      return { result: `FILE ${path}\n${file.content}` }
    }
    case 'search': {
      const hits = searchWorkspace(workspacePath, tool.args.query || '', 30)
      return {
        result:
          hits.length === 0
            ? 'No matches'
            : hits.map((h) => `${h.path}:${h.line}: ${h.preview}`).join('\n'),
      }
    }
    case 'list_dir': {
      const tree = listTree(workspacePath)
      const files = flattenFiles(tree)
      const prefix = (tool.args.path || '').replace(/\/$/, '')
      const filtered = prefix ? files.filter((f) => f.startsWith(prefix)) : files
      return { result: filtered.slice(0, 200).join('\n') || '(empty)' }
    }
    case 'write_file': {
      const path = tool.args.path || ''
      const content = tool.args.content ?? ''
      if (!path) return { result: 'Error: path required' }
      writeWorkspaceFile(workspacePath, path, content)
      return {
        result: `Wrote ${path} (${content.length} chars)`,
        edit: { path, content },
      }
    }
    case 'finish':
      return { result: tool.args.summary || 'Done' }
    default:
      return { result: `Unknown tool: ${(tool as ToolCall).name}` }
  }
}

export async function runAgentLoop(opts: {
  prompt: string
  mode: AgentMode
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  openFiles: string[]
  activeFile?: string
  selection?: string
  autoApply: boolean
  onEvent: (e: AgentEvent) => void
  signal?: AbortSignal
}): Promise<void> {
  const config = loadConfig()
  const rules = loadProjectRules(config.workspacePath)
  const context = gatherContextFiles(
    config.workspacePath,
    [opts.activeFile, ...opts.openFiles].filter(Boolean) as string[],
    12000,
  )

  const system = `${buildSystemPrompt(opts.mode, config)}

${TOOL_INSTRUCTIONS}

${rules ? `Project rules:\n${rules}` : ''}
`

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: system },
    ...opts.history.slice(-8),
    {
      role: 'user',
      content: [
        opts.activeFile ? `Active file: ${opts.activeFile}` : '',
        opts.selection ? `Selection:\n\`\`\`\n${opts.selection}\n\`\`\`` : '',
        context ? `Open context (truncated):\n${context}` : '',
        `Goal:\n${opts.prompt}`,
        'Begin by using tools. End with finish.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ]

  const edits: Array<{ path: string; content: string }> = []
  const applied: string[] = []
  let transcript = ''

  for (let step = 0; step < 8; step++) {
    if (opts.signal?.aborted) {
      opts.onEvent({ type: 'error', content: 'Aborted' })
      return
    }

    opts.onEvent({ type: 'status', content: `agent step ${step + 1}` })
    let full = ''
    try {
      full = await collectCompletion(config, messages, (t) => {
        transcript += t
        opts.onEvent({ type: 'token', content: t })
      })
    } catch (err) {
      opts.onEvent({
        type: 'error',
        content: err instanceof Error ? err.message : 'Agent model failed',
      })
      return
    }

    const tool = parseTool(full)
    if (!tool) {
      // Fallback: treat as final answer
      opts.onEvent({
        type: 'done',
        content: transcript || full,
        edits,
        applied,
      })
      return
    }

    opts.onEvent({ type: 'tool', tool, content: tool.name })
    const { result, edit } = runTool(config.workspacePath, tool)
    opts.onEvent({ type: 'tool_result', result, content: result.slice(0, 500) })

    if (edit) {
      edits.push(edit)
      if (opts.autoApply) applied.push(edit.path)
      opts.onEvent({ type: 'edit', edits: [edit], applied: opts.autoApply ? [edit.path] : [] })
    }

    if (tool.name === 'finish') {
      opts.onEvent({
        type: 'done',
        content: `${transcript}\n\n**Agent finished:** ${tool.args.summary || 'Done'}`,
        edits,
        applied,
      })
      return
    }

    messages.push({ role: 'assistant', content: full })
    messages.push({
      role: 'user',
      content: `TOOL RESULT (${tool.name}):\n${result}\n\nContinue. Use another tool or finish.`,
    })
  }

  opts.onEvent({
    type: 'done',
    content: `${transcript}\n\n(Agent reached step limit)`,
    edits,
    applied,
  })
}
