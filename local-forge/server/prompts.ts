import type { AppConfig } from './config.ts'

export type AgentMode = 'ask' | 'edit' | 'agent'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_BASE = `You are LocalForge, a Cursor-like AI coding assistant that runs entirely on the user's local LLM.
You help write, explain, refactor, and debug code.
Be concise and practical. Prefer concrete code changes over long essays.
When proposing file edits, use this exact fence format so the IDE can apply them:

\`\`\`path=relative/path/to/file.ext
entire new file contents
\`\`\`

Rules:
- Only emit path= fences for files you intend to change.
- Preserve unrelated code when editing.
- Never invent APIs you cannot see in context.
- If context is missing, ask a short clarifying question or state assumptions.
`

export function buildSystemPrompt(mode: AgentMode, config: AppConfig): string {
  const modeHint =
    mode === 'ask'
      ? 'Mode: ASK — answer questions and explain. Do not emit path= edit fences unless the user explicitly asks for code.'
      : mode === 'edit'
        ? 'Mode: EDIT — propose focused file edits using path= fences. Keep diffs minimal.'
        : 'Mode: AGENT — plan briefly, then implement. You may touch multiple files via path= fences. After edits, summarize what changed.'

  return `${SYSTEM_BASE}

${modeHint}

Provider: ${config.provider}
Selected model: ${config.selectedModel || '(none)'}
`
}

export function buildUserPayload(opts: {
  prompt: string
  context: string
  selection?: string
  activeFile?: string
}): string {
  const parts: string[] = []
  if (opts.activeFile) parts.push(`Active file: ${opts.activeFile}`)
  if (opts.selection?.trim()) {
    parts.push(`Selected code:\n\`\`\`\n${opts.selection}\n\`\`\``)
  }
  if (opts.context.trim()) {
    parts.push(`Workspace context:\n${opts.context}`)
  }
  parts.push(`User request:\n${opts.prompt}`)
  return parts.join('\n\n')
}

/** Parse assistant output for applyable file edits. */
export function parseEditFences(
  text: string,
): Array<{ path: string; content: string }> {
  const edits: Array<{ path: string; content: string }> = []
  const re = /```path=([^\n]+)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const path = m[1].trim()
    const content = m[2].replace(/\n$/, '')
    if (path) edits.push({ path, content })
  }
  return edits
}
