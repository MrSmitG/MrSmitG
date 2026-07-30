import { useEffect, useState } from 'react'
import {
  api,
  formatBytes,
  streamPull,
  type AppConfig,
  type ModelsResponse,
  type ProviderKind,
} from '../lib/api.ts'
import { getDesktop } from '../lib/desktop.ts'

function CustomPull({ disabled, onPull }: { disabled: boolean; onPull: (name: string) => void }) {
  const [name, setName] = useState('qwen2.5-coder:7b')
  return (
    <div className="field-row" style={{ marginBottom: 12 }}>
      <input
        value={name}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        placeholder="ollama model name e.g. llama3.2:3b"
        style={{
          flex: 1,
          background: 'var(--bg-deep)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '9px 11px',
        }}
      />
      <button
        type="button"
        className="primary-btn"
        disabled={disabled || !name.trim()}
        onClick={() => onPull(name.trim())}
      >
        Pull
      </button>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onConfigChange: (c: AppConfig) => void
  toast: (msg: string) => void
}

export function ModelHub({ open, onClose, onConfigChange, toast }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [modelsPath, setModelsPath] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<ProviderKind>('demo')
  const [offlineMode, setOfflineMode] = useState(true)
  const [pulling, setPulling] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const desktop = getDesktop()

  const refresh = async () => {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([api.getConfig(), api.models()])
      setConfig(c)
      setModels(m)
      setModelsPath(c.modelsPath)
      setBaseUrl(c.baseUrl)
      setApiKey(c.apiKey)
      setProvider(c.provider)
      setOfflineMode(c.offlineMode !== false)
      onConfigChange(c)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  if (!open) return null

  const saveLocation = async () => {
    const next = await api.saveConfig({ modelsPath })
    setConfig(next)
    onConfigChange(next)
    toast(`Models directory set to ${next.modelsPath}`)
    await refresh()
  }

  const saveProvider = async () => {
    try {
      const next = await api.saveConfig({ provider, baseUrl, apiKey, offlineMode })
      setConfig(next)
      onConfigChange(next)
      toast(
        next.offlineMode
          ? 'Offline mode on — localhost only, downloads blocked'
          : `Provider: ${next.provider}`,
      )
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const toggleOffline = async (value: boolean) => {
    setOfflineMode(value)
    try {
      const patch: Partial<AppConfig> = { offlineMode: value }
      if (value && provider !== 'demo' && !/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(baseUrl) && !baseUrl.startsWith('local://')) {
        patch.provider = 'demo'
        patch.baseUrl = 'local://demo'
        patch.selectedModel = 'demo-coder'
        setProvider('demo')
        setBaseUrl('local://demo')
      }
      const next = await api.saveConfig(patch)
      setConfig(next)
      setOfflineMode(next.offlineMode !== false)
      onConfigChange(next)
      toast(value ? 'Offline mode enabled (no internet)' : 'Offline mode disabled — downloads allowed')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to toggle offline mode')
    }
  }

  const pull = async (ollamaName: string, label: string) => {
    if (offlineMode) {
      toast('Offline mode blocks downloads. Turn it off to pull models, then turn it back on.')
      return
    }
    setPulling(ollamaName)
    setProgress(0)
    setStatus(`Starting download of ${label}…`)
    await streamPull(label, ollamaName, (e) => {
      if (e.percent != null) setProgress(e.percent)
      if (e.status) setStatus(e.status)
      if (e.error) {
        toast(e.error)
        setStatus(e.error)
      }
      if (e.done && !e.error) toast(`${ollamaName} ready`)
    })
    setPulling(null)
    await refresh()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="hub-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="hub-title">Model Hub</h2>
            <p>
              Local providers only. Enable <strong>Offline mode</strong> for air-gapped use — no
              downloads, no cloud calls, localhost engines only.
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className={`offline-banner ${offlineMode ? 'on' : ''}`}>
            <div>
              <strong>{offlineMode ? 'Offline mode ON' : 'Offline mode OFF'}</strong>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                {offlineMode
                  ? 'No internet used. Downloads blocked. Use Offline engine, or Ollama/LM Studio on this machine with models you already have.'
                  : 'Downloads allowed. After pulling models, turn Offline mode back on for air-gapped work.'}
              </p>
            </div>
            <button
              type="button"
              className={offlineMode ? 'primary-btn' : 'ghost-btn'}
              onClick={() => void toggleOffline(!offlineMode)}
            >
              {offlineMode ? 'Disable' : 'Enable offline'}
            </button>
          </div>

          <div className="field">
            <label htmlFor="models-path">Model storage location</label>
            <div className="field-row">
              <input
                id="models-path"
                value={modelsPath}
                onChange={(e) => setModelsPath(e.target.value)}
                placeholder="/path/to/models"
              />
              {desktop && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() =>
                    void desktop
                      .pickFolder({ title: 'Choose models folder', defaultPath: modelsPath || undefined })
                      .then((p) => {
                        if (p) setModelsPath(p)
                      })
                  }
                >
                  Browse…
                </button>
              )}
              <button type="button" className="primary-btn" onClick={() => void saveLocation()}>
                Save path
              </button>
            </div>
            <span className="hint">
              Used as <code>OLLAMA_MODELS</code> when pulling via Ollama (requires offline mode off).
              {desktop ? ' On Mac, use Browse for a native folder picker.' : ''}
            </span>
          </div>

          <div className="field">
            <label htmlFor="provider">Local LLM provider</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => {
                const p = e.target.value as ProviderKind
                setProvider(p)
                if (p === 'ollama') setBaseUrl('http://127.0.0.1:11434')
                if (p === 'lmstudio') setBaseUrl('http://127.0.0.1:1234/v1')
                if (p === 'openai-compatible') setBaseUrl('http://127.0.0.1:8080/v1')
                if (p === 'demo') setBaseUrl('local://demo')
              }}
            >
              <option value="demo">Offline engine (built-in, no internet, no GPU)</option>
              <option value="ollama">Ollama (localhost)</option>
              <option value="lmstudio">LM Studio (localhost)</option>
              <option value="openai-compatible">OpenAI-compatible localhost (llama.cpp, vLLM…)</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="base-url">Base URL (localhost only when offline)</label>
            <input
              id="base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={provider === 'demo'}
            />
          </div>

          <div className="field">
            <label htmlFor="api-key">API key (optional, local only)</label>
            <input
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Only if your local server expects one"
            />
          </div>

          <button type="button" className="ghost-btn" onClick={() => void saveProvider()}>
            Save provider settings
          </button>

          {models?.providerError && (
            <p style={{ color: 'var(--warn)', fontSize: '0.8rem', marginTop: 14 }}>
              Provider unreachable: {models.providerError}. Start Ollama (`ollama serve`) or LM
              Studio, or switch to Offline engine.
            </p>
          )}

          {pulling && (
            <div style={{ marginTop: 16 }}>
              <div className="hint" style={{ marginBottom: 6 }}>
                {status} ({progress}%)
              </div>
              <div className="progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <h3 className="section-title">Custom model name</h3>
          <CustomPull
            disabled={offlineMode || provider !== 'ollama' || !!pulling}
            onPull={(name) => void pull(name, name)}
          />

          <h3 className="section-title">
            {offlineMode ? 'Catalog (downloads locked)' : 'Download catalog'}
          </h3>
          {offlineMode && (
            <p className="hint">
              Turn offline mode off to download. Already-installed models below still work fully
              offline.
            </p>
          )}
          <div className="catalog-grid">
            {(models?.catalog ?? []).map((m) => (
              <article
                key={m.id}
                className={`model-card ${config?.selectedModel === m.ollamaName ? 'selected' : ''}`}
              >
                <h3>{m.name}</h3>
                <div className="model-meta">
                  <span className="chip">{m.family}</span>
                  <span className="chip">{m.params}</span>
                  <span className="chip">{m.sizeLabel}</span>
                  {m.installed && <span className="chip ok">installed</span>}
                  {m.tags.includes('recommended') && <span className="chip accent">recommended</span>}
                </div>
                <p>{m.description}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {m.installed ? (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() =>
                        void api.selectModel(m.ollamaName).then((c) => {
                          setConfig(c)
                          onConfigChange(c)
                          toast(`Selected ${m.ollamaName}`)
                        })
                      }
                    >
                      Use model
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={!!pulling || provider !== 'ollama' || offlineMode}
                      onClick={() => void pull(m.ollamaName, m.name)}
                      title={offlineMode ? 'Disable offline mode to download' : undefined}
                    >
                      {offlineMode ? 'Locked' : pulling === m.ollamaName ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <h3 className="section-title">Installed / available offline</h3>
          <div className="installed-list">
            {(models?.installed ?? []).length === 0 && (
              <p className="hint">{loading ? 'Loading…' : 'No models detected yet.'}</p>
            )}
            {(models?.installed ?? []).map((m) => (
              <div key={m.id} className="installed-row">
                <div>
                  <div>{m.name}</div>
                  <div className="hint">{formatBytes(m.sizeBytes)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      void api.selectModel(m.id).then((c) => {
                        setConfig(c)
                        onConfigChange(c)
                        toast(`Selected ${m.id}`)
                      })
                    }
                  >
                    Select
                  </button>
                  {provider === 'ollama' && !offlineMode && (
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() =>
                        void api.deleteModel(m.id).then(() => {
                          toast(`Deleted ${m.id}`)
                          return refresh()
                        })
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(models?.disk?.length ?? 0) > 0 && (
            <>
              <h3 className="section-title">Files in models folder</h3>
              <div className="installed-list">
                {models!.disk.map((m) => (
                  <div key={m.id} className="installed-row">
                    <div>
                      <div>{m.name}</div>
                      <div className="hint">{formatBytes(m.sizeBytes)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
