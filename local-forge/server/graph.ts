import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

export type GraphNodeKind = 'file' | 'symbol' | 'module'
export type GraphEdgeKind = 'imports' | 'contains' | 'calls' | 'extends' | 'related'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  path?: string
  detail?: string
  line?: number
  language?: string
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  kind: GraphEdgeKind
  weight?: number
}

export interface CodeGraph {
  builtAt: string
  root: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: { files: number; symbols: number; edges: number }
}

export interface GraphHit {
  node: GraphNode
  score: number
  neighbors: Array<{ node: GraphNode; edge: GraphEdge }>
}

const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.local-forge',
  'coverage',
  'public',
  'monaco',
])

const CODE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
])

let cache: CodeGraph | null = null

function walkFiles(root: string, dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (IGNORE.has(e.name) || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walkFiles(root, full, out)
    else {
      const ext = e.name.includes('.') ? e.name.slice(e.name.lastIndexOf('.')).toLowerCase() : ''
      if (CODE_EXT.has(ext)) out.push(full)
    }
  }
}

function fileId(rel: string): string {
  return `file:${rel}`
}

function symbolId(rel: string, name: string): string {
  return `sym:${rel}#${name}`
}

function moduleId(spec: string): string {
  return `mod:${spec}`
}

function guessLang(path: string): string {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (ext === '.py') return 'python'
  if (ext === '.go') return 'go'
  if (ext === '.rs') return 'rust'
  if (ext === '.java' || ext === '.kt') return 'jvm'
  return 'js'
}

interface Extracted {
  symbols: Array<{ name: string; kind: string; line: number }>
  imports: string[]
  calls: string[]
  extendsNames: string[]
}

function extract(content: string, lang: string): Extracted {
  const symbols: Extracted['symbols'] = []
  const imports: string[] = []
  const calls: string[] = []
  const extendsNames: string[] = []
  const lines = content.split(/\r?\n/)

  lines.forEach((line, i) => {
    const n = i + 1
    if (lang === 'python') {
      let m = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/)
      if (m) symbols.push({ name: m[1], kind: 'function', line: n })
      m = line.match(/^\s*class\s+([A-Za-z_]\w*)/)
      if (m) {
        symbols.push({ name: m[1], kind: 'class', line: n })
        const ext = line.match(/class\s+\w+\s*\(([^)]+)\)/)
        if (ext) {
          for (const part of ext[1].split(',')) {
            const name = part.trim().split('.').pop()
            if (name && /^[A-Za-z_]/.test(name)) extendsNames.push(name)
          }
        }
      }
      m = line.match(/^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))/)
      if (m) imports.push((m[1] || m[2]).replace(/\.py$/, ''))
      for (const cm of line.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g)) {
        if (!['def', 'class', 'if', 'for', 'while', 'print'].includes(cm[1])) calls.push(cm[1])
      }
      return
    }

    // JS/TS and similar
    let m =
      line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)/) ||
      line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(/) ||
      line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?=>/)
    if (m) symbols.push({ name: m[1], kind: 'function', line: n })

    m =
      line.match(/^\s*(?:export\s+)?class\s+([A-Za-z_]\w*)/) ||
      line.match(/^\s*(?:export\s+)?interface\s+([A-Za-z_]\w*)/) ||
      line.match(/^\s*(?:export\s+)?type\s+([A-Za-z_]\w*)/)
    if (m) {
      symbols.push({
        name: m[1],
        kind: line.includes('interface') ? 'interface' : line.includes('type ') ? 'type' : 'class',
        line: n,
      })
      const ext = line.match(/extends\s+([A-Za-z_]\w*)/)
      if (ext) extendsNames.push(ext[1])
      const impl = line.match(/implements\s+([A-Za-z_.\w,\s]+)/)
      if (impl) {
        for (const part of impl[1].split(',')) {
          const name = part.trim().split(/[\s{]/)[0]
          if (name) extendsNames.push(name)
        }
      }
    }

    m =
      line.match(/from\s+['"]([^'"]+)['"]/) ||
      line.match(/import\s+['"]([^'"]+)['"]/) ||
      line.match(/require\(\s*['"]([^'"]+)['"]\s*\)/)
    if (m) imports.push(m[1])

    for (const cm of line.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g)) {
      if (
        !['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'await', 'typeof'].includes(
          cm[1],
        )
      ) {
        calls.push(cm[1])
      }
    }
  })

  return {
    symbols,
    imports: [...new Set(imports)],
    calls: [...new Set(calls)].slice(0, 40),
    extendsNames: [...new Set(extendsNames)],
  }
}

