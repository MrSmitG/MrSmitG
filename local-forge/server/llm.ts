import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig, ProviderKind } from './config.ts'

export interface LocalModel {
  id: string
  name: string
  sizeBytes?: number
  modifiedAt?: string
  digest?: string
  source: ProviderKind | 'catalog'
  installed: boolean
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
}

/** Curated local-first catalog (pulled via Ollama when available). */
export const MODEL_CATALOG: CatalogModel[] = [
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen2.5 Coder 7B',
    family: 'Qwen',
    sizeLabel: '~4.7 GB',
    params: '7B',
    description: 'Strong coding model for chat, edits, and agent loops on modest hardware.',
    tags: ['coding', 'recommended'],
    ollamaName: 'qwen2.5-coder:7b',
  },
  {
    id: 'qwen2.5-coder-14b',
    name: 'Qwen2.5 Coder 14B',
    family: 'Qwen',
    sizeLabel: '~9 GB',
    params: '14B',
    description: 'Higher-quality coding reasoning when you have more VRAM/RAM.',
    tags: ['coding'],
    ollamaName: 'qwen2.5-coder:14b',
  },
  {
    id: 'deepseek-coder-v2-16b',
    name: 'DeepSeek Coder V2 Lite',
    family: 'DeepSeek',
    sizeLabel: '~8.9 GB',
    params: '16B',
    description: 'Excellent code completion and multi-file reasoning.',
    tags: ['coding'],
    ollamaName: 'deepseek-coder-v2:16b',
  },
  {
    id: 'llama3.2-3b',
    name: 'Llama 3.2 3B',
    family: 'Meta',
    sizeLabel: '~2 GB',
    params: '3B',
    description: 'Fast general assistant for lightweight machines.',
    tags: ['fast', 'chat'],
    ollamaName: 'llama3.2:3b',
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    family: 'Meta',
    sizeLabel: '~4.7 GB',
    params: '8B',
    description: 'Balanced general model for chat and light coding.',
    tags: ['chat'],
    ollamaName: 'llama3.1:8b',
  },
  {
    id: 'codellama-7b',
    name: 'Code Llama 7B',
    family: 'Meta',
    sizeLabel: '~3.8 GB',
    params: '7B',
    description: 'Classic local coding model, good baseline for inline edits.',
    tags: ['coding'],
    ollamaName: 'codellama:7b',
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    family: 'Mistral',
    sizeLabel: '~4.1 GB',
    params: '7B',
    description: 'Capable general model with solid instruction following.',
    tags: ['chat'],
    ollamaName: 'mistral:7b',
  },
  {
    id: 'phi4',
    name: 'Phi-4',
    family: 'Microsoft',
    sizeLabel: '~9.1 GB',
    params: '14B',
    description: 'Strong reasoning density for its size; good for agent tasks.',
    tags: ['reasoning'],
    ollamaName: 'phi4',
  },
  {
    id: 'gemma3-4b',
    name: 'Gemma 3 4B',
    family: 'Google',
    sizeLabel: '~3.3 GB',
    params: '4B',
    description: 'Compact multimodal-capable text model for everyday coding help.',
    tags: ['fast'],
    ollamaName: 'gemma3:4b',
  },
  {
    id: 'starcoder2-7b',
    name: 'StarCoder2 7B',
    family: 'BigCode',
    sizeLabel: '~4 GB',
    params: '7B',
    description: 'Code-specialized model trained on a broad language mix.',
    tags: ['coding'],
    ollamaName: 'starcoder2:7b',
  },
]

export interface PullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
  percent?: number
  error?: string
  done?: boolean
}

type ProgressListener = (event: PullProgress) => void

const activePulls = new Map<string, { process?: ChildProcess; listeners: Set<ProgressListener> }>()

function authHeaders(config: AppConfig): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
  return headers
}

function openAiBase(config: AppConfig): string {
  const url = config.baseUrl.replace(/\/$/, '')
  if (config.provider === 'ollama') {
    // Ollama also exposes /v1
    return url.endsWith('/v1') ? url : `${url}/v1`
  }
  return url.endsWith('/v1') ? url : `${url}/v1`
}

function ollamaRoot(config: AppConfig): string {
  return config.baseUrl.replace(/\/$/, '').replace(/\/v1$/, '')
}

export async function checkProviderHealth(config: AppConfig): Promise<{
  ok: boolean
  provider: ProviderKind
  message: string
  models: number
}> {
  try {
    const models = await listInstalledModels(config)
    return {
      ok: true,
      provider: config.provider,
      message: `Connected to ${config.provider} at ${config.baseUrl}`,
      models: models.length,
    }
  } catch (err) {
    return {
      ok: false,
      provider: config.provider,
      message: err instanceof Error ? err.message : 'Provider unreachable',
      models: 0,
    }
  }
}

