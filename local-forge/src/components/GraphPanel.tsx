import { useEffect, useMemo, useState } from 'react'
import { api, type GraphNode, type GraphView } from '../lib/api.ts'

interface Props {
  open: boolean
  onClose: () => void
  onOpenFile: (path: string) => void
  toast: (msg: string) => void
}

type Pos = { x: number; y: number }

function layout(nodes: GraphNode[]): Map<string, Pos> {
  const pos = new Map<string, Pos>()
  const files = nodes.filter((n) => n.kind === 'file')
  const symbols = nodes.filter((n) => n.kind === 'symbol')
  const modules = nodes.filter((n) => n.kind === 'module')
  const place = (list: GraphNode[], cx: number, cy: number, radius: number) => {
    list.forEach((n, i) => {
      const a = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2
      pos.set(n.id, {
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
      })
    })
  }
  place(files, 280, 220, 150)
  place(symbols, 280, 220, 70)
  place(modules, 280, 220, 210)
  // leftover
  nodes.forEach((n, i) => {
    if (!pos.has(n.id)) pos.set(n.id, { x: 40 + (i % 10) * 50, y: 40 + Math.floor(i / 10) * 40 })
  })
  return pos
}

const COLORS: Record<string, string> = {
  file: '#e8c468',
  symbol: '#7fd4b8',
  module: '#8aa79c',
}

export function GraphPanel({ open, onClose, onOpenFile, toast }: Props) {
  const [view, setView] = useState<GraphView | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)

  const load = async (query = q, rebuild = false) => {
    setBusy(true)
    try {
      if (rebuild) await api.rebuildGraph()
      const data = await api.getGraph(query)
      setView(data)
      setEnabled(data.graphLlm !== false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Graph failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (open) void load('')
  }, [open])

  const positions = useMemo(() => layout(view?.nodes ?? []), [view])

  if (!open) return null

  const hitSet = new Set(view?.hitIds ?? [])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal graph-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="graph-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="graph-title">Graph LLM</h2>
            <p>
              Code knowledge graph — symbols, imports, and calls feed retrieval for Ask / Edit /
              Agent. First gen-AI upgrade beyond plain RAG.
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="graph-toolbar">
            <label className="check-row" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  void api.saveConfig({ graphLlm: e.target.checked }).then(() => {
                    setEnabled(e.target.checked)
                    toast(e.target.checked ? 'Graph LLM on' : 'Graph LLM off')
                  })
                }
              />
              <span>Use graph in chat / agent</span>
            </label>
            <div className="field-row" style={{ flex: 1, margin: 0 }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Query graph — e.g. greet, sum, imports…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load(q)
                }}
                style={{
                  flex: 1,
                  background: 'var(--bg-deep)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              />
              <button type="button" className="primary-btn" disabled={busy} onClick={() => void load(q)}>
                Query
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => void load(q, true)}
              >
                Rebuild
              </button>
            </div>
          </div>

          {view && (
            <div className="hint" style={{ marginBottom: 8 }}>
              {view.stats.files} files · {view.stats.symbols} symbols · {view.stats.edges} edges ·
              built {new Date(view.builtAt).toLocaleTimeString()}
              {view.query ? ` · query “${view.query}”` : ''}
            </div>
          )}

          <div className="graph-stage">
            <svg viewBox="0 0 560 440" className="graph-svg" role="img" aria-label="Code graph">
              {(view?.edges ?? []).map((e) => {
                const a = positions.get(e.from)
                const b = positions.get(e.to)
                if (!a || !b) return null
                return (
                  <line
                    key={e.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={`graph-edge kind-${e.kind}`}
                  />
                )
              })}
              {(view?.nodes ?? []).map((n) => {
                const p = positions.get(n.id)
                if (!p) return null
                const hit = hitSet.has(n.id)
                const sel = selected === n.id
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x}, ${p.y})`}
                    className={`graph-node ${n.kind} ${hit ? 'hit' : ''} ${sel ? 'selected' : ''}`}
                    onClick={() => {
                      setSelected(n.id)
                      if (n.path) onOpenFile(n.path)
                    }}
                  >
                    <circle r={n.kind === 'file' ? 10 : n.kind === 'symbol' ? 7 : 6} fill={COLORS[n.kind]} />
                    <text y={18} textAnchor="middle">
                      {n.label.slice(0, 14)}
                    </text>
                  </g>
                )
              })}
            </svg>
            <aside className="graph-legend">
              <div className="hint">Click a node to open its file.</div>
              <div className="model-meta" style={{ marginTop: 8 }}>
                <span className="chip" style={{ borderColor: COLORS.file, color: COLORS.file }}>
                  file
                </span>
                <span className="chip" style={{ borderColor: COLORS.symbol, color: COLORS.symbol }}>
                  symbol
                </span>
                <span className="chip" style={{ borderColor: COLORS.module, color: COLORS.module }}>
                  module
                </span>
              </div>
              {selected && view && (
                <div style={{ marginTop: 12 }}>
                  {(() => {
                    const n = view.nodes.find((x) => x.id === selected)
                    if (!n) return null
                    return (
                      <>
                        <strong>{n.label}</strong>
                        <div className="hint">
                          {n.kind}
                          {n.path ? ` · ${n.path}` : ''}
                          {n.line ? `:${n.line}` : ''}
                          {n.detail ? ` · ${n.detail}` : ''}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
