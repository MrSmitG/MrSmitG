import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChatPanel, type UiMessage } from './components/ChatPanel.tsx'
import { EditorPane } from './components/EditorPane.tsx'
import { FileTree } from './components/FileTree.tsx'
import { ModelHub } from './components/ModelHub.tsx'
import { SettingsModal } from './components/SettingsModal.tsx'
import {
  api,
  streamChat,
  type AgentMode,
  type AppConfig,
  type ChatEdit,
  type FileNode,
} from './lib/api.ts'

interface Tab {
  path: string
  content: string
  language: string
  dirty?: boolean
}

let msgId = 0
const nid = () => `m${++msgId}`

export default function App() {
  const [mode, setMode] = useState<AgentMode>('ask')
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [providerOk, setProviderOk] = useState(false)
  const [tree, setTree] = useState<FileNode[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activePath, setActivePath] = useState<string | undefined>()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [draft, setDraft] = useState('')
  const [inlinePrompt, setInlinePrompt] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health()
      setProviderOk(h.provider.ok)
      setConfig((prev) => prev ?? (h.config as AppConfig))
    } catch {
      setProviderOk(false)
    }
  }, [])

  const refreshTree = useCallback(async () => {
    const t = await api.tree()
    setTree(t.tree)
  }, [])

  useEffect(() => {
    void (async () => {
      const c = await api.getConfig()
      setConfig(c)
      await refreshHealth()
      await refreshTree()
    })()
    const id = window.setInterval(() => void refreshHealth(), 12000)
    return () => window.clearInterval(id)
  }, [refreshHealth, refreshTree])

  const openFile = async (path: string) => {
    const existing = tabs.find((t) => t.path === path)
    if (existing) {
      setActivePath(path)
      return
    }
    const file = await api.readFile(path)
    setTabs((prev) => [
      ...prev,
      { path: file.path, content: file.content, language: file.language },
    ])
    setActivePath(path)
  }

  const closeTab = (path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path)
      if (activePath === path) setActivePath(next[next.length - 1]?.path)
      return next
    })
  }

  const onChange = (path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, content, dirty: true } : t)),
    )
  }

  const saveActive = async () => {
    const tab = tabs.find((t) => t.path === activePath)
    if (!tab) return
    await api.writeFile(tab.path, tab.content)
    setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)))
    showToast(`Saved ${tab.path}`)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        const tab = tabs.find((t) => t.path === activePath)
        if (!tab) return
        void api.writeFile(tab.path, tab.content).then(() => {
          setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)))
          showToast(`Saved ${tab.path}`)
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const el = document.querySelector<HTMLInputElement>('.inline-bar input')
        el?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, activePath, showToast])

  const history = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages],
  )

  const runChat = async (prompt: string, opts?: { mode?: AgentMode; selection?: string }) => {
    if (!prompt.trim() || streaming) return
    const useMode = opts?.mode ?? mode
    const userMsg: UiMessage = { id: nid(), role: 'user', content: prompt }
    const assistantId = nid()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setStreaming(true)

    await streamChat(
      {
        prompt,
        mode: useMode,
        history,
        openFiles: tabs.map((t) => t.path),
        activeFile: activePath,
        selection: opts?.selection,
        applyEdits: false,
      },
      {
        onToken: (t) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + t } : m)),
          )
        },
        onDone: (full, edits, applied) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: full || m.content, edits, applied }
                : m,
            ),
          )
          if (applied.length) void refreshTree()
        },
        onError: (msg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content ||
                      `**Error:** ${msg}\n\nOpen **Model Hub**, start Ollama/LM Studio, and select a downloaded model.`,
                  }
                : m,
            ),
          )
        },
      },
    )
    setStreaming(false)
  }

  const onSend = async () => {
    const prompt = draft
    setDraft('')
    await runChat(prompt)
  }

  const onInlineEdit = async () => {
    if (!activePath || !inlinePrompt.trim()) return
    const tab = tabs.find((t) => t.path === activePath)
    setMode('edit')
    const prompt = `Inline edit the active file. ${inlinePrompt}`
    setInlinePrompt('')
    await runChat(prompt, { mode: 'edit', selection: tab?.content })
  }

  const onApply = async (edits: ChatEdit[]) => {
    const { applied } = await api.applyEdits(edits)
    for (const path of applied) {
      const file = await api.readFile(path)
      setTabs((prev) => {
        const exists = prev.some((t) => t.path === path)
        if (exists) {
          return prev.map((t) =>
            t.path === path
              ? { ...t, content: file.content, language: file.language, dirty: false }
              : t,
          )
        }
        return [...prev, { path, content: file.content, language: file.language }]
      })
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.edits && m.edits.some((e) => applied.includes(e.path))
          ? { ...m, applied }
          : m,
      ),
    )
    await refreshTree()
    showToast(`Applied ${applied.length} file(s)`)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 64 64" fill="none" aria-hidden>
            <rect width="64" height="64" rx="14" fill="#0B1F1A" />
            <path
              d="M16 44V20l16 12 16-12v24"
              stroke="#E8C468"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="32" r="3.5" fill="#7FD4B8" />
          </svg>
          <div>
            <div className="brand-name">LocalForge</div>
            <div className="brand-tag">local LLM IDE</div>
          </div>
        </div>

        <div className="topbar-center" role="tablist" aria-label="Agent mode">
          {(['ask', 'edit', 'agent'] as AgentMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`mode-pill ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="topbar-right">
          <span
            className={`status-dot ${providerOk ? 'ok' : ''}`}
            title={providerOk ? 'Local provider online' : 'Local provider offline'}
          />
          <span className="hint" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {config?.selectedModel || 'no model'}
          </span>
          <button type="button" className="ghost-btn" onClick={() => void saveActive()}>
            Save
          </button>
          <button type="button" className="ghost-btn" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button type="button" className="primary-btn" onClick={() => setHubOpen(true)}>
            Model Hub
          </button>
        </div>
      </header>

      <div className="main-grid">
        <aside className="panel files">
          <div className="panel-header">
            <span>Files</span>
            <button type="button" className="ghost-btn" style={{ padding: '2px 8px' }} onClick={() => void refreshTree()}>
              ↻
            </button>
          </div>
          <div className="panel-body">
            <FileTree tree={tree} activePath={activePath} onOpen={(p) => void openFile(p)} />
          </div>
        </aside>

        <EditorPane
          tabs={tabs}
          activePath={activePath}
          onSelect={setActivePath}
          onClose={closeTab}
          onChange={onChange}
          inlinePrompt={inlinePrompt}
          onInlinePrompt={setInlinePrompt}
          onInlineEdit={() => void onInlineEdit()}
          streaming={streaming}
        />

        <ChatPanel
          mode={mode}
          messages={messages}
          draft={draft}
          streaming={streaming}
          onDraft={setDraft}
          onSend={() => void onSend()}
          onApply={(edits) => void onApply(edits)}
        />
      </div>

      <ModelHub
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        onConfigChange={setConfig}
        toast={showToast}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onConfigChange={(c) => {
          setConfig(c)
          void refreshTree()
        }}
        toast={showToast}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
