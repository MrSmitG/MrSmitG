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
  const [tabAutocomplete, setTabAutocomplete] = useState(true)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    void api.getConfig().then((c) => {
      setWorkspacePath(c.workspacePath)
      setTemperature(c.temperature)
      setOfflineMode(c.offlineMode !== false)
      setAutoSave(c.autoSave !== false)
      setTabAutocomplete(c.tabAutocomplete !== false)
      setRecent(c.recentWorkspaces ?? [])
    })
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Workspace, offline, and editor behavior.</p>
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
          {recent.length > 0 && (
            <div className="field">
              <label>Recent workspaces</label>
              <div className="installed-list">
                {recent.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="installed-row"
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => setWorkspacePath(p)}
                  >
                    <span className="hint">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
              <strong>Offline mode</strong> — no internet, block downloads, localhost only
            </span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
            <span>Auto-save after applying edits</span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={tabAutocomplete}
              onChange={(e) => setTabAutocomplete(e.target.checked)}
            />
            <span>Tab autocomplete (ghost text from local model)</span>
          </label>
          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              void api
                .saveConfig({
                  workspacePath,
                  temperature,
                  offlineMode,
                  autoSave,
                  tabAutocomplete,
                })
                .then((c) => {
                  onConfigChange(c)
                  toast(c.offlineMode ? 'Saved (offline mode on)' : 'Settings saved')
                  onClose()
                })
                .catch((err: unknown) => toast(err instanceof Error ? err.message : 'Save failed'))
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
