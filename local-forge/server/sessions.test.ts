import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createSession,
  deleteSession,
  exportSessionMarkdown,
  getSession,
  listSessions,
  saveSession,
} from './sessions.ts'
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from './checkpoints.ts'
import { writeWorkspaceFile, readWorkspaceFile } from './workspace.ts'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('sessions', () => {
  it('creates, lists, updates, exports, deletes', () => {
    const s = createSession('Hello world test', 'ask')
    assert.ok(s.id)
    const listed = listSessions()
    assert.ok(listed.some((x) => x.id === s.id))
    s.messages.push({
      id: 'm1',
      role: 'user',
      content: 'hi',
      createdAt: new Date().toISOString(),
    })
    saveSession(s)
    const loaded = getSession(s.id)
    assert.equal(loaded?.messages.length, 1)
    const md = exportSessionMarkdown(s.id)
    assert.match(md, /hi/)
    deleteSession(s.id)
    assert.equal(getSession(s.id), null)
  })
})

describe('checkpoints', () => {
  it('snapshots and restores files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-cp-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeWorkspaceFile(dir, 'src/a.ts', 'const a = 1\n')
    const cp = createCheckpoint(dir, ['src/a.ts'], 'test')
    writeWorkspaceFile(dir, 'src/a.ts', 'const a = 2\n')
    assert.equal(readWorkspaceFile(dir, 'src/a.ts').content, 'const a = 2\n')
    restoreCheckpoint(dir, cp.id)
    assert.equal(readWorkspaceFile(dir, 'src/a.ts').content, 'const a = 1\n')
    assert.ok(listCheckpoints().some((c) => c.id === cp.id))
  })
})
