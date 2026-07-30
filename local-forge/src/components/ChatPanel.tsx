import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentMode, ChatEdit } from '../lib/api.ts'

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  edits?: ChatEdit[]
  applied?: string[]
}

interface Props {
  mode: AgentMode
  messages: UiMessage[]
  draft: string
  streaming: boolean
  chatOpenMobile?: boolean
  onDraft: (v: string) => void
  onSend: () => void
  onApply: (edits: ChatEdit[]) => void
  onStopHint?: string
}

export function ChatPanel({
  mode,
  messages,
  draft,
  streaming,
  onDraft,
  onSend,
  onApply,
}: Props) {
  return (
    <aside className="panel chat chat-panel open">
      <div className="panel-header">
        <span>{mode} panel</span>
        <span className="hint">local only</span>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="msg assistant">
            <div className="role">LocalForge</div>
            <p style={{ margin: 0 }}>
              I run on your local LLM. Use <strong>Ask</strong> to explore, <strong>Edit</strong> for
              focused file changes, and <strong>Agent</strong> for multi-file work. Download a model
              in the hub if you have not yet.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
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
                    : `Proposed edits: ${m.edits.map((e) => e.path).join(', ')}`}
                </span>
                {!m.applied?.length && (
                  <button type="button" className="primary-btn" onClick={() => onApply(m.edits!)}>
                    Apply edits
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="chat-compose">
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder={
            mode === 'ask'
              ? 'Ask about this codebase…'
              : mode === 'edit'
                ? 'Describe the edit you want…'
                : 'Give the agent a goal…'
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
          <span className="hint">⌘/Ctrl + Enter to send</span>
          <button
            type="button"
            className="primary-btn"
            onClick={onSend}
            disabled={streaming || !draft.trim()}
          >
            {streaming ? 'Thinking…' : mode === 'agent' ? 'Run agent' : 'Send'}
          </button>
        </div>
      </div>
    </aside>
  )
}
