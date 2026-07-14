import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar'
import { formatINR } from '../lib/format'
import { colorFor, recordPayment, useApp } from '../lib/store'
import { buildUpiUri } from '../lib/upi'

export type PayTarget = {
  name: string
  vpa: string
  amount?: string
  note?: string
  method: 'veil' | 'upi'
}

type Props = {
  target: PayTarget
  onClose: () => void
  onDone: () => void
}

type Stage = 'confirm' | 'pin' | 'success' | 'error'

export default function PaySheet({ target, onClose, onDone }: Props) {
  const { account } = useApp()
  const [amount, setAmount] = useState(target.amount ?? '')
  const [note, setNote] = useState(target.note ?? '')
  const [stage, setStage] = useState<Stage>('confirm')
  const [pin, setPin] = useState('')

  const amt = Number(amount)
  const valid = amount !== '' && !Number.isNaN(amt) && amt > 0
  const insufficient = valid && amt > account.balance

  const color = useMemo(() => colorFor(target.vpa || target.name), [target])
  const upiUri = buildUpiUri({ payeeName: target.name, vpa: target.vpa, amount, note })

  useEffect(() => {
    if (stage !== 'pin' || pin.length < 4) return
    const ok = setTimeout(() => {
      if (insufficient) {
        setStage('error')
        return
      }
      recordPayment({
        direction: 'sent',
        name: target.name,
        vpa: target.vpa,
        amount: amt,
        note: note.trim() || undefined,
        method: target.method,
      })
      setStage('success')
    }, 600)
    return () => clearTimeout(ok)
  }, [pin, stage, insufficient, amt, note, target])

  const press = (d: string) => {
    if (d === 'del') return setPin((p) => p.slice(0, -1))
    if (pin.length >= 4) return
    setPin((p) => p + d)
  }

  return (
    <div className="sheet-backdrop" onClick={stage === 'success' ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        {stage === 'confirm' && (
          <>
            <div className="sheet-grip" />
            <div className="pay-head">
              <Avatar name={target.name} color={color} size={56} />
              <div>
                <p className="pay-to-label">Paying</p>
                <p className="pay-to-name">{target.name}</p>
                <p className="pay-to-vpa">{target.vpa}</p>
              </div>
              {target.method === 'veil' && <span className="veil-chip">✓ VEIL</span>}
            </div>

            <div className="amount-entry">
              <span className="rupee">₹</span>
              <input
                autoFocus
                className="amount-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                inputMode="decimal"
                aria-label="Amount"
              />
            </div>

            <input
              className="note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note"
            />

            <p className="bal-line">
              Balance: {formatINR(account.balance)}
              {insufficient && <span className="bal-warn"> · Not enough balance</span>}
            </p>

            <button
              className="pay-cta"
              disabled={!valid || insufficient}
              onClick={() => setStage('pin')}
            >
              {valid ? `Pay ${formatINR(amt)}` : 'Enter amount'}
            </button>

            <a className="pay-alt" href={upiUri}>
              Open in another UPI app
            </a>
          </>
        )}

        {stage === 'pin' && (
          <>
            <div className="sheet-grip" />
            <p className="pin-title">Enter UPI PIN</p>
            <p className="pin-sub">
              Paying {formatINR(amt)} to {target.name}
            </p>
            <div className="pin-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < pin.length ? 'dot on' : 'dot'} />
              ))}
            </div>
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
                k === '' ? (
                  <span key={i} />
                ) : (
                  <button key={i} className="key" onClick={() => press(k)}>
                    {k === 'del' ? '⌫' : k}
                  </button>
                ),
              )}
            </div>
            <p className="pin-fine">Demo PIN — any 4 digits confirm</p>
          </>
        )}

        {stage === 'success' && (
          <div className="pay-result">
            <div className="result-badge ok">✓</div>
            <p className="result-amount">{formatINR(amt)}</p>
            <p className="result-text">Paid to {target.name}</p>
            <p className="result-vpa">{target.vpa}</p>
            {note.trim() && <p className="result-note">“{note.trim()}”</p>}
            <span className="veil-chip big">
              {target.method === 'veil' ? '✓ Paid via VEIL image' : '✓ Paid via UPI'}
            </span>
            <button className="pay-cta" onClick={onDone}>
              Done
            </button>
          </div>
        )}

        {stage === 'error' && (
          <div className="pay-result">
            <div className="result-badge err">!</div>
            <p className="result-text">Payment failed</p>
            <p className="result-vpa">Not enough balance</p>
            <button className="pay-cta" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
