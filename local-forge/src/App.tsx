import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatPanel, type UiMessage } from './components/ChatPanel.tsx'
import { CommandPalette, type PaletteAction } from './components/CommandPalette.tsx'
import { DiffModal } from './components/DiffModal.tsx'
import { EditorPane } from './components/EditorPane.tsx'
import { FileTree } from './components/FileTree.tsx'
import { GitPanel } from './components/GitPanel.tsx'
import { GraphPanel } from './components/GraphPanel.tsx'
import { ModelHub } from './components/ModelHub.tsx'
import { SearchPanel } from './components/SearchPanel.tsx'
import { SettingsModal } from './components/SettingsModal.tsx'
import { ShortcutsModal } from './components/ShortcutsModal.tsx'
import { StatusBar } from './components/StatusBar.tsx'
import { TerminalPanel } from './components/TerminalPanel.tsx'
import {
  api,
  flattenFiles,
  parseMentions,
  streamChat,
  type AgentMode,
  type AppConfig,
  type ChatEdit,
  type DiffPreview,
  type FileNode,
  type SessionSummary,
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
  const [version, setVersion] = useState('0.4.0')
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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffPreviews, setDiffPreviews] = useState<DiffPreview[]>([])
  const [pendingEdits, setPendingEdits] = useState<ChatEdit[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()
  const [gitBranch, setGitBranch] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const fileHints = useMemo(() => flattenFiles(tree), [tree])
  const activeTab = tabs.find((t) => t.path === activePath)

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health()
      setProviderOk(h.provider.ok)
      setVersion(h.version)
      setConfig((prev) => ({ ...(prev ?? (h.config as AppConfig)), ...h.config }))
    } catch {
      setProviderOk(false)
    }
  }, [])

  const refreshTree = useCallback(async () => {
    const t = await api.tree()
    setTree(t.tree)
  }, [])

  const refreshSessions = useCallback(async () => {
    const { sessions: list } = await api.sessions()
    setSessions(list)
  }, [])

  const refreshGit = useCallback(async () => {
    try {
      const s = await api.gitStatus()
      setGitBranch(s.available ? s.branch : undefined)
    } catch {
      setGitBranch(undefined)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const c = await api.getConfig()
      setConfig(c)
      setActiveSessionId(c.activeSessionId || undefined)
      await refreshHealth()
      await refreshTree()
      await refreshSessions()
      await refreshGit()
      if (c.activeSessionId) {
        try {
          const s = await api.getSession(c.activeSessionId)
          setMessages(
            s.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
          )
          setMode(s.mode)
        } catch {
          /* ignore */
        }
      }
    })()
    const id = window.setInterval(() => {
      void refreshHealth()
      void refreshGit()
    }, 12000)
    return () => window.clearInterval(id)
  }, [refreshHealth, refreshTree, refreshSessions, refreshGit])

  const persistSession = useCallback(
    async (nextMessages: UiMessage[], nextMode: AgentMode) => {
      let sid = activeSessionId
      if (!sid) {
        const created = await api.createSession(
          nextMessages.find((m) => m.role === 'user')?.content.slice(0, 48) || 'New chat',
          nextMode,
        )
        sid = created.id
        setActiveSessionId(sid)
        await api.saveConfig({ activeSessionId: sid })
      }
      await api.saveSession(sid, {
        mode: nextMode,
        messages: nextMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date().toISOString(),
        })),
      })
      await refreshSessions()
    },
    [activeSessionId, refreshSessions],
  )

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

  const createFile = async () => {
    const path = window.prompt('New file path (relative to workspace)', 'src/new-file.ts')
    if (!path) return
    await api.createFile(path, '')
    await refreshTree()
    await openFile(path)
    showToast(`Created ${path}`)
  }

  const deleteFile = async (path: string) => {
    if (!window.confirm(`Delete ${path}?`)) return
    await api.deleteFile(path)
    closeTab(path)
    await refreshTree()
    showToast(`Deleted ${path}`)
  }

  const history = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages],
  )

  const stopStream = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    showToast('Stopped')
  }

  const runChat = async (prompt: string, opts?: { mode?: AgentMode; selection?: string }) => {
    if (!prompt.trim() || streaming) return
    const useMode = opts?.mode ?? mode
    const mentioned = parseMentions(prompt).filter((p) => fileHints.includes(p))
    const userMsg: UiMessage = { id: nid(), role: 'user', content: prompt }
    const assistantId = nid()
    const seeded = [...messages, userMsg, { id: assistantId, role: 'assistant' as const, content: '', tools: [] as string[] }]
    setMessages(seeded)
    setStreaming(true)
    const ac = new AbortController()
    abortRef.current = ac

    let finalMessages = seeded
    await streamChat(
      {
        prompt,
        mode: useMode,
        history,
        openFiles: tabs.map((t) => t.path),
        activeFile: activePath,
        selection: opts?.selection,
        applyEdits: useMode === 'agent',
        mentionedFiles: mentioned,
      },
      {
        onToken: (t) => {
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + t } : m,
            )
            finalMessages = next
            return next
          })
        },
        onTool: (name) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, tools: [...(m.tools ?? []), name === 'result' ? '✓' : name] }
                : m,
            ),
          )
        },
        onDone: (full, edits, applied) => {
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: full || m.content, edits, applied }
                : m,
            )
            finalMessages = next
            return next
          })
          if (applied.length) {
            void (async () => {
              for (const path of applied) {
                try {
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
                } catch {
                  /* skip */
                }
              }
              await refreshTree()
              await refreshGit()
            })()
          }
        },
        onError: (msg) => {
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content ||
                      `**Error:** ${msg}\n\nOpen **Model Hub**, enable Offline engine or a localhost model.`,
                  }
                : m,
            )
            finalMessages = next
            return next
          })
        },
      },
      ac.signal,
    ).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      showToast(err instanceof Error ? err.message : 'Request failed')
    })

    abortRef.current = null
    setStreaming(false)
    void persistSession(finalMessages, useMode)
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
    const { applied, checkpointId } = await api.applyEdits(edits, true)
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
        m.edits && m.edits.some((e) => applied.includes(e.path)) ? { ...m, applied } : m,
      ),
    )
    await refreshTree()
    await refreshGit()
    setDiffOpen(false)
    showToast(
      checkpointId
        ? `Applied ${applied.length} file(s) · checkpoint ${checkpointId}`
        : `Applied ${applied.length} file(s)`,
    )
  }

  const onPreview = async (edits: ChatEdit[]) => {
    const { previews } = await api.previewEdits(edits)
    setPendingEdits(edits)
    setDiffPreviews(previews)
    setDiffOpen(true)
  }

  const insertMention = (path: string) => {
    setDraft((d) => d.replace(/@[\w./-]*$/, `@${path} `))
  }

  const newSession = async () => {
    const s = await api.createSession('New chat', mode)
    setActiveSessionId(s.id)
    setMessages([])
    await api.saveConfig({ activeSessionId: s.id })
    await refreshSessions()
    showToast('New chat session')
  }

  const selectSession = async (id: string) => {
    if (!id) return
    const s = await api.getSession(id)
    setActiveSessionId(id)
    setMode(s.mode)
    setMessages(s.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })))
    await api.saveConfig({ activeSessionId: id })
  }

  const exportSession = async () => {
    if (!activeSessionId) {
      showToast('Save a message first to create a session')
      return
    }
    const md = await api.exportSession(activeSessionId)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `localforge-chat-${activeSessionId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const undoLastCheckpoint = async () => {
    const { checkpoints } = await api.checkpoints()
    const latest = checkpoints[0]
    if (!latest) {
      showToast('No checkpoints yet')
      return
    }
    const { restored } = await api.restoreCheckpoint(latest.id)
    for (const path of restored) {
      try {
        await openFile(path)
        const file = await api.readFile(path)
        setTabs((prev) =>
          prev.map((t) =>
            t.path === path
              ? { ...t, content: file.content, language: file.language, dirty: false }
              : t,
          ),
        )
      } catch {
        /* skip */
      }
    }
    await refreshTree()
    showToast(`Restored checkpoint ${latest.id}`)
  }

  const paletteActions: PaletteAction[] = useMemo(() => {
    const cmds: PaletteAction[] = [
      { id: 'hub', label: 'Open Model Hub', hint: 'models', run: () => setHubOpen(true) },
      { id: 'settings', label: 'Open Settings', hint: 'workspace', run: () => setSettingsOpen(true) },
      { id: 'search', label: 'Find in files', hint: '⌘⇧F', run: () => setSearchOpen(true) },
      { id: 'git', label: 'Toggle Git panel', hint: 'scm', run: () => setGitOpen((v) => !v) },
      { id: 'graph', label: 'Open Graph LLM', hint: 'knowledge graph', run: () => setGraphOpen(true) },
      { id: 'term', label: 'Toggle Terminal', hint: 'shell', run: () => setTerminalOpen((v) => !v) },
      { id: 'shortcuts', label: 'Keyboard shortcuts', run: () => setShortcutsOpen(true) },
      { id: 'save', label: 'Save file', hint: '⌘S', run: () => void saveActive() },
      { id: 'new', label: 'New file', run: () => void createFile() },
      { id: 'session', label: 'New chat session', run: () => void newSession() },
      { id: 'undo-cp', label: 'Restore last checkpoint', run: () => void undoLastCheckpoint() },
      { id: 'ask', label: 'Mode: Ask', run: () => setMode('ask') },
      { id: 'edit', label: 'Mode: Edit', run: () => setMode('edit') },
      { id: 'agent', label: 'Mode: Agent', run: () => setMode('agent') },
      { id: 'clear', label: 'Clear chat', run: () => setMessages([]) },
    ]
    for (const f of fileHints) {
      cmds.push({ id: `file:${f}`, label: f, hint: 'file', run: () => void openFile(f) })
    }
    return cmds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHints, tabs, activePath])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActive()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.inline-bar input')?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault()
        setTerminalOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setDiffOpen(false)
        setSearchOpen(false)
        setShortcutsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
            <div className="brand-tag">v{version} · Cursor-style fork</div>
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
          {config?.offlineMode !== false && <span className="offline-pill">offline</span>}
          <span
            className={`status-dot ${providerOk ? 'ok' : ''}`}
            title={providerOk ? 'Local provider online' : 'Local provider offline'}
          />
          <span className="hint" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {config?.selectedModel || 'no model'}
          </span>
          <button type="button" className="ghost-btn" onClick={() => setSearchOpen(true)} title="Find">
            Find
          </button>
          <button type="button" className="ghost-btn" onClick={() => setGraphOpen(true)} title="Graph LLM">
            Graph
          </button>
          <button type="button" className="ghost-btn" onClick={() => setGitOpen((v) => !v)}>
            Git
          </button>
          <button type="button" className="ghost-btn" onClick={() => setPaletteOpen(true)} title="⌘P">
            ⌘P
          </button>
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

      <div className={`main-grid ${terminalOpen ? 'with-term' : ''} ${gitOpen ? 'with-git' : ''}`}>
        <aside className="panel files">
          <div className="panel-header">
            <span>Files</span>
            <button
              type="button"
              className="ghost-btn"
              style={{ padding: '2px 8px' }}
              onClick={() => void refreshTree()}
            >
              ↻
            </button>
          </div>
          <div className="panel-body">
            <FileTree
              tree={tree}
              activePath={activePath}
              onOpen={(p) => void openFile(p)}
              onCreate={() => void createFile()}
              onDelete={(p) => void deleteFile(p)}
            />
          </div>
          {gitOpen && <GitPanel open={gitOpen} onOpenFile={(p) => void openFile(p)} />}
        </aside>

        <div className="center-stack">
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
            autocomplete={config?.tabAutocomplete !== false}
          />
          <TerminalPanel open={terminalOpen} onToggle={() => setTerminalOpen((v) => !v)} />
        </div>

        <ChatPanel
          mode={mode}
          messages={messages}
          draft={draft}
          streaming={streaming}
          fileHints={fileHints}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onDraft={setDraft}
          onSend={() => void onSend()}
          onStop={stopStream}
          onClear={() => setMessages([])}
          onApply={(edits) => void onApply(edits)}
          onPreview={(edits) => void onPreview(edits)}
          onInsertMention={insertMention}
          onNewSession={() => void newSession()}
          onSelectSession={(id) => void selectSession(id)}
          onExportSession={() => void exportSession()}
        />
      </div>

      <StatusBar
        offline={config?.offlineMode !== false}
        providerOk={providerOk}
        model={config?.selectedModel}
        branch={gitBranch}
        path={activePath}
        language={activeTab?.language}
        version={version}
      />

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
          void refreshGit()
        }}
        toast={showToast}
      />
      <CommandPalette open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />
      <DiffModal
        open={diffOpen}
        previews={diffPreviews}
        onClose={() => setDiffOpen(false)}
        onApply={() => void onApply(pendingEdits)}
      />
      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpen={(p) => void openFile(p)}
      />
      <GraphPanel
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        onOpenFile={(p) => void openFile(p)}
        toast={showToast}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
