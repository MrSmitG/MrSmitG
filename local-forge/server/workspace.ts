import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  unlinkSync,
  renameSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.local-forge',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
])

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.txt',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.sh',
  '.yml',
  '.yaml',
  '.toml',
  '.sql',
  '.graphql',
  '.vue',
  '.svelte',
  '.env',
  '.gitignore',
  '.dockerignore',
  'Dockerfile',
  'Makefile',
])

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith('..'))
}

function safeResolve(workspacePath: string, relPath: string): string {
  const full = resolve(workspacePath, relPath)
  if (!isInside(resolve(workspacePath), full)) {
    throw new Error('Path escapes workspace')
  }
  return full
}

export function ensureWorkspace(workspacePath: string): void {
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true })
  }
}

export function listTree(workspacePath: string, maxDepth = 6): FileNode[] {
  ensureWorkspace(workspacePath)
  const root = resolve(workspacePath)

  function walk(dir: string, depth: number): FileNode[] {
    if (depth > maxDepth) return []
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const nodes: FileNode[] = []
    for (const entry of entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })) {
      if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      const rel = relative(root, full).split(sep).join('/')
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: rel,
          type: 'dir',
          children: walk(full, depth + 1),
        })
      } else {
        nodes.push({ name: entry.name, path: rel, type: 'file' })
      }
    }
    return nodes
  }

  return walk(root, 0)
}

export function readWorkspaceFile(workspacePath: string, relPath: string): {
  path: string
  content: string
  language: string
} {
  const full = safeResolve(workspacePath, relPath)
  if (!existsSync(full) || !statSync(full).isFile()) {
    throw new Error(`File not found: ${relPath}`)
  }
  const content = readFileSync(full, 'utf8')
  return { path: relPath, content, language: guessLanguage(relPath) }
}

export function writeWorkspaceFile(
  workspacePath: string,
  relPath: string,
  content: string,
): { path: string } {
  const full = safeResolve(workspacePath, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content, 'utf8')
  return { path: relPath }
}

export function deleteWorkspaceFile(workspacePath: string, relPath: string): void {
  const full = safeResolve(workspacePath, relPath)
  if (!existsSync(full)) throw new Error(`Not found: ${relPath}`)
  unlinkSync(full)
}

export function renameWorkspaceFile(
  workspacePath: string,
  from: string,
  to: string,
): { path: string } {
  const src = safeResolve(workspacePath, from)
  const dest = safeResolve(workspacePath, to)
  mkdirSync(dirname(dest), { recursive: true })
  renameSync(src, dest)
  return { path: to }
}

export function searchWorkspace(
  workspacePath: string,
  query: string,
  limit = 40,
): Array<{ path: string; line: number; preview: string }> {
  if (!query.trim()) return []
  const root = resolve(workspacePath)
  const hits: Array<{ path: string; line: number; preview: string }> = []
  const q = query.toLowerCase()

  function walk(dir: string) {
    if (hits.length >= limit) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (isProbablyText(entry.name)) {
        try {
          const text = readFileSync(full, 'utf8')
          const lines = text.split(/\r?\n/)
          lines.forEach((line, i) => {
            if (hits.length >= limit) return
            if (line.toLowerCase().includes(q)) {
              hits.push({
                path: relative(root, full).split(sep).join('/'),
                line: i + 1,
                preview: line.trim().slice(0, 200),
              })
            }
          })
        } catch {
          /* binary / unreadable */
        }
      }
    }
  }

  walk(root)
  return hits
}

export function gatherContextFiles(
  workspacePath: string,
  openFiles: string[],
  maxChars = 24000,
): string {
  const parts: string[] = []
  let used = 0
  const seen = new Set<string>()

  for (const rel of openFiles) {
    if (seen.has(rel)) continue
    seen.add(rel)
    try {
      const { content } = readWorkspaceFile(workspacePath, rel)
      const chunk = content.slice(0, 8000)
      const block = `### File: ${rel}\n\`\`\`\n${chunk}\n\`\`\`\n`
      if (used + block.length > maxChars) break
      parts.push(block)
      used += block.length
    } catch {
      /* skip */
    }
  }

  // Add a few more discovered text files for grounding
  const tree = flattenFiles(listTree(workspacePath)).filter((p) => isProbablyText(p))
  for (const rel of tree) {
    if (seen.has(rel)) continue
    if (used > maxChars * 0.85) break
    try {
      const { content } = readWorkspaceFile(workspacePath, rel)
      if (content.length > 6000) continue
      const block = `### File: ${rel}\n\`\`\`\n${content}\n\`\`\`\n`
      if (used + block.length > maxChars) continue
      parts.push(block)
      used += block.length
      seen.add(rel)
    } catch {
      /* skip */
    }
  }

  return parts.join('\n')
}

function flattenFiles(nodes: FileNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path)
    if (n.children) out.push(...flattenFiles(n.children))
  }
  return out
}

function isProbablyText(name: string): boolean {
  const base = basename(name)
  if (TEXT_EXT.has(base)) return true
  const dot = base.lastIndexOf('.')
  if (dot < 0) return false
  return TEXT_EXT.has(base.slice(dot).toLowerCase())
}

export function guessLanguage(path: string): string {
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : ''
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.css': 'css',
    '.html': 'html',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.sh': 'shell',
    '.sql': 'sql',
  }
  return map[ext] ?? 'plaintext'
}

export function seedDemoWorkspace(workspacePath: string): void {
  ensureWorkspace(workspacePath)
  const readme = join(workspacePath, 'README.md')
  if (existsSync(readme)) return

  writeFileSync(
    readme,
    `# Demo workspace

Open files here and ask LocalForge to explain, refactor, or implement features.

This project runs entirely against **your local LLM** (Ollama, LM Studio, or any OpenAI-compatible server).
`,
    'utf8',
  )

  mkdirSync(join(workspacePath, 'src'), { recursive: true })
  writeFileSync(
    join(workspacePath, 'src', 'main.ts'),
    `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

if (import.meta.main) {
  console.log(greet('LocalForge'))
  console.log('sum', sum([1, 2, 3, 4]))
}
`,
    'utf8',
  )

  writeFileSync(
    join(workspacePath, 'src', 'utils.ts'),
    `/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Format bytes for the model hub UI. */
export function formatBytes(n: number): string {
  if (n < 1024) return \`\${n} B\`
  if (n < 1024 ** 2) return \`\${(n / 1024).toFixed(1)} KB\`
  if (n < 1024 ** 3) return \`\${(n / 1024 ** 2).toFixed(1)} MB\`
  return \`\${(n / 1024 ** 3).toFixed(2)} GB\`
}
`,
    'utf8',
  )

  writeFileSync(
    join(workspacePath, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-workspace',
        private: true,
        type: 'module',
        scripts: { start: 'tsx src/main.ts' },
      },
      null,
      2,
    ),
    'utf8',
  )
}
