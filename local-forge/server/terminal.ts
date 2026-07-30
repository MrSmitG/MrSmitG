import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const BLOCKED = [/rm\s+-rf\s+\//, /mkfs/, /dd\s+if=/, /:\(\)\s*\{/, /shutdown/, /reboot/]

export interface TerminalResult {
  command: string
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  truncated: boolean
}

export async function runTerminalCommand(
  workspacePath: string,
  command: string,
  timeoutMs = 20000,
): Promise<TerminalResult> {
  const trimmed = command.trim()
  if (!trimmed) throw new Error('Empty command')
  if (BLOCKED.some((re) => re.test(trimmed))) {
    throw new Error('Command blocked for safety')
  }

  const cwd = resolve(workspacePath)
  return new Promise((resolvePromise, reject) => {
    const child = spawn(trimmed, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    let stdout = ''
    let stderr = ''
    let truncated = false
    const max = 200_000

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout?.on('data', (buf: Buffer) => {
      if (stdout.length < max) stdout += buf.toString()
      else truncated = true
    })
    child.stderr?.on('data', (buf: Buffer) => {
      if (stderr.length < max) stderr += buf.toString()
      else truncated = true
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({
        command: trimmed,
        cwd,
        exitCode: code,
        stdout,
        stderr,
        truncated,
      })
    })
  })
}
