import { useEffect, useRef, useState, useEffectEvent } from 'react'
import jsQR from 'jsqr'
import { createQrMatrix, type QrMatrix } from './lib/qr'
import { engraveQrIntoImageData } from './lib/engrave'
import { THEMES, drawTheme, type ThemeId } from './lib/themes'
import './App.css'

const SIZE = 512

export default function App() {
  const [payload, setPayload] = useState('https://github.com/MrSmitG')
  const [theme, setTheme] = useState<ThemeId>('space-cruise')
  const [strength, setStrength] = useState(0.62)
  const [motion, setMotion] = useState(true)
  const [reveal, setReveal] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const artRef = useRef<HTMLCanvasElement | null>(null)
  const matrixRef = useRef<QrMatrix | null>(null)
  const timeRef = useRef(0)
  const rafRef = useRef(0)

  const rebuildMatrix = useEffectEvent((text: string) => {
    try {
      matrixRef.current = createQrMatrix(text.trim() || ' ')
      setScanStatus('idle')
      setScanResult(null)
    } catch {
      matrixRef.current = null
    }
  })

  useEffect(() => {
    rebuildMatrix(payload)
  }, [payload, rebuildMatrix])

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
    const artCtx = art.getContext('2d')
    if (!ctx || !artCtx) return

    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (motion) timeRef.current += dt

      artCtx.clearRect(0, 0, SIZE, SIZE)
      drawTheme(theme, artCtx, SIZE, SIZE, timeRef.current)

      const matrix = matrixRef.current
      if (matrix) {
        const engraved = engraveQrIntoImageData(
          artCtx.getImageData(0, 0, SIZE, SIZE),
          matrix,
          { strength: reveal ? Math.min(1, strength + 0.25) : strength },
        )
        ctx.putImageData(engraved, 0, 0)

        if (reveal) {
          // Ghost outline of modules for debugging
          const total = matrix.size + 4
          const mw = SIZE / total
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'
          ctx.lineWidth = 1
          for (let y = 0; y < matrix.size; y++) {
            for (let x = 0; x < matrix.size; x++) {
              if (!matrix.modules[y][x]) continue
              ctx.strokeRect((x + 2) * mw, (y + 2) * mw, mw, mw)
            }
          }
        }
      } else {
        ctx.drawImage(art, 0, 0)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [theme, strength, motion, reveal])

  const verifyScan = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE)
    const code = jsQR(imageData.data, SIZE, SIZE, { inversionAttempts: 'attemptBoth' })
    if (code?.data) {
      setScanResult(code.data)
      setScanStatus('ok')
    } else {
      setScanResult(null)
      setScanStatus('fail')
    }
  }

  const downloadPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `veil-${theme}.png`
    a.click()
  }

  const activeTheme = THEMES.find((t) => t.id === theme)!

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />

      <header className="top">
        <p className="brand">VEIL</p>
        <p className="tag">Art that scans</p>
      </header>

      <main className="stage">
        <section className="hero-visual" aria-label="Engraved QR preview">
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="art-canvas" />
          <div className="visual-meta">
            <span>{activeTheme.name}</span>
            <span className={motion ? 'live' : ''}>{motion ? 'In motion' : 'Still'}</span>
          </div>
        </section>

        <section className="controls" aria-label="Controls">
          <h1>Hide a QR inside moving art</h1>
          <p className="lede">
            The code is engraved into luminance — your phone reads it, your eyes see a painting.
          </p>

          <label className="field">
            <span>What should it unlock?</span>
            <input
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="URL, text, Wi‑Fi payload…"
              spellCheck={false}
            />
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

          <label className="field slider">
            <span>
              Engrave depth <em>{Math.round(strength * 100)}%</em>
            </span>
            <input
              type="range"
              min={0.35}
              max={0.95}
              step={0.01}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
            <small>Lower = more invisible. Higher = easier to scan.</small>
          </label>

          <div className="toggles">
            <label className="check">
              <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} />
              Motion
            </label>
            <label className="check">
              <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
              Reveal modules
            </label>
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={verifyScan}>
              Scan this frame
            </button>
            <button type="button" className="ghost" onClick={downloadPng}>
              Download PNG
            </button>
          </div>

          {scanStatus === 'ok' && (
            <p className="scan ok" role="status">
              Scanned: <code>{scanResult}</code>
            </p>
          )}
          {scanStatus === 'fail' && (
            <p className="scan fail" role="status">
              No QR found — raise Engrave depth a bit and try a still frame.
            </p>
          )}

          <details className="howto">
            <summary>How this works</summary>
            <ol>
              <li>A high–error-correction QR matrix is generated from your text.</li>
              <li>Art is painted every frame (stars, brush strokes, rain…).</li>
              <li>
                Each QR module gently darkens or lightens that patch of the image — like an engraving —
                so the pattern exists in brightness, not as a black grid.
              </li>
              <li>Corner finders stay a bit stronger so phone cameras can lock on.</li>
              <li>Point any QR scanner at the image (pause motion if needed).</li>
            </ol>
          </details>
        </section>
      </main>

      <footer className="foot">
        <span>VEIL · artistic QR engraver</span>
      </footer>
    </div>
  )
}