function resolveImport(fromFile: string, spec: string, fileSet: Set<string>): string | null {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.py`,
    join(base, 'index.ts'),
    join(base, 'index.js'),
  ]
  for (const c of candidates) {
    const rel = [...fileSet].find((f) => resolve(f) === resolve(c))
    if (rel) return rel
  }
  return null
}

export function buildCodeGraph(workspacePath: string): CodeGraph {
  const root = resolve(workspacePath)
  const files: string[] = []
  walkFiles(root, root, files)

  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const symbolIndex = new Map<string, string[]>() // name -> symbol ids
  const pendingCalls = new Map<string, string[]>()
  const pendingExtends = new Map<string, string[]>()

  const addEdge = (from: string, to: string, kind: GraphEdgeKind, weight = 1) => {
    if (!nodes.has(from) || !nodes.has(to) || from === to) return
    edges.push({
      id: `${kind}:${from}->${to}`,
      from,
      to,
      kind,
      weight,
    })
  }

  for (const abs of files) {
    const rel = relative(root, abs).split(sep).join('/')
    const fid = fileId(rel)
    const lang = guessLang(rel)
    nodes.set(fid, {
      id: fid,
      kind: 'file',
      label: basename(rel),
      path: rel,
      detail: dirname(rel) === '.' ? rel : dirname(rel),
      language: lang,
    })

    let content = ''
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (content.length > 200_000) content = content.slice(0, 200_000)

    const extracted = extract(content, lang)
    for (const sym of extracted.symbols) {
      const sid = symbolId(rel, sym.name)
      nodes.set(sid, {
        id: sid,
        kind: 'symbol',
        label: sym.name,
        path: rel,
        detail: sym.kind,
        line: sym.line,
        language: lang,
      })
      addEdge(fid, sid, 'contains')
      const list = symbolIndex.get(sym.name) ?? []
      list.push(sid)
      symbolIndex.set(sym.name, list)
    }

    for (const spec of extracted.imports) {
      const resolvedRel = resolveImport(abs, spec, new Set(files))
      if (resolvedRel) {
        const targetRel = relative(root, resolvedRel).split(sep).join('/')
        addEdge(fid, fileId(targetRel), 'imports', 2)
      } else {
        const mid = moduleId(spec)
        if (!nodes.has(mid)) {
          nodes.set(mid, {
            id: mid,
            kind: 'module',
            label: spec.split('/').pop() || spec,
            detail: spec,
          })
        }
        addEdge(fid, mid, 'imports')
      }
    }

    pendingCalls.set(fid, extracted.calls)
    pendingExtends.set(fid, extracted.extendsNames)
  }

  // Second pass: calls + extends using full symbol index
  for (const [fid, calls] of pendingCalls) {
    for (const call of calls) {
      for (const tid of symbolIndex.get(call) ?? []) {
        if (!tid.startsWith(`sym:${fid.slice(5)}#`)) addEdge(fid, tid, 'calls')
      }
    }
  }
  for (const [fid, exts] of pendingExtends) {
    for (const ext of exts) {
      for (const tid of symbolIndex.get(ext) ?? []) addEdge(fid, tid, 'extends', 2)
    }
  }

  // Dedupe edges
  const seen = new Set<string>()
  const uniqueEdges = edges.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  const graph: CodeGraph = {
    builtAt: new Date().toISOString(),
    root,
    nodes: [...nodes.values()],
    edges: uniqueEdges,
    stats: {
      files: [...nodes.values()].filter((n) => n.kind === 'file').length,
      symbols: [...nodes.values()].filter((n) => n.kind === 'symbol').length,
      edges: uniqueEdges.length,
    },
  }
  cache = graph
  return graph
}

