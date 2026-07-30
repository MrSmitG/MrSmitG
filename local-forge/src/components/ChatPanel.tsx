import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentMode, ChatEdit } from '../lib/api.ts'

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  edits?: ChatEdit[]
  applied?: string[]
  tools?: string[]
}

interface Props {
  mode: AgentMode
  messages: UiMessage[]
  draft: string
  streaming: boolean
  fileHints: string[]
  onDraft: (v: string) => void
  onSend: () => void
  onStop: () => void
  onClear: () => void
  onApply: (edits: ChatEdit[]) => void
  onPreview: (edits: ChatEdit[]) => void
  onInsertMention: (path: string) => void
}

export function ChatPanel({
  mode,
  messages,
  draft,
  streaming,
  fileHints,
  onDraft,
  onSend,
  onStop,
  onClear,
  onApply,
  onPreview,
  onInsertMention,
}: Props) {
  const mentionActive = /@[\w./-]*$/.test(draft)
  const mentionQuery = mentionActive ? (draft.match(/@([\w./-]*)$/)?.[1] ?? '') : ''
  const suggestions = mentionActive
    ? fileHints.filter((f) => f.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8)
    : []

  return (
    <aside className="panel chat chat-panel open">
      <div className="panel-header">
        <span>{mode} panel</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="ghost-btn" style={{ padding: '2px 8px' }} onClick={onClear}>
            Clear
          </button>
          <span className="hint">local</span>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="msg assistant">
            <div className="role">LocalForge</div>
            <p style={{ margin: 0 }}>
              Ask questions, propose edits, or run the <strong>agent</strong> tool loop. Use{' '}
              <code>@file</code> to attach context. Open Model Hub to download a local model.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
            {m.tools && m.tools.length > 0 && (
              <div className="tool-chips">
                {m.tools.map((t, i) => (
                  <span key={`${t}-${i}`} className="chip accent">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {m.role === 'assistant' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || '…'}</ReactMarkdown>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            )}
            {m.edits && m.edits.length > 0 && (
              <div className="apply-banner">
                <span className="hint">
                  {m.applied?.length
                    ? `Applied: ${m.applied.join(', ')}`
                    : `Proposed: ${m.edits.map((e) => e.path).join(', ')}`}
                </span>
                {!m.applied?.length && (
                  <>
                    <button type="button" className="ghost-btn" onClick={() => onPreview(m.edits!)}>
                      Diff
                    </button>
                    <button type="button" className="primary-btn" onClick={() => onApply(m.edits!)}>
                      Apply
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="chat-compose">
        {suggestions.length > 0 && (
          <div className="mention-menu">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => onInsertMention(s)}>
                @{s}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder={
            mode === 'ask'
              ? 'Ask about this codebase… (@file to attach)'
              : mode === 'edit'
                ? 'Describe the edit…'
                : 'Agent goal — tools will read/search/write…'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSend()
            }
          }}
          disabled={streaming}
        />
        <div className="compose-row">
          <span className="hint">⌘/Ctrl + Enter · @mention</span>
          {streaming ? (
            <button type="button" className="danger-btn" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={onSend} disabled={!draft.trim()}>
              {mode === 'agent' ? 'Run agent' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
