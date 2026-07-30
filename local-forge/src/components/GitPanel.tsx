import { useEffect, useState } from 'react'
import { api, type GitStatus } from '../lib/api.ts'

interface Props {
  open: boolean
  onOpenFile: (path: string) => void
  onRefresh?: () => void
}

export function GitPanel({ open, onOpenFile }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [diff, setDiff] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const s = await api.gitStatus()
      setStatus(s)
      setError(s.error || null)
      if (s.available && s.dirty) {
        const d = await api.gitDiff()
        setDiff(d.diff)
      } else {
        setDiff('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Git failed')
    }
  }

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  if (!open) return null

  return (
    <div className="side-drawer">
      <div className="panel-header">
        <span>Git</span>
        <button type="button" className="ghost-btn" style={{ padding: '2px 8px' }} onClick={() => void refresh()}>
          ↻
        </button>
      </div>
      <div className="panel-body" style={{ padding: 10 }}>
        {error && <p className="hint" style={{ color: 'var(--warn)' }}>{error}</p>}
        {status?.available && (
          <>
            <div className="hint" style={{ marginBottom: 8 }}>
              branch <strong style={{ color: 'var(--accent)' }}>{status.branch}</strong>
              {status.dirty ? ' · dirty' : ' · clean'}
            </div>
            <div className="installed-list">
              {status.files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  className="installed-row"
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => onOpenFile(f.path)}
                >
                  <span className="chip">{f.status}</span>
                  <span style={{ fontSize: '0.78rem' }}>{f.path}</span>
                </button>
              ))}
            </div>
            {diff && (
              <pre className="diff-pre" style={{ marginTop: 12, maxHeight: 220 }}>
                {diff}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
