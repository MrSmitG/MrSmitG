import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, providerDefaults, saveConfig, type AppConfig, type ProviderKind } from './config.ts'
import {
  MODEL_CATALOG,
  chatCompletion,
  checkProviderHealth,
  deleteOllamaModel,
  listInstalledModels,
  listLocalDiskModels,
  pullOllamaModel,
  ensureModelsPath,
} from './llm.ts'
import { loadProjectRules, runAgentLoop } from './agent.ts'
import { buildSystemPrompt, buildUserPayload, parseEditFences, type AgentMode } from './prompts.ts'
import { runTerminalCommand } from './terminal.ts'
import { assertCanUseInternet, assertLocalProvider, isLocalBaseUrl } from './offline.ts'
import {
  deleteWorkspaceFile,
  gatherContextFiles,
  listTree,
  readWorkspaceFile,
  renameWorkspaceFile,
  searchWorkspace,
  seedDemoWorkspace,
  writeWorkspaceFile,
} from './workspace.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PORT = Number(process.env.PORT || 8787)
const VERSION = '0.3.0'

const app = express()
app.use(cors())
app.use(express.json({ limit: '8mb' }))

function cfg(): AppConfig {
  const c = loadConfig()
  seedDemoWorkspace(c.workspacePath)
  ensureModelsPath(c.modelsPath)
  return c
}

app.get('/api/health', async (_req, res) => {
  const config = cfg()
  const health = await checkProviderHealth(config)
  res.json({
    app: 'LocalForge',
    version: VERSION,
    config: {
      provider: config.provider,
      baseUrl: config.baseUrl,
      selectedModel: config.selectedModel,
      modelsPath: config.modelsPath,
      workspacePath: config.workspacePath,
      offlineMode: config.offlineMode,
    },
    provider: health,
    offlineMode: config.offlineMode,
    features: [
      'ask',
      'edit',
      'agent-tools',
      'inline-edit',
      'model-hub',
      'terminal',
      'command-palette',
      'diff-preview',
      'project-rules',
      'offline-mode',
    ],
  })
})

app.get('/api/config', (_req, res) => {
  res.json(cfg())
})

app.put('/api/config', (req, res) => {
  try {
    const body = req.body as Partial<AppConfig> & { provider?: ProviderKind }
    const patch: Partial<AppConfig> = { ...body }
    if (body.provider && !body.baseUrl) {
      Object.assign(patch, providerDefaults(body.provider))
    }
    if (body.provider === 'demo' && !body.selectedModel) {
      patch.selectedModel = 'demo-coder'
    }

    const current = cfg()
    const nextOffline = patch.offlineMode ?? current.offlineMode
    const nextBase = patch.baseUrl ?? current.baseUrl
    if (nextOffline) {
      assertLocalProvider(nextBase, true)
      // Remote URLs are rejected; keep users on local engines only.
      if (patch.baseUrl && !isLocalBaseUrl(patch.baseUrl)) {
        return res.status(400).json({ error: 'Offline mode allows localhost providers only' })
      }
    }

    const next = saveConfig(patch)
    seedDemoWorkspace(next.workspacePath)
    ensureModelsPath(next.modelsPath)
    res.json(next)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Config update failed' })
  }
})

app.get('/api/models', async (_req, res) => {
  const config = cfg()
  let installed: Awaited<ReturnType<typeof listInstalledModels>> = []
  let providerError: string | null = null
  try {
    installed = await listInstalledModels(config)
  } catch (err) {
    providerError = err instanceof Error ? err.message : 'Failed to list models'
  }
  const disk = listLocalDiskModels(config.modelsPath)
  const installedIds = new Set(installed.map((m) => m.id.toLowerCase()))
  const catalog = MODEL_CATALOG.map((m) => ({
    ...m,
    installed:
      installedIds.has(m.ollamaName.toLowerCase()) ||
      installedIds.has(m.id.toLowerCase()) ||
      installed.some((i) => i.id.toLowerCase().startsWith(m.ollamaName.split(':')[0].toLowerCase())),
  }))
  res.json({
    provider: config.provider,
    selectedModel: config.selectedModel,
    modelsPath: config.modelsPath,
    offlineMode: config.offlineMode,
    installed,
    disk,
    catalog,
    providerError,
  })
})

