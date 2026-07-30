import { useState } from 'react'
import { api } from '../lib/api.ts'

interface Hit {
  path: string
  line: number
  preview: string
}

interface Props {
  open: boolean
  onOpen: (path: string) => void
  onClose: () => void
}

export function SearchPanel({ open, onOpen, onClose }: Props) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const run = async () => {
    if (!q.trim()) return
    setBusy(true)
    try {
      const res = await api.search(q.trim())
      setHits(res.hits)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <h2>Find in files</h2>
            <p>Search the workspace (local text scan).</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search text…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run()
              }}
              style={{
                flex: 1,
                background: 'var(--bg-deep)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '9px 11px',
              }}
            />
            <button type="button" className="primary-btn" disabled={busy} onClick={() => void run()}>
              {busy ? '…' : 'Search'}
            </button>
          </div>
          <div className="installed-list" style={{ marginTop: 12 }}>
            {hits.length === 0 && <p className="hint">No results yet.</p>}
            {hits.map((h, i) => (
              <button
                key={`${h.path}:${h.line}:${i}`}
                type="button"
                className="installed-row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => {
                  onOpen(h.path)
                  onClose()
                }}
              >
                <div>
                  <div style={{ color: 'var(--brand-soft)' }}>
                    {h.path}:{h.line}
                  </div>
                  <div className="hint">{h.preview}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
