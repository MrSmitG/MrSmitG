import { useEffect, useRef, useState } from 'react'
import { embedPayload, extractPayload, MAX_PAYLOAD_BYTES } from './lib/stego'
import { THEMES, drawTheme, type ThemeId } from './lib/themes'
import './App.css'

const SIZE = 512

export default function App() {
  const [payload, setPayload] = useState('https://github.com/MrSmitG')
  const [theme, setTheme] = useState<ThemeId>('midnight-drive')
  const [motion, setMotion] = useState(true)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const artRef = useRef<HTMLCanvasElement | null>(null)
  const timeRef = useRef(0)
  const rafRef = useRef(0)
  const lastFrameRef = useRef<ImageData | null>(null)
  const payloadRef = useRef(payload)
  const fileRef = useRef<HTMLInputElement>(null)
  const normalizedPayload = payload.trim() || ' '
  const payloadBytes = new TextEncoder().encode(normalizedPayload).length
  const payloadTooLong = payloadBytes > MAX_PAYLOAD_BYTES

  useEffect(() => {
    payloadRef.current = payload
    setScanStatus('idle')
    setScanResult(null)
  }, [payload])

  useEffect(() => {
    if (!artRef.current) {
      artRef.current = document.createElement('canvas')
      artRef.current.width = SIZE
      artRef.current.height = SIZE
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const art = artRef.current
    const artCtx = art.getContext('2d', { willReadFrequently: true })
    if (!ctx || !artCtx) return

    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (motion) timeRef.current += dt

      artCtx.clearRect(0, 0, SIZE, SIZE)
      drawTheme(theme, artCtx, SIZE, SIZE, timeRef.current)

      const raw = artCtx.getImageData(0, 0, SIZE, SIZE)
      try {
        const hidden = embedPayload(raw, payloadRef.current.trim() || ' ')
        ctx.putImageData(hidden, 0, 0)
        lastFrameRef.current = hidden
      } catch {
        ctx.putImageData(raw, 0, 0)
        lastFrameRef.current = raw
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [theme, motion])

  const readFrame = (imageData: ImageData) => {
    const found = extractPayload(imageData)
    if (found != null) {
      setScanResult(found)
      setScanStatus('ok')
    } else {
      setScanResult(null)
      setScanStatus('fail')
    }
  }

  const scanFrame = () => {
    const frame = lastFrameRef.current
    if (!frame) {
      setScanStatus('fail')
      return
    }
    readFrame(frame)
  }

  const downloadPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `veil-${theme}.png`
    a.click()
  }

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
      readFrame(cctx.getImageData(0, 0, c.width, c.height))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      setScanStatus('fail')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const activeTheme = THEMES.find((t) => t.id === theme)!

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />

      <header className="top">
        <p className="brand">VEIL</p>
        <p className="tag">Images that carry secrets</p>
      </header>

      <main className="stage">
        <section className="hero-visual" aria-label="Living art preview">
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="art-canvas" />
          <div className="visual-meta">
            <span>{activeTheme.name}</span>
            <span className={motion ? 'live' : ''}>{motion ? 'In motion' : 'Still'}</span>
          </div>
        </section>

        <section className="controls" aria-label="Controls">
          <h1>An image that acts like a QR</h1>
          <p className="lede">
            No grid. No black squares. Cars, portraits, monuments — with your link invisible inside
            the pixels. Scan with VEIL to reveal it.
          </p>

          <label className="field">
            <span>Hidden message / URL</span>
            <input
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="URL, text, anything…"
              spellCheck={false}
              aria-invalid={payloadTooLong}
              aria-describedby={payloadTooLong ? 'payload-error' : undefined}
            />
            {payloadTooLong && (
              <em id="payload-error" role="alert">
                Message is {payloadBytes.toLocaleString()} bytes; shorten it to {MAX_PAYLOAD_BYTES.toLocaleString()} bytes
                or fewer before downloading.
              </em>
            )}
          </label>

          <div className="theme-grid" role="listbox" aria-label="Art themes">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={theme === t.id}
                className={theme === t.id ? 'theme on' : 'theme'}
                onClick={() => setTheme(t.id)}
              >
                <strong>{t.name}</strong>
                <span>{t.blurb}</span>
              </button>
            ))}
          </div>

          <div className="toggles">
            <label className="check">
              <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} />
              Motion
            </label>
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={scanFrame} disabled={payloadTooLong}>
              Scan this frame
            </button>
            <button type="button" className="ghost" onClick={downloadPng} disabled={payloadTooLong}>
              Download PNG
            </button>
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
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

          {scanStatus === 'ok' && (
            <p className="scan ok" role="status" data-testid="scan-ok">
              Unlocked: <code>{scanResult}</code>
            </p>
          )}
          {scanStatus === 'fail' && (
            <p className="scan fail" role="status" data-testid="scan-fail">
              No hidden message found. Use a PNG downloaded from VEIL (not a screenshot/JPEG).
            </p>
          )}

          <details className="howto">
            <summary>How this is different from a QR</summary>
            <ol>
              <li>A normal QR is a visible black-and-white pattern phones recognize.</li>
              <li>
                VEIL paints pure art, then quietly flips the least-significant bits of pixels to store
                your message — invisible, but recoverable.
              </li>
              <li>Phone QR apps will not see anything. Scan here, or reopen a downloaded PNG in VEIL.</li>
              <li>Keep files as PNG/WebP. Screenshots and JPEG recompression destroy the hidden bits.</li>
            </ol>
          </details>
        </section>
      </main>

      <footer className="foot">
        <span>VEIL · image-as-code</span>
      </footer>
    </div>
  )
}
