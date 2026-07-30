import http from 'node:http'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronBin = require('electron')

function waitFor(url, label) {
  return new Promise((resolve, reject) => {
    let left = 90
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) resolve()
        else retry()
      })
      req.on('error', retry)
      req.setTimeout(800, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      left -= 1
      if (left <= 0) reject(new Error(`Timed out waiting for ${label}: ${url}`))
      else setTimeout(tick, 400)
    }
    tick()
  })
}

await waitFor('http://127.0.0.1:8787/api/health', 'API')
await waitFor('http://127.0.0.1:5173', 'Vite UI')

const child = spawn(electronBin, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    LOCALFORGE_DEV_UI: 'http://127.0.0.1:5173',
    LOCALFORGE_PORT: '8787',
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
