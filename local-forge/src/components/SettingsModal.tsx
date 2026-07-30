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

  useEffect(() => {
    if (!open) return
    void api.getConfig().then((c) => {
      setWorkspacePath(c.workspacePath)
      setTemperature(c.temperature)
    })
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <h2>Settings</h2>
            <p>Point LocalForge at a project folder on this machine.</p>
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
          <button
            type="button"
            className="primary-btn"
            onClick={() =>
              void api.saveConfig({ workspacePath, temperature }).then((c) => {
                onConfigChange(c)
                toast('Settings saved')
                onClose()
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
