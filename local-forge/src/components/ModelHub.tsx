import { useEffect, useState } from 'react'
import {
  api,
  formatBytes,
  streamPull,
  type AppConfig,
  type ModelsResponse,
  type ProviderKind,
} from '../lib/api.ts'

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
  const [provider, setProvider] = useState<ProviderKind>('ollama')
  const [pulling, setPulling] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

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
    const next = await api.saveConfig({ provider, baseUrl, apiKey })
    setConfig(next)
    onConfigChange(next)
    toast(`Provider: ${next.provider}`)
    await refresh()
  }

  const pull = async (ollamaName: string, label: string) => {
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
      if (e.done && !e.error) {
        toast(`${ollamaName} ready`)
      }
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
              Choose where models live on disk, connect a local runtime, and download coding models.
              Nothing is sent to cloud APIs.
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="models-path">Model download location</label>
            <div className="field-row">
              <input
                id="models-path"
                value={modelsPath}
                onChange={(e) => setModelsPath(e.target.value)}
                placeholder="/path/to/models"
              />
              <button type="button" className="primary-btn" onClick={() => void saveLocation()}>
                Save path
              </button>
            </div>
            <span className="hint">
              Used as <code>OLLAMA_MODELS</code> when pulling via Ollama. Pick any folder you have
              space for (SSD recommended).
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
              <option value="ollama">Ollama (download + run)</option>
              <option value="lmstudio">LM Studio</option>
              <option value="openai-compatible">OpenAI-compatible (llama.cpp, vLLM, …)</option>
              <option value="demo">Demo (offline UI preview)</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="base-url">Base URL</label>
            <input id="base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="api-key">API key (optional)</label>
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
              Provider offline: {models.providerError}. Start Ollama (`ollama serve`) or LM Studio,
              then refresh.
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

          <h3 className="section-title">Download catalog</h3>
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
                      disabled={!!pulling || provider !== 'ollama'}
                      onClick={() => void pull(m.ollamaName, m.name)}
                    >
                      {pulling === m.ollamaName ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <h3 className="section-title">Installed on provider</h3>
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
                  {provider === 'ollama' && (
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
