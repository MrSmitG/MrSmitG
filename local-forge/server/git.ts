import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

function run(cwd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    let out = ''
    let err = ''
    child.stdout?.on('data', (b: Buffer) => {
      out += b.toString()
    })
    child.stderr?.on('data', (b: Buffer) => {
      err += b.toString()
    })
    child.on('close', (code) => resolvePromise({ code: code ?? 1, out, err }))
    child.on('error', (e) => resolvePromise({ code: 1, out: '', err: e.message }))
  })
}

export interface GitStatus {
  available: boolean
  branch?: string
  dirty: boolean
  files: Array<{ path: string; status: string }>
  error?: string
}

export async function gitStatus(workspacePath: string): Promise<GitStatus> {
  const cwd = resolve(workspacePath)
  const head = await run(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (head.code !== 0) {
    return { available: false, dirty: false, files: [], error: 'Not a git repository' }
  }
  const branch = await run(cwd, ['branch', '--show-current'])
  const porcelain = await run(cwd, ['status', '--porcelain'])
  const files = porcelain.out
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim() || line.slice(0, 2),
      path: line.slice(3).trim(),
    }))
  return {
    available: true,
    branch: branch.out.trim() || 'HEAD',
    dirty: files.length > 0,
    files,
  }
}

export async function gitDiff(workspacePath: string, path?: string): Promise<string> {
  const cwd = resolve(workspacePath)
  const args = path ? ['diff', '--', path] : ['diff']
  const result = await run(cwd, args)
  if (result.code !== 0 && !result.out) throw new Error(result.err || 'git diff failed')
  return result.out || '(no diff)'
}
