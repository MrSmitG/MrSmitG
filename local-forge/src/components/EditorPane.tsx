import Editor, { type OnMount } from '@monaco-editor/react'
import { useRef } from 'react'
import { api } from '../lib/api.ts'

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
  autocomplete?: boolean
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
  autocomplete = true,
}: Props) {
  const active = tabs.find((t) => t.path === activePath)
  const disposeRef = useRef<(() => void) | null>(null)

  const handleMount: OnMount = (_editor, monaco) => {
    disposeRef.current?.()
    if (!autocomplete) return

    const provider = monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
      provideInlineCompletions: async (model: { getOffsetAt: (p: { lineNumber: number; column: number }) => number; getValue: () => string; getLanguageId: () => string }, position: { lineNumber: number; column: number }) => {
        if (!autocomplete) return { items: [] }
        const offset = model.getOffsetAt(position)
        const value = model.getValue()
        const prefix = value.slice(0, offset)
        const suffix = value.slice(offset)
        try {
          const { completion } = await api.complete({
            prefix,
            suffix,
            language: model.getLanguageId(),
            path: activePath,
          })
          if (!completion) return { items: [] }
          return {
            items: [
              {
                insertText: completion,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column,
                ),
              },
            ],
          }
        } catch {
          return { items: [] }
        }
      },
      freeInlineCompletions: () => undefined,
    })

    disposeRef.current = () => provider.dispose()
  }

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
              onMount={handleMount}
              options={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                inlineSuggest: { enabled: autocomplete },
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
            <p className="hint">Tip: ⌘P palette · ⌘Shift+F find · Offline mode for air-gapped use.</p>
          </div>
        </div>
      )}
    </div>
  )
}
