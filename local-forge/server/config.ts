import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CONFIG_PATH = join(ROOT, '.local-forge', 'config.json')

export type ProviderKind = 'ollama' | 'lmstudio' | 'openai-compatible' | 'demo'

export interface AppConfig {
  provider: ProviderKind
  baseUrl: string
  apiKey: string
  selectedModel: string
  modelsPath: string
  workspacePath: string
  temperature: number
  contextWindowHint: number
}

const DEFAULTS: AppConfig = {
  provider: 'demo',
  baseUrl: 'local://demo',
  apiKey: '',
  selectedModel: 'demo-coder',
  modelsPath: join(homedir(), '.local-forge', 'models'),
  workspacePath: join(ROOT, 'demo-workspace'),
  temperature: 0.2,
  contextWindowHint: 8192,
}

function ensureConfigFile(): void {
  const dir = dirname(CONFIG_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2))
  }
}

export function loadConfig(): AppConfig {
  ensureConfigFile()
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<AppConfig>
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  const next = { ...loadConfig(), ...patch }
  ensureConfigFile()
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2))
  if (next.modelsPath && !existsSync(next.modelsPath)) {
    mkdirSync(next.modelsPath, { recursive: true })
  }
  return next
}

export function providerDefaults(kind: ProviderKind): Pick<AppConfig, 'baseUrl' | 'apiKey'> {
  switch (kind) {
    case 'ollama':
      return { baseUrl: 'http://127.0.0.1:11434', apiKey: '' }
    case 'lmstudio':
      return { baseUrl: 'http://127.0.0.1:1234/v1', apiKey: 'lm-studio' }
    case 'openai-compatible':
      return { baseUrl: 'http://127.0.0.1:8080/v1', apiKey: '' }
    case 'demo':
      return { baseUrl: 'local://demo', apiKey: '' }
  }
}
