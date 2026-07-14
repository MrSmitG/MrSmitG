import { useMemo, useRef, useState } from 'react'
import VeilCanvas, { type VeilCanvasHandle } from '../components/VeilCanvas'
import { THEMES, type ThemeId } from '../lib/themes'
import { buildUpiUri, isValidVpa, parseUpiUri } from '../lib/upi'
import { extractPayload } from '../lib/stego'
import { useApp } from '../lib/store'
import type { PayTarget } from '../components/PaySheet'

type Props = {
  onPay: (t: PayTarget) => void
}

type Mode = 'pay' | 'link'

export default function PayScreen({ onPay }: Props) {
  const { account } = useApp()
  const [mode, setMode] = useState<Mode>('pay')
  const [payeeName, setPayeeName] = useState(account.name)
  const [vpa, setVpa] = useState(account.vpa)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [linkText, setLinkText] = useState('https://veil.pay/@smit')
  const [theme, setTheme] = useState<ThemeId>('midnight-drive')
  const [linkResult, setLinkResult] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const canvasRef = useRef<VeilCanvasHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const payload = useMemo(() => {
    if (mode === 'link') return linkText
    return buildUpiUri({ payeeName, vpa, amount, note })
  }, [mode, linkText, payeeName, vpa, amount, note])

  const handleFound = (found: string | null) => {
    setErr(null)
    setLinkResult(null)
    if (found == null) {
      setErr('No VEIL data found. Use a PNG created by VEIL (not a screenshot/JPEG).')
      return
    }
    const upi = parseUpiUri(found)
    if (upi) {
      onPay({
        name: upi.payeeName || upi.vpa,
        vpa: upi.vpa,
        amount: upi.amount,
        note: upi.note,
        method: 'veil',
      })
    } else {
      setLinkResult(found)
    }
  }

  const scanLive = () => handleFound(canvasRef.current?.scan() ?? null)

  const onUpload = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const cctx = c.getContext('2d', { willReadFrequently: true })
      if (!cctx) return
      cctx.drawImage(img, 0, 0)
      handleFound(extractPayload(cctx.getImageData(0, 0, c.width, c.height)))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      setErr('Could not read that image.')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const download = () => {
    const data = canvasRef.current?.getDataUrl()
    if (!data) return
    const a = document.createElement('a')
    a.href = data
    a.download = `veil-${mode}.png`
    a.click()
  }

  const vpaOk = mode !== 'pay' || isValidVpa(vpa)

  return (
    <div className="screen pay-screen">
      <h1 className="screen-title">Pay with an image</h1>
      <p className="screen-sub">
        Create a private VEIL image with your payment inside — no visible QR. Anyone scans it in VEIL
        to pay you.
      </p>

      <div className="veil-frame">
        <VeilCanvas ref={canvasRef} payload={payload} theme={theme} className="pay-canvas" />
        <span className="frame-badge">✓ VEIL verified</span>
      </div>

      <div className="mode-switch">
        <button className={mode === 'pay' ? 'mode on' : 'mode'} onClick={() => setMode('pay')}>
          Request payment
        </button>
        <button className={mode === 'link' ? 'mode on' : 'mode'} onClick={() => setMode('link')}>
          Share a link
        </button>
      </div>

      {mode === 'pay' ? (
        <div className="pay-fields">
          <label className="field">
            <span>Payee name</span>
            <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
          </label>
          <label className="field">
            <span>UPI ID</span>
            <input
              value={vpa}
              onChange={(e) => setVpa(e.target.value)}
              spellCheck={false}
              aria-invalid={!vpaOk}
            />
            {!vpaOk && <small className="err">Enter a valid UPI ID like name@bank</small>}
          </label>
          <div className="field-row">
            <label className="field">
              <span>Amount (₹)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="optional"
                inputMode="decimal"
              />
            </label>
            <label className="field">
              <span>Note</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
            </label>
          </div>
        </div>
      ) : (
        <label className="field">
          <span>Link / text</span>
          <input value={linkText} onChange={(e) => setLinkText(e.target.value)} spellCheck={false} />
        </label>
      )}

      <div className="theme-chips">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={theme === t.id ? 'chip on' : 'chip'}
            onClick={() => setTheme(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="actions">
        <button className="primary" onClick={scanLive}>
          {mode === 'pay' ? 'Scan & pay this' : 'Scan this'}
        </button>
        <button className="ghost" onClick={download}>
          Download image
        </button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          Scan a PNG
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp"
          hidden
          onChange={(e) => onUpload(e.target.files?.[0])}
        />
      </div>

      {linkResult && (
        <p className="scan ok">
          <span className="verified">✓ VEIL verified</span>
          Unlocked: <code>{linkResult}</code>
        </p>
      )}
      {err && <p className="scan fail">{err}</p>}
    </div>
  )
}