export function getCachedGraph(workspacePath: string, force = false): CodeGraph {
  if (!force && cache && resolve(cache.root) === resolve(workspacePath)) return cache
  return buildCodeGraph(workspacePath)
}

function scoreNode(node: GraphNode, terms: string[]): number {
  let score = 0
  const label = node.label.toLowerCase()
  const path = (node.path || '').toLowerCase()
  const detail = (node.detail || '').toLowerCase()
  for (const t of terms) {
    if (!t) continue
    if (label === t) score += 10
    else if (label.includes(t)) score += 6
    if (path.includes(t)) score += 3
    if (detail.includes(t)) score += 2
    if (node.kind === 'symbol' && label.startsWith(t)) score += 2
  }
  if (node.kind === 'symbol') score += 0.5
  return score
}

export function queryGraph(
  graph: CodeGraph,
  query: string,
  limit = 12,
): { hits: GraphHit[]; context: string } {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)

  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const scored = graph.nodes
    .map((node) => ({ node, score: scoreNode(node, terms) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const hits: GraphHit[] = scored.map(({ node, score }) => {
    const neighbors: GraphHit['neighbors'] = []
    for (const e of graph.edges) {
      if (e.from === node.id && byId.has(e.to)) {
        neighbors.push({ node: byId.get(e.to)!, edge: e })
      } else if (e.to === node.id && byId.has(e.from)) {
        neighbors.push({ node: byId.get(e.from)!, edge: e })
      }
    }
    return {
      node,
      score,
      neighbors: neighbors.slice(0, 8),
    }
  })

  const lines: string[] = ['### Code knowledge graph (Graph LLM)']
  for (const hit of hits) {
    const n = hit.node
    const loc = n.path ? `${n.path}${n.line ? `:${n.line}` : ''}` : n.detail || ''
    lines.push(`- (${n.kind}) **${n.label}** ${loc ? `@ ${loc}` : ''} [score ${hit.score.toFixed(1)}]`)
    for (const nb of hit.neighbors.slice(0, 5)) {
      lines.push(
        `  - ${nb.edge.kind} → (${nb.node.kind}) ${nb.node.label}${nb.node.path ? ` @ ${nb.node.path}` : ''}`,
      )
    }
  }
  if (hits.length === 0) {
    lines.push('- No strong graph matches. Falling back to normal context.')
  }

  return { hits, context: lines.join('\n') }
}

/** Compact subgraph for UI visualization around query hits (or whole graph if small). */
export function subgraphForView(
  graph: CodeGraph,
  hitIds: string[],
  maxNodes = 80,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (hitIds.length === 0) {
    const nodes = graph.nodes.filter((n) => n.kind === 'file').slice(0, maxNodes)
    const ids = new Set(nodes.map((n) => n.id))
    const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).slice(0, 120)
    return { nodes, edges }
  }

  const keep = new Set(hitIds)
  for (const e of graph.edges) {
    if (keep.has(e.from)) keep.add(e.to)
    if (keep.has(e.to)) keep.add(e.from)
  }
  const nodes = graph.nodes.filter((n) => keep.has(n.id)).slice(0, maxNodes)
  const ids = new Set(nodes.map((n) => n.id))
  const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
  return { nodes, edges }
}

export function readSymbolSnippet(workspacePath: string, node: GraphNode, radius = 12): string {
  if (!node.path || node.kind !== 'symbol' || !node.line) return ''
  const full = resolve(workspacePath, node.path)
  if (!existsSync(full) || !statSync(full).isFile()) return ''
  try {
    const lines = readFileSync(full, 'utf8').split(/\r?\n/)
    const start = Math.max(0, (node.line || 1) - 1)
    const end = Math.min(lines.length, start + radius)
    return lines.slice(start, end).join('\n')
  } catch {
    return ''
  }
}
