import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'

interface Line {
  id: number
  kind: 'in' | 'out' | 'err' | 'meta'
  text: string
}

interface Props {
  open: boolean
  onToggle: () => void
}

let lineId = 0

export function TerminalPanel({ open, onToggle }: Props) {
  const [cmd, setCmd] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { id: ++lineId, kind: 'meta', text: 'LocalForge terminal — commands run in the workspace folder.' },
  ])
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, open])

  if (!open) {
    return (
      <button type="button" className="terminal-tab" onClick={onToggle}>
        Terminal
      </button>
    )
  }

  const run = async () => {
    const command = cmd.trim()
    if (!command || busy) return
    setCmd('')
    setLines((prev) => [...prev, { id: ++lineId, kind: 'in', text: `$ ${command}` }])
    setBusy(true)
    try {
      const result = await api.terminal(command)
      if (result.stdout) {
        setLines((prev) => [
          ...prev,
          ...result.stdout.split('\n').map((t) => ({ id: ++lineId, kind: 'out' as const, text: t })),
        ])
      }
      if (result.stderr) {
        setLines((prev) => [
          ...prev,
          ...result.stderr.split('\n').map((t) => ({ id: ++lineId, kind: 'err' as const, text: t })),
        ])
      }
      setLines((prev) => [
        ...prev,
        {
          id: ++lineId,
          kind: 'meta',
          text: `exit ${result.exitCode ?? '?'}${result.truncated ? ' (truncated)' : ''}`,
        },
      ])
    } catch (err) {
      setLines((prev) => [
        ...prev,
        { id: ++lineId, kind: 'err', text: err instanceof Error ? err.message : 'Failed' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span>Terminal</span>
        <button type="button" className="ghost-btn" style={{ padding: '2px 8px' }} onClick={onToggle}>
          Hide
        </button>
      </div>
      <div className="terminal-body">
        {lines.map((l) => (
          <div key={l.id} className={`term-line ${l.kind}`}>
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="terminal-input">
        <span className="hint">$</span>
        <input
          value={cmd}
          disabled={busy}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
          placeholder="npm test, ls, …"
        />
        <button type="button" className="primary-btn" disabled={busy || !cmd.trim()} onClick={() => void run()}>
          Run
        </button>
      </div>
    </div>
  )
}
