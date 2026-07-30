import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectRules, runAgentLoop } from './agent.ts'
import { saveConfig } from './config.ts'
import { runTerminalCommand } from './terminal.ts'

describe('loadProjectRules', () => {
  it('reads .localforgerules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-rules-'))
    writeFileSync(join(dir, '.localforgerules'), 'Be concise.\n')
    assert.match(loadProjectRules(dir), /Be concise/)
  })
})

describe('terminal', () => {
  it('runs a safe command in workspace', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-term-'))
    writeFileSync(join(dir, 'hello.txt'), 'hi')
    const result = await runTerminalCommand(dir, 'cat hello.txt')
    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /hi/)
  })

  it('blocks dangerous patterns', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-term-'))
    await assert.rejects(() => runTerminalCommand(dir, 'rm -rf /'), /blocked/)
  })
})

describe('demo agent loop', () => {
  it('reads then writes then finishes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lf-agent-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'src', 'main.ts'),
      'export function greet(name: string) { return name }\n',
    )
    saveConfig({
      provider: 'demo',
      baseUrl: 'local://demo',
      selectedModel: 'demo-coder',
      workspacePath: dir,
      modelsPath: join(dir, 'models'),
    })

    const events: string[] = []
    await runAgentLoop({
      prompt: 'Rename greet to welcome',
      mode: 'agent',
      history: [],
      openFiles: ['src/main.ts'],
      activeFile: 'src/main.ts',
      autoApply: true,
      onEvent: (e) => events.push(e.type),
    })

    assert.ok(events.includes('tool'))
    assert.ok(events.includes('done'))
    assert.ok(events.includes('edit'))
  })
})
