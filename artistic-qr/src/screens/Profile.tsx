import { useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import VeilCanvas, { type VeilCanvasHandle } from '../components/VeilCanvas'
import { buildUpiUri } from '../lib/upi'
import { resetDemo, useApp } from '../lib/store'
import { formatINR } from '../lib/format'

export default function Profile() {
  const { account } = useApp()
  const canvasRef = useRef<VeilCanvasHandle>(null)
  const [showReceive, setShowReceive] = useState(true)

  const receivePayload = buildUpiUri({ payeeName: account.name, vpa: account.vpa })

  const download = () => {
    const data = canvasRef.current?.getDataUrl()
    if (!data) return
    const a = document.createElement('a')
    a.href = data
    a.download = 'veil-receive.png'
    a.click()
  }

  return (
    <div className="screen you">
      <div className="you-head">
        <Avatar name={account.name} color="#e07a3d" size={72} />
        <p className="you-name">{account.name}</p>
        <p className="you-vpa">{account.vpa}</p>
        <p className="you-bal">Balance {formatINR(account.balance)}</p>
      </div>

      <section className="receive">
        <div className="section-head">
          <h2 className="section-title">Your receive image</h2>
          <button className="link-btn" onClick={() => setShowReceive((s) => !s)}>
            {showReceive ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="screen-sub">
          Share this art anywhere. It looks like a picture, but VEIL reads your UPI ID from inside it
          — no visible QR to screenshot or misuse.
        </p>
        {showReceive && (
          <div className="veil-frame small">
            <VeilCanvas
              ref={canvasRef}
              payload={receivePayload}
              theme="bridge-dawn"
              size={360}
              className="pay-canvas"
            />
            <span className="frame-badge">✓ VEIL verified</span>
          </div>
        )}
        <button className="ghost wide" onClick={download}>
          Download receive image
        </button>
      </section>

      <section className="settings">
        <h2 className="section-title">Why VEIL is better</h2>
        <ul className="perk-list">
          <li>
            <strong>No visible QR.</strong> Your payment code hides inside art, so it can’t be silently
            screenshotted and reused off a poster.
          </li>
          <li>
            <strong>Signed &amp; verified.</strong> Every VEIL image carries a signature — fakes read as
            “not found”.
          </li>
          <li>
            <strong>Personal.</strong> Your code lives inside a picture you choose.
          </li>
        </ul>
        <button className="ghost wide danger" onClick={resetDemo}>
          Reset demo data
        </button>
      </section>
    </div>
  )
}
