import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appendFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'agent-debug-log',
      configureServer(server) {
        server.middlewares.use('/__agent-debug', (req, res, next) => {
          if (req.method !== 'POST') {
            next()
            return
          }

          let body = ''
          req.setEncoding('utf8')
          req.on('data', (chunk: string) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const entry = JSON.parse(body) as Record<string, unknown>
              // #region agent log
              appendFileSync('/opt/cursor/logs/debug.log', `${JSON.stringify(entry)}\n`)
              // #endregion
              res.statusCode = 204
            } catch {
              res.statusCode = 400
            }
            res.end()
          })
        })
      },
    },
  ],
})
