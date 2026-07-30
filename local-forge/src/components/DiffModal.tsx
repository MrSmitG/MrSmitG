import type { DiffPreview } from '../lib/api.ts'

interface Props {
  open: boolean
  previews: DiffPreview[]
  onClose: () => void
  onApply: () => void
}

function lineDiff(before: string, after: string): Array<{ type: 'same' | 'add' | 'del'; text: string }> {
  const a = before.split('\n')
  const b = after.split('\n')
  const out: Array<{ type: 'same' | 'add' | 'del'; text: string }> = []
  const max = Math.max(a.length, b.length)
  // Simple line align: show removals then additions when mismatched
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (j < b.length && (i >= a.length || !a.slice(i, i + 3).includes(b[j]))) {
      out.push({ type: 'add', text: b[j] })
      j++
    } else if (i < a.length) {
      out.push({ type: 'del', text: a[i] })
      i++
    } else {
      out.push({ type: 'add', text: b[j++] })
    }
    if (out.length > max * 3) break
  }
  return out.slice(0, 400)
}

export function DiffModal({ open, previews, onClose, onApply }: Props) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <h2>Diff preview</h2>
            <p>Review proposed file changes before applying them to the workspace.</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {previews.map((p) => {
            const rows = lineDiff(p.before, p.after)
            return (
              <div key={p.path} className="diff-block">
                <div className="diff-path">
                  {p.path} {p.isNew ? <span className="chip ok">new</span> : null}
                </div>
                <pre className="diff-pre">
                  {rows.map((r, idx) => (
                    <div key={idx} className={`diff-line ${r.type}`}>
                      <span className="diff-mark">
                        {r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '}
                      </span>
                      {r.text}
                    </div>
                  ))}
                </pre>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="primary-btn" onClick={onApply}>
              Apply all
            </button>
            <button type="button" className="ghost-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