app.post('/api/models/select', (req, res) => {
  const { model } = req.body as { model?: string }
  if (!model) return res.status(400).json({ error: 'model required' })
  const next = saveConfig({ selectedModel: model })
  res.json(next)
})

app.post('/api/models/pull', async (req, res) => {
  const config = cfg()
  const { model, ollamaName } = req.body as { model?: string; ollamaName?: string }
  const name = ollamaName || model
  if (!name) return res.status(400).json({ error: 'model name required' })

  try {
    assertCanUseInternet(config.offlineMode, 'downloading models')
  } catch (err) {
    return res.status(403).json({ error: err instanceof Error ? err.message : 'Blocked by offline mode' })
  }

  if (config.provider !== 'ollama') {
    return res.status(400).json({
      error:
        'Model download via LocalForge currently uses Ollama. Switch provider to Ollama, or download models in LM Studio / your runner and refresh.',
    })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    process.env.OLLAMA_MODELS = config.modelsPath
    await pullOllamaModel(config, name, (event) => send(event))
    saveConfig({ selectedModel: name })
    send({ status: 'success', percent: 100, done: true, selected: name })
  } catch (err) {
    send({ status: 'error', error: err instanceof Error ? err.message : 'Pull failed', done: true })
  } finally {
    res.end()
  }
})

app.delete('/api/models/:name', async (req, res) => {
  const config = cfg()
  try {
    await deleteOllamaModel(config, decodeURIComponent(req.params.name))
    if (config.selectedModel === decodeURIComponent(req.params.name)) {
      saveConfig({ selectedModel: '' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed' })
  }
})

app.get('/api/workspace/tree', (_req, res) => {
  const config = cfg()
  res.json({ root: config.workspacePath, tree: listTree(config.workspacePath) })
})

app.get('/api/workspace/file', (req, res) => {
  const config = cfg()
  const path = String(req.query.path || '')
  try {
    res.json(readWorkspaceFile(config.workspacePath, path))
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Not found' })
  }
})

app.put('/api/workspace/file', (req, res) => {
  const config = cfg()
  const { path, content } = req.body as { path?: string; content?: string }
  if (!path || content == null) return res.status(400).json({ error: 'path and content required' })
  try {
    res.json(writeWorkspaceFile(config.workspacePath, path, content))
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Write failed' })
  }
})

app.post('/api/workspace/file', (req, res) => {
  const config = cfg()
  const { path, content = '' } = req.body as { path?: string; content?: string }
  if (!path) return res.status(400).json({ error: 'path required' })
  try {
    res.json(writeWorkspaceFile(config.workspacePath, path, content))
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Create failed' })
  }
})

app.delete('/api/workspace/file', (req, res) => {
  const config = cfg()
  const path = String(req.query.path || '')
  try {
    deleteWorkspaceFile(config.workspacePath, path)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Delete failed' })
  }
})

app.post('/api/workspace/rename', (req, res) => {
  const config = cfg()
  const { from, to } = req.body as { from?: string; to?: string }
  if (!from || !to) return res.status(400).json({ error: 'from and to required' })
  try {
    res.json(renameWorkspaceFile(config.workspacePath, from, to))
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Rename failed' })
  }
})

app.get('/api/workspace/search', (req, res) => {
  const config = cfg()
  const q = String(req.query.q || '')
  res.json({ hits: searchWorkspace(config.workspacePath, q) })
})

app.get('/api/workspace/rules', (_req, res) => {
  const config = cfg()
  res.json({ rules: loadProjectRules(config.workspacePath) })
})

app.post('/api/terminal', async (req, res) => {
  const config = cfg()
  const { command } = req.body as { command?: string }
  if (!command?.trim()) return res.status(400).json({ error: 'command required' })
  try {
    const result = await runTerminalCommand(config.workspacePath, command)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Terminal failed' })
  }
})

app.post('/api/chat', async (req, res) => {
  const config = cfg()
  const {
    prompt,
    mode = 'ask',
    history = [],
    openFiles = [],
    activeFile,
    selection,
    applyEdits = false,
    mentionedFiles = [],
  } = req.body as {
    prompt?: string
    mode?: AgentMode
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    openFiles?: string[]
    activeFile?: string
    selection?: string
    applyEdits?: boolean
    mentionedFiles?: string[]
  }

  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' })

  if (mode === 'agent') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)
    const ac = new AbortController()
    const onClientGone = () => {
      if (!res.writableEnded) ac.abort()
    }
    res.on('close', onClientGone)
    try {
      await runAgentLoop({
        prompt,
        mode,
        history,
        openFiles: [...openFiles, ...mentionedFiles],
        activeFile,
        selection,
        autoApply: applyEdits,
        signal: ac.signal,
        onEvent: (e) => send(e),
      })
    } catch (err) {
      send({ type: 'error', content: err instanceof Error ? err.message : 'Agent failed' })
    } finally {
      res.end()
    }
    return
  }

  const rules = loadProjectRules(config.workspacePath)
  const context = gatherContextFiles(
    config.workspacePath,
    [activeFile, ...openFiles, ...mentionedFiles].filter(Boolean) as string[],
  )

  const messages = [
    {
      role: 'system',
      content: `${buildSystemPrompt(mode, config)}${rules ? `\n\nProject rules:\n${rules}` : ''}`,
    },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: buildUserPayload({ prompt, context, selection, activeFile }),
    },
  ]

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  try {
    const upstream = await chatCompletion(config, { messages, stream: true })
    const reader = upstream.body?.getReader()
    if (!reader) throw new Error('No response body from model provider')

    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    while (true) {
      if (req.aborted) {
        reader.cancel().catch(() => undefined)
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      if (
        (config.provider === 'ollama' && !config.baseUrl.includes('/v1')) ||
        config.provider === 'demo'
      ) {
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line) as {
              message?: { content?: string }
              done?: boolean
            }
            const token = json.message?.content ?? ''
            if (token) {
              full += token
              send({ type: 'token', content: token })
            }
            if (json.done) send({ type: 'status', content: 'complete' })
          } catch {
            /* ignore partial */
          }
        }
      } else {
        const chunks = buffer.split('\n')
        buffer = chunks.pop() ?? ''
        for (const line of chunks) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') {
            send({ type: 'status', content: 'complete' })
            continue
          }
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const token = json.choices?.[0]?.delta?.content ?? ''
            if (token) {
              full += token
              send({ type: 'token', content: token })
            }
          } catch {
            /* ignore */
          }
        }
      }
    }

    const edits = parseEditFences(full)
    const applied: string[] = []
    if (applyEdits && mode === 'edit' && edits.length) {
      for (const edit of edits) {
        writeWorkspaceFile(config.workspacePath, edit.path, edit.content)
        applied.push(edit.path)
      }
    }

    send({ type: 'done', content: full, edits, applied })
  } catch (err) {
    send({
      type: 'error',
      content:
        err instanceof Error
          ? err.message
          : 'Chat failed. Is your local LLM server running?',
    })
  } finally {
    res.end()
  }
})

