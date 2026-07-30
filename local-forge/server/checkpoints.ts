import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkspaceFile, writeWorkspaceFile } from './workspace.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CP_DIR = join(ROOT, '.local-forge', 'checkpoints')

export interface Checkpoint {
  id: string
  label: string
  createdAt: string
  files: Array<{ path: string; content: string }>
}

function ensureDir(): void {
  if (!existsSync(CP_DIR)) mkdirSync(CP_DIR, { recursive: true })
}

export function createCheckpoint(
  workspacePath: string,
  paths: string[],
  label = 'checkpoint',
): Checkpoint {
  ensureDir()
  const files: Checkpoint['files'] = []
  for (const path of [...new Set(paths)]) {
    try {
      files.push({ path, content: readWorkspaceFile(workspacePath, path).content })
    } catch {
      files.push({ path, content: '' })
    }
  }
  const cp: Checkpoint = {
    id: `cp_${Date.now().toString(36)}`,
    label,
    createdAt: new Date().toISOString(),
    files,
  }
  writeFileSync(join(CP_DIR, `${cp.id}.json`), JSON.stringify(cp, null, 2))
  return cp
}

export function listCheckpoints(): Array<Pick<Checkpoint, 'id' | 'label' | 'createdAt'> & { fileCount: number }> {
  ensureDir()
  const out = []
  for (const name of readdirSync(CP_DIR)) {
    if (!name.endsWith('.json')) continue
    try {
      const cp = JSON.parse(readFileSync(join(CP_DIR, name), 'utf8')) as Checkpoint
      out.push({
        id: cp.id,
        label: cp.label,
        createdAt: cp.createdAt,
        fileCount: cp.files.length,
      })
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40)
}

export function restoreCheckpoint(workspacePath: string, id: string): { restored: string[] } {
  const p = join(CP_DIR, `${id}.json`)
  if (!existsSync(p)) throw new Error('Checkpoint not found')
  const cp = JSON.parse(readFileSync(p, 'utf8')) as Checkpoint
  const restored: string[] = []
  for (const f of cp.files) {
    writeWorkspaceFile(workspacePath, f.path, f.content)
    restored.push(f.path)
  }
  return { restored }
}

export function deleteCheckpoint(id: string): void {
  const p = join(CP_DIR, `${id}.json`)
  if (existsSync(p)) rmSync(p)
}
