import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentMode } from './prompts.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SESSIONS_DIR = join(ROOT, '.local-forge', 'sessions')

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface ChatSession {
  id: string
  title: string
  mode: AgentMode
  messages: SessionMessage[]
  createdAt: string
  updatedAt: string
}

function ensureDir(): void {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true })
}

function pathFor(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`)
}

export function listSessions(): Array<Pick<ChatSession, 'id' | 'title' | 'mode' | 'updatedAt' | 'createdAt'> & { messageCount: number }> {
  ensureDir()
  const out = []
  for (const name of readdirSync(SESSIONS_DIR)) {
    if (!name.endsWith('.json')) continue
    try {
      const s = JSON.parse(readFileSync(join(SESSIONS_DIR, name), 'utf8')) as ChatSession
      out.push({
        id: s.id,
        title: s.title,
        mode: s.mode,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages?.length ?? 0,
      })
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSession(id: string): ChatSession | null {
  const p = pathFor(id)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')) as ChatSession
}

export function createSession(title = 'New chat', mode: AgentMode = 'ask'): ChatSession {
  ensureDir()
  const now = new Date().toISOString()
  const session: ChatSession = {
    id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    mode,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  writeFileSync(pathFor(session.id), JSON.stringify(session, null, 2))
  return session
}

export function saveSession(session: ChatSession): ChatSession {
  ensureDir()
  session.updatedAt = new Date().toISOString()
  if (!session.title || session.title === 'New chat') {
    const firstUser = session.messages.find((m) => m.role === 'user')
    if (firstUser) session.title = firstUser.content.trim().slice(0, 48) || session.title
  }
  writeFileSync(pathFor(session.id), JSON.stringify(session, null, 2))
  return session
}

export function deleteSession(id: string): void {
  const p = pathFor(id)
  if (existsSync(p)) unlinkSync(p)
}

export function exportSessionMarkdown(id: string): string {
  const s = getSession(id)
  if (!s) throw new Error('Session not found')
  const lines = [`# ${s.title}`, '', `_mode: ${s.mode}_`, '']
  for (const m of s.messages) {
    lines.push(`## ${m.role === 'user' ? 'You' : 'Assistant'}`, '', m.content, '')
  }
  return lines.join('\n')
}