export async function listInstalledModels(config: AppConfig): Promise<LocalModel[]> {
  if (config.provider === 'ollama') {
    const res = await fetch(`${ollamaRoot(config)}/api/tags`, {
      headers: authHeaders(config),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}`)
    const data = (await res.json()) as {
      models?: Array<{ name: string; size?: number; modified_at?: string; digest?: string }>
    }
    return (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      sizeBytes: m.size,
      modifiedAt: m.modified_at,
      digest: m.digest,
      source: 'ollama' as const,
      installed: true,
    }))
  }

  const res = await fetch(`${openAiBase(config)}/models`, {
    headers: authHeaders(config),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Provider error ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { data?: Array<{ id: string }> }
  return (data.data ?? []).map((m) => ({
    id: m.id,
    name: m.id,
    source: config.provider,
    installed: true,
  }))
}

export function listLocalDiskModels(modelsPath: string): LocalModel[] {
  if (!existsSync(modelsPath)) return []
  const entries: LocalModel[] = []
  for (const name of readdirSync(modelsPath)) {
    const full = join(modelsPath, name)
    try {
      const st = statSync(full)
      if (st.isFile() && /\.(gguf|bin|safetensors)$/i.test(name)) {
        entries.push({
          id: name,
          name,
          sizeBytes: st.size,
          modifiedAt: st.mtime.toISOString(),
          source: 'catalog',
          installed: true,
        })
      } else if (st.isDirectory()) {
        entries.push({
          id: name,
          name,
          sizeBytes: undefined,
          modifiedAt: st.mtime.toISOString(),
          source: 'catalog',
          installed: true,
        })
      }
    } catch {
      /* skip */
    }
  }
  return entries
}

export async function chatCompletion(
  config: AppConfig,
  body: {
    messages: Array<{ role: string; content: string }>
    stream?: boolean
    temperature?: number
    model?: string
  },
): Promise<Response> {
  const model = body.model || config.selectedModel
  if (!model) throw new Error('No model selected. Open Model Hub and choose or download one.')

  if (config.provider === 'ollama' && !config.baseUrl.includes('/v1')) {
    // Native Ollama chat API (better tool-less streaming)
    const res = await fetch(`${ollamaRoot(config)}/api/chat`, {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify({
        model,
        messages: body.messages,
        stream: body.stream ?? true,
        options: { temperature: body.temperature ?? config.temperature },
      }),
    })
    if (!res.ok) throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`)
    return res
  }

  const res = await fetch(`${openAiBase(config)}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      model,
      messages: body.messages,
      stream: body.stream ?? true,
      temperature: body.temperature ?? config.temperature,
    }),
  })
  if (!res.ok) throw new Error(`Chat failed: ${res.status} ${await res.text()}`)
  return res
}

export function ensureModelsPath(path: string): string {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
  return path
}

/**
 * Pull a model via Ollama with optional custom models directory (OLLAMA_MODELS).
 * Streams progress events to listeners.
 */
export async function pullOllamaModel(
  config: AppConfig,
  modelName: string,
  onProgress: ProgressListener,
): Promise<void> {
  ensureModelsPath(config.modelsPath)

  const key = modelName
  if (activePulls.has(key)) {
    activePulls.get(key)!.listeners.add(onProgress)
    return
  }

  const listeners = new Set<ProgressListener>([onProgress])
  activePulls.set(key, { listeners })

  const broadcast = (event: PullProgress) => {
    for (const l of listeners) l(event)
  }

  try {
    const res = await fetch(`${ollamaRoot(config)}/api/pull`, {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify({ name: modelName, stream: true }),
      // Note: Ollama honors OLLAMA_MODELS from its own process env.
      // We also set it on a helper `ollama pull` spawn as a fallback.
    })

    if (res.ok && res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line) as {
              status?: string
              digest?: string
              total?: number
              completed?: number
              error?: string
            }
            const percent =
              json.total && json.completed != null
                ? Math.min(100, Math.round((json.completed / json.total) * 100))
                : undefined
            broadcast({
              status: json.status ?? 'downloading',
              digest: json.digest,
              total: json.total,
              completed: json.completed,
              percent,
              error: json.error,
              done: json.status === 'success',
            })
            if (json.error) throw new Error(json.error)
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }
      broadcast({ status: 'success', percent: 100, done: true })
      return
    }

    // Fallback: spawn `ollama pull` with OLLAMA_MODELS pointing at user path
    await new Promise<void>((resolve, reject) => {
      const child = spawn('ollama', ['pull', modelName], {
        env: { ...process.env, OLLAMA_MODELS: config.modelsPath },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      activePulls.get(key)!.process = child
      const handle = (chunk: Buffer) => {
        const text = chunk.toString()
        broadcast({ status: text.trim() || 'downloading' })
      }
      child.stdout?.on('data', handle)
      child.stderr?.on('data', handle)
      child.on('error', (err) => {
        broadcast({ status: 'error', error: err.message, done: true })
        reject(err)
      })
      child.on('close', (code) => {
        if (code === 0) {
          broadcast({ status: 'success', percent: 100, done: true })
          resolve()
        } else {
          const err = new Error(`ollama pull exited with code ${code}`)
          broadcast({ status: 'error', error: err.message, done: true })
          reject(err)
        }
      })
    })
  } finally {
    activePulls.delete(key)
  }
}

export function subscribePull(modelName: string, listener: ProgressListener): () => void {
  const entry = activePulls.get(modelName)
  if (!entry) return () => undefined
  entry.listeners.add(listener)
  return () => entry.listeners.delete(listener)
}

export async function deleteOllamaModel(config: AppConfig, modelName: string): Promise<void> {
  const res = await fetch(`${ollamaRoot(config)}/api/delete`, {
    method: 'DELETE',
    headers: authHeaders(config),
    body: JSON.stringify({ name: modelName }),
  })
  if (!res.ok) throw new Error(`Failed to delete model: ${res.status} ${await res.text()}`)
}
