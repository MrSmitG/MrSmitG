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
  createSession,
  deleteSession,
  exportSessionMarkdown,
  getSession,
  listSessions,
  saveSession,
  type ChatSession,
} from './sessions.ts'
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
} from './checkpoints.ts'
import { gitDiff, gitStatus } from './git.ts'
import { completePrefix } from './autocomplete.ts'
import {
  getCachedGraph,
  queryGraph,
  readSymbolSnippet,
  subgraphForView,
} from './graph.ts'
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
const VERSION = '0.6.0'

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
      'chat-sessions',
      'checkpoints',
      'git-status',
      'find-in-files',
      'tab-autocomplete',
      'graph-llm',
      'mac-desktop',
      'native-folder-picker',
      'desktop-notifications',
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

  let graphBlock = ''
  if (config.graphLlm) {
    const graph = getCachedGraph(config.workspacePath)
    const { context: gctx, hits } = queryGraph(graph, prompt, 8)
    const snippets: string[] = []
    for (const hit of hits.slice(0, 4)) {
      const snip = readSymbolSnippet(config.workspacePath, hit.node)
      if (snip) snippets.push(`### ${hit.node.label}\n\`\`\`\n${snip}\n\`\`\``)
    }
    graphBlock = [gctx, ...snippets].filter(Boolean).join('\n\n')
  }

  const messages = [
    {
      role: 'system',
      content: `${buildSystemPrompt(mode, config)}${rules ? `\n\nProject rules:\n${rules}` : ''}${
        config.graphLlm
          ? '\n\nGraph LLM is enabled: use the knowledge-graph context when reasoning about symbols and dependencies.'
          : ''
      }`,
    },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: buildUserPayload({
        prompt,
        context: [graphBlock, context].filter(Boolean).join('\n\n'),
        selection,
        activeFile,
      }),
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


app.get('/api/sessions', (_req, res) => {
  res.json({ sessions: listSessions() })
})

app.post('/api/sessions', (req, res) => {
  const { title, mode } = req.body as { title?: string; mode?: AgentMode }
  const session = createSession(title, mode || 'ask')
  saveConfig({ activeSessionId: session.id })
  res.json(session)
})

app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  res.json(session)
})

