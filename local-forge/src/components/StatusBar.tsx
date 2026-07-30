interface Props {
  offline: boolean
  providerOk: boolean
  model?: string
  branch?: string
  path?: string
  language?: string
  version: string
}

export function StatusBar({ offline, providerOk, model, branch, path, language, version }: Props) {
  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className={providerOk ? 'ok-text' : 'warn-text'}>{providerOk ? '● ready' : '○ offline provider'}</span>
        {offline && <span className="offline-pill">air-gapped</span>}
        {branch && <span className="hint">git:{branch}</span>}
      </div>
      <div className="status-right">
        {path && <span className="hint">{path}</span>}
        {language && <span className="hint">{language}</span>}
        <span className="hint">{model || 'no model'}</span>
        <span className="hint">v{version}</span>
      </div>
    </footer>
  )
}
