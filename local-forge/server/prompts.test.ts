import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseEditFences, buildSystemPrompt, buildUserPayload } from './prompts.ts'
import { guessLanguage } from './workspace.ts'

describe('parseEditFences', () => {
  it('extracts path fences', () => {
    const text = `Here you go:
\`\`\`path=src/main.ts
export const x = 1
\`\`\`
and another
\`\`\`path=README.md
# hi
\`\`\`
`
    const edits = parseEditFences(text)
    assert.equal(edits.length, 2)
    assert.equal(edits[0].path, 'src/main.ts')
    assert.equal(edits[0].content, 'export const x = 1')
    assert.equal(edits[1].path, 'README.md')
  })

  it('returns empty when no fences', () => {
    assert.deepEqual(parseEditFences('just text'), [])
  })
})

describe('prompts', () => {
  it('includes mode hints', () => {
    const ask = buildSystemPrompt('ask', {
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: '',
      selectedModel: 'qwen2.5-coder:7b',
      modelsPath: '/tmp/models',
      workspacePath: '/tmp/ws',
      temperature: 0.2,
      contextWindowHint: 8192,
      autoSave: true,
      tabAutocomplete: true,
      recentWorkspaces: [],
      activeSessionId: '',
      offlineMode: true,
      graphLlm: true,
    })
    assert.match(ask, /Mode: ASK/)
    assert.match(ask, /qwen2.5-coder:7b/)
  })

  it('builds user payload with context', () => {
    const payload = buildUserPayload({
      prompt: 'refactor greet',
      context: '### File: a.ts',
      activeFile: 'a.ts',
      selection: 'fn',
    })
    assert.match(payload, /Active file: a.ts/)
    assert.match(payload, /Selected code/)
    assert.match(payload, /refactor greet/)
  })
})

describe('guessLanguage', () => {
  it('maps common extensions', () => {
    assert.equal(guessLanguage('a.ts'), 'typescript')
    assert.equal(guessLanguage('b.py'), 'python')
    assert.equal(guessLanguage('c.unknown'), 'plaintext')
  })
})
