import { useEffect, useMemo, useState } from 'react'

export interface PaletteAction {
  id: string
  label: string
  hint?: string
  run: () => void
}

interface Props {
  open: boolean
  actions: PaletteAction[]
  onClose: () => void
}

export function CommandPalette({ open, actions, onClose }: Props) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return actions
    return actions.filter(
      (a) => a.label.toLowerCase().includes(needle) || a.hint?.toLowerCase().includes(needle),
    )
  }, [actions, q])

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
    }
  }, [open])

  useEffect(() => {
    setIdx(0)
  }, [q])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command or file…"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIdx((i) => Math.min(filtered.length - 1, i + 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIdx((i) => Math.max(0, i - 1))
            }
            if (e.key === 'Enter' && filtered[idx]) {
              e.preventDefault()
              filtered[idx].run()
              onClose()
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="hint" style={{ padding: 12 }}>No matches</div>}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={`palette-item ${i === idx ? 'active' : ''}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                a.run()
                onClose()
              }}
            >
              <span>{a.label}</span>
              {a.hint && <span className="hint">{a.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
