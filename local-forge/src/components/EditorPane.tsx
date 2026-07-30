import Editor from '@monaco-editor/react'

interface Tab {
  path: string
  content: string
  language: string
  dirty?: boolean
}

interface Props {
  tabs: Tab[]
  activePath?: string
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onChange: (path: string, content: string) => void
  inlinePrompt: string
  onInlinePrompt: (v: string) => void
  onInlineEdit: () => void
  streaming?: boolean
}

export function EditorPane({
  tabs,
  activePath,
  onSelect,
  onClose,
  onChange,
  inlinePrompt,
  onInlinePrompt,
  onInlineEdit,
  streaming,
}: Props) {
  const active = tabs.find((t) => t.path === activePath)

  return (
    <div className="editor-wrap panel">
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.path}
            type="button"
            className={`tab ${t.path === activePath ? 'active' : ''}`}
            onClick={() => onSelect(t.path)}
          >
            <span>
              {t.path.split('/').pop()}
              {t.dirty ? ' •' : ''}
            </span>
            <span
              className="close"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onClose(t.path)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  onClose(t.path)
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {active ? (
        <>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              theme="vs-dark"
              path={active.path}
              language={active.language}
              value={active.content}
              onChange={(v) => onChange(active.path, v ?? '')}
              options={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
              }}
            />
          </div>
          <div className="inline-bar">
            <input
              value={inlinePrompt}
              onChange={(e) => onInlinePrompt(e.target.value)}
              placeholder="Inline edit (⌘/Ctrl+K) — e.g. rename greet to welcome"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onInlineEdit()
                }
              }}
              disabled={streaming}
            />
            <button
              type="button"
              className="primary-btn"
              onClick={onInlineEdit}
              disabled={streaming || !inlinePrompt.trim()}
            >
              Edit
            </button>
          </div>
        </>
      ) : (
        <div className="editor-empty">
          <div>
            <h1>LocalForge</h1>
            <p>
              Cursor-style coding with models that live on your machine. Open a file, pick a local
              LLM, then Ask / Edit / Agent — no cloud required.
            </p>
            <p className="hint">Tip: open Model Hub to download Qwen2.5 Coder or Code Llama.</p>
          </div>
        </div>
      )}
    </div>
  )
}