app.put('/api/sessions/:id', (req, res) => {
  const existing = getSession(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Session not found' })
  const body = req.body as Partial<ChatSession>
  const next: ChatSession = {
    ...existing,
    title: body.title ?? existing.title,
    mode: body.mode ?? existing.mode,
    messages: body.messages ?? existing.messages,
  }
  res.json(saveSession(next))
})

app.delete('/api/sessions/:id', (req, res) => {
  deleteSession(req.params.id)
  const config = cfg()
  if (config.activeSessionId === req.params.id) saveConfig({ activeSessionId: '' })
  res.json({ ok: true })
})

app.get('/api/sessions/:id/export', (req, res) => {
  try {
    const md = exportSessionMarkdown(req.params.id)
    res.type('text/markdown').send(md)
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Export failed' })
  }
})

app.get('/api/checkpoints', (_req, res) => {
  res.json({ checkpoints: listCheckpoints() })
})

app.post('/api/checkpoints', (req, res) => {
  const config = cfg()
  const { paths, label } = req.body as { paths?: string[]; label?: string }
  if (!paths?.length) return res.status(400).json({ error: 'paths required' })
  res.json(createCheckpoint(config.workspacePath, paths, label || 'checkpoint'))
})

app.post('/api/checkpoints/:id/restore', (req, res) => {
  const config = cfg()
  try {
    res.json(restoreCheckpoint(config.workspacePath, req.params.id))
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Restore failed' })
  }
})

app.delete('/api/checkpoints/:id', (req, res) => {
  deleteCheckpoint(req.params.id)
  res.json({ ok: true })
})

app.get('/api/git/status', async (_req, res) => {
  const config = cfg()
  res.json(await gitStatus(config.workspacePath))
})

app.get('/api/git/diff', async (req, res) => {
  const config = cfg()
  const path = req.query.path ? String(req.query.path) : undefined
  try {
    res.json({ diff: await gitDiff(config.workspacePath, path) })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Diff failed' })
  }
})

app.post('/api/complete', async (req, res) => {
  const config = cfg()
  const { prefix, suffix, language, path } = req.body as {
    prefix?: string
    suffix?: string
    language?: string
    path?: string
  }
  if (!config.tabAutocomplete) return res.json({ completion: '' })
  if (!prefix?.trim()) return res.json({ completion: '' })
  try {
    const completion = await completePrefix(config, {
      prefix,
      suffix: suffix || '',
      language: language || 'plaintext',
      path: path || '',
    })
    res.json({ completion })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Complete failed', completion: '' })
  }
})


app.get('/api/graph', (req, res) => {
  const config = cfg()
  const force = String(req.query.rebuild || '') === '1'
  const graph = getCachedGraph(config.workspacePath, force)
  const q = String(req.query.q || '')
  const hitIds = q ? queryGraph(graph, q, 16).hits.map((h) => h.node.id) : []
  const view = subgraphForView(graph, hitIds)
  res.json({
    builtAt: graph.builtAt,
    stats: graph.stats,
    query: q || null,
    hitIds,
    nodes: view.nodes,
    edges: view.edges,
    graphLlm: config.graphLlm,
  })
})

app.post('/api/graph/query', (req, res) => {
  const config = cfg()
  const { query, limit } = req.body as { query?: string; limit?: number }
  if (!query?.trim()) return res.status(400).json({ error: 'query required' })
  const graph = getCachedGraph(config.workspacePath)
  const result = queryGraph(graph, query, limit || 12)
  const snippets = result.hits.slice(0, 6).map((h) => ({
    node: h.node,
    score: h.score,
    snippet: readSymbolSnippet(config.workspacePath, h.node),
  }))
  res.json({ ...result, snippets, stats: graph.stats })
})

app.post('/api/graph/rebuild', (_req, res) => {
  const config = cfg()
  const graph = getCachedGraph(config.workspacePath, true)
  res.json({ ok: true, stats: graph.stats, builtAt: graph.builtAt })
})

app.post('/api/edits/apply', (req, res) => {
  const config = cfg()
  const { edits, checkpoint } = req.body as {
    edits?: Array<{ path: string; content: string }>
    checkpoint?: boolean
  }
  if (!edits?.length) return res.status(400).json({ error: 'edits required' })
  let checkpointId: string | undefined
  if (checkpoint !== false) {
    checkpointId = createCheckpoint(
      config.workspacePath,
      edits.map((e) => e.path),
      'before-apply',
    ).id
  }
  const applied: string[] = []
  for (const edit of edits) {
    writeWorkspaceFile(config.workspacePath, edit.path, edit.content)
    applied.push(edit.path)
  }
  res.json({ applied, checkpointId })
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
const UI_DEV = process.env.LOCALFORGE_DEV_UI || 'http://127.0.0.1:5173'

function sendDevLanding(res: express.Response) {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${UI_DEV}/" />
  <title>LocalForge</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background:#071411; color:#e8f2ee;
      display:grid; place-items:center; min-height:100vh; margin:0; }
    a { color:#e8c468; }
    .card { max-width:420px; padding:28px; border:1px solid #1f3d34; border-radius:12px;
      background:#0c1c18; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin:0 0 8px;font-size:1.4rem;">LocalForge API</h1>
    <p>This is the API port (<code>${PORT}</code>). Opening the UI…</p>
    <p>If you are not redirected, open <a href="${UI_DEV}/">${UI_DEV}</a></p>
    <p style="opacity:.7;font-size:.85rem;">Health: <a href="/api/health">/api/health</a></p>
  </div>
</body>
</html>`)
}

if (existsSync(join(dist, 'index.html'))) {
  // Serve built UI whenever dist exists (production Electron / npm start / accidental :8787 opens).
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, 'index.html'))
  })
} else {
  // Dev: no built UI — redirect root so "Cannot GET /" never appears on the API port.
  app.get('/', (_req, res) => {
    res.redirect(302, `${UI_DEV}/`)
  })
  app.get(/^(?!\/api).*/, (_req, res) => {
    sendDevLanding(res)
  })
}

app.listen(PORT, () => {
  const config = cfg()
  console.log(`LocalForge ${VERSION} on http://127.0.0.1:${PORT}`)
  console.log(`Workspace: ${config.workspacePath}`)
  console.log(`Models path: ${config.modelsPath}`)
  console.log(`Provider: ${config.provider} @ ${config.baseUrl}`)
  if (!existsSync(join(dist, 'index.html'))) {
    console.log(`UI (dev): ${UI_DEV}`)
  }
})
