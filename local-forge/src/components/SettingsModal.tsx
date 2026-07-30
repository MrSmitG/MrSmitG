import { useEffect, useState } from 'react'
import { api, type AppConfig } from '../lib/api.ts'

interface Props {
  open: boolean
  onClose: () => void
  onConfigChange: (c: AppConfig) => void
  toast: (msg: string) => void
}

export function SettingsModal({ open, onClose, onConfigChange, toast }: Props) {
  const [workspacePath, setWorkspacePath] = useState('')
  const [temperature, setTemperature] = useState(0.2)
  const [offlineMode, setOfflineMode] = useState(true)
  const [autoSave, setAutoSave] = useState(true)

  useEffect(() => {
    if (!open) return
    void api.getConfig().then((c) => {
      setWorkspacePath(c.workspacePath)
      setTemperature(c.temperature)
      setOfflineMode(c.offlineMode !== false)
      setAutoSave(c.autoSave !== false)
    })
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Workspace + air-gapped offline controls.</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="ws">Workspace path</label>
            <input
              id="ws"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="/absolute/path/to/project"
            />
          </div>
          <div className="field">
            <label htmlFor="temp">Temperature ({temperature})</label>
            <input
              id="temp"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
            />
            <span>
              <strong>Offline mode</strong> — no internet, block model downloads, localhost
              providers only
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
            />
            <span>Auto-save open files after edits apply</span>
          </label>
          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              void api
                .saveConfig({ workspacePath, temperature, offlineMode, autoSave })
                .then((c) => {
                  onConfigChange(c)
                  toast(c.offlineMode ? 'Saved (offline mode on)' : 'Settings saved')
                  onClose()
                })
                .catch((err: unknown) =>
                  toast(err instanceof Error ? err.message : 'Save failed'),
                )
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
