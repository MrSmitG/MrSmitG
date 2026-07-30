interface Props {
  open: boolean
  onClose: () => void
}

const ROWS = [
  ['⌘/Ctrl + P', 'Command palette'],
  ['⌘/Ctrl + O', 'Open workspace (Mac app)'],
  ['⌘/Ctrl + S', 'Save file'],
  ['⌘/Ctrl + N', 'New file (Mac app)'],
  ['⌘/Ctrl + K', 'Focus inline edit'],
  ['⌘/Ctrl + `', 'Toggle terminal'],
  ['⌘/Ctrl + Shift + F', 'Find in files'],
  ['⌘/Ctrl + Shift + G', 'Graph LLM (Mac app)'],
  ['⌘/Ctrl + Shift + M', 'Model Hub (Mac app)'],
  ['⌘/Ctrl + ,', 'Preferences (Mac app)'],
  ['⌘/Ctrl + Enter', 'Send chat'],
  ['Esc', 'Close overlays'],
]

export function ShortcutsModal({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <h2>Keyboard shortcuts</h2>
            <p>LocalForge IDE shortcuts.</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="installed-list">
            {ROWS.map(([k, v]) => (
              <div key={k} className="installed-row">
                <code style={{ color: 'var(--brand-soft)' }}>{k}</code>
                <span className="hint">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