app.post('/api/edits/apply', (req, res) => {
  const config = cfg()
  const { edits } = req.body as { edits?: Array<{ path: string; content: string }> }
  if (!edits?.length) return res.status(400).json({ error: 'edits required' })
  const applied: string[] = []
  for (const edit of edits) {
    writeWorkspaceFile(config.workspacePath, edit.path, edit.content)
    applied.push(edit.path)
  }
  res.json({ applied })
})

app.post('/api/edits/preview', (req, res) => {
  const config = cfg()
  const { edits } = req.body as { edits?: Array<{ path: string; content: string }> }
  if (!edits?.length) return res.status(400).json({ error: 'edits required' })
  const previews = edits.map((edit) => {
    let before = ''
    try {
      before = readWorkspaceFile(config.workspacePath, edit.path).content
    } catch {
      before = ''
    }
    return { path: edit.path, before, after: edit.content, isNew: before === '' }
  })
  res.json({ previews })
})

const dist = join(ROOT, 'dist')
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, 'index.html'))
  })
}

app.listen(PORT, () => {
  const config = cfg()
  console.log(`LocalForge ${VERSION} on http://127.0.0.1:${PORT}`)
  console.log(`Workspace: ${config.workspacePath}`)
  console.log(`Models path: ${config.modelsPath}`)
  console.log(`Provider: ${config.provider} @ ${config.baseUrl}`)
})
