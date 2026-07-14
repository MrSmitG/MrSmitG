export type ThemeId = 'midnight-drive' | 'studio-portrait' | 'stone-monument' | 'bridge-dawn'

export type ThemeMeta = {
  id: ThemeId
  name: string
  blurb: string
}

/** Safe subject set: cars, portraits, secular monuments — no idols or religious figures. */
export const THEMES: ThemeMeta[] = [
  {
    id: 'midnight-drive',
    name: 'Midnight Drive',
    blurb: 'A car carving through night highway light',
  },
  {
    id: 'studio-portrait',
    name: 'Studio Portrait',
    blurb: 'A painted face under soft moving light',
  },
  {
    id: 'stone-monument',
    name: 'Stone Monument',
    blurb: 'Columns and arch under drifting sky',
  },
  {
    id: 'bridge-dawn',
    name: 'Bridge at Dawn',
    blurb: 'A landmark span over water and mist',
  },
]

type DrawCtx = {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  t: number
}

function fillSky(ctx: CanvasRenderingContext2D, w: number, h: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function drawCarBody(ctx: CanvasRenderingContext2D, scale: number, t: number) {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.rotate(Math.sin(t * 0.6) * 0.04)

  const glow = ctx.createRadialGradient(-80, 10, 2, -80, 10, 90)
  glow.addColorStop(0, 'rgba(255,160,60,0.65)')
  glow.addColorStop(1, 'rgba(255,80,20,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(-90, 12, 90, 28, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#d8c4a4'
  ctx.beginPath()
  ctx.moveTo(-70, 10)
  ctx.quadraticCurveTo(-40, -35, 20, -28)
  ctx.quadraticCurveTo(70, -18, 85, 8)
  ctx.quadraticCurveTo(90, 28, 60, 32)
  ctx.lineTo(-55, 32)
  ctx.quadraticCurveTo(-80, 28, -70, 10)
  ctx.fill()

  ctx.fillStyle = 'rgba(70,140,190,0.55)'
  ctx.beginPath()
  ctx.moveTo(-10, -8)
  ctx.quadraticCurveTo(15, -30, 45, -12)
  ctx.lineTo(35, 2)
  ctx.lineTo(-5, 2)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#c45c26'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-50, 14)
  ctx.lineTo(70, 10)
  ctx.stroke()

  // Wheels
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(-35, 34, 14, 0, Math.PI * 2)
  ctx.arc(48, 34, 14, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawMidnightDrive({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#070b14', '#1a1520')

  // Road
  const roadTop = h * 0.62
  ctx.fillStyle = '#12151c'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(w * 0.35, roadTop)
  ctx.lineTo(w * 0.65, roadTop)
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  // Center dashes racing toward viewer
  ctx.strokeStyle = 'rgba(232, 200, 120, 0.7)'
  ctx.lineWidth = 4
  ctx.setLineDash([18, 22])
  ctx.lineDashOffset = -t * 140
  ctx.beginPath()
  ctx.moveTo(w * 0.5, h)
  ctx.lineTo(w * 0.5, roadTop)
  ctx.stroke()
  ctx.setLineDash([])

  // Headlight wash
  const beam = ctx.createRadialGradient(w * 0.5, h * 0.7, 10, w * 0.5, h * 0.55, w * 0.45)
  beam.addColorStop(0, 'rgba(255, 210, 140, 0.28)')
  beam.addColorStop(1, 'rgba(255, 210, 140, 0)')
  ctx.fillStyle = beam
  ctx.fillRect(0, 0, w, h)

  // Distant city dots
  for (let i = 0; i < 30; i++) {
    const x = ((i * 97) % w)
    const y = roadTop - 20 - (i % 8) * 8 + Math.sin(t + i) * 2
    ctx.fillStyle = `rgba(255,${180 + (i % 50)},100,${0.35 + (Math.sin(t * 3 + i) + 1) * 0.2})`
    ctx.fillRect(x, y, 2, 2)
  }

  ctx.save()
  ctx.translate(w * 0.5 + Math.sin(t * 0.9) * w * 0.04, h * 0.58 + Math.sin(t * 1.5) * 6)
  drawCarBody(ctx, Math.min(w, h) * 0.00115, t)
  ctx.restore()
}

function drawStudioPortrait({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#1a1714', '#2c241c')

  // Soft backdrop wash
  const wash = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.45, w * 0.5)
  wash.addColorStop(0, 'rgba(90, 70, 55, 0.5)')
  wash.addColorStop(1, 'rgba(90, 70, 55, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)

  const cx = w * 0.5
  const cy = h * 0.42 + Math.sin(t * 0.5) * 4
  const s = Math.min(w, h)

  // Shoulders / torso
  ctx.fillStyle = '#3d4a55'
  ctx.beginPath()
  ctx.ellipse(cx, cy + s * 0.38, s * 0.28, s * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()

  // Neck
  ctx.fillStyle = '#c4a07a'
  ctx.fillRect(cx - s * 0.04, cy + s * 0.12, s * 0.08, s * 0.12)

  // Head
  ctx.fillStyle = '#d2b08a'
  ctx.beginPath()
  ctx.ellipse(cx, cy, s * 0.14, s * 0.17, 0, 0, Math.PI * 2)
  ctx.fill()

  // Hair
  ctx.fillStyle = '#2a221c'
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.06, s * 0.145, s * 0.12, 0, Math.PI, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.14, cy)
  ctx.quadraticCurveTo(cx - s * 0.18, cy + s * 0.1, cx - s * 0.1, cy + s * 0.16)
  ctx.lineTo(cx - s * 0.12, cy)
  ctx.fill()

  // Eyes (blink-ish)
  const eyeOpen = 0.85 + Math.sin(t * 0.7) * 0.08
  ctx.fillStyle = '#1e1a18'
  ctx.beginPath()
  ctx.ellipse(cx - s * 0.05, cy - s * 0.01, s * 0.018, s * 0.012 * eyeOpen, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + s * 0.05, cy - s * 0.01, s * 0.018, s * 0.012 * eyeOpen, 0, 0, Math.PI * 2)
  ctx.fill()

  // Mouth
  ctx.strokeStyle = '#8a5a48'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy + s * 0.06, s * 0.035, 0.15, Math.PI - 0.15)
  ctx.stroke()

  // Moving key light across the face
  const lx = cx + Math.sin(t * 0.8) * s * 0.12
  const ly = cy - s * 0.05 + Math.cos(t * 0.6) * s * 0.04
  const key = ctx.createRadialGradient(lx, ly, 4, lx, ly, s * 0.28)
  key.addColorStop(0, 'rgba(255, 220, 180, 0.28)')
  key.addColorStop(1, 'rgba(255, 220, 180, 0)')
  ctx.fillStyle = key
  ctx.fillRect(0, 0, w, h)

  // Painterly strokes around edges
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + t * 0.15
    ctx.strokeStyle = i % 2 === 0 ? '#a89070' : '#5a6a70'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * s * 0.22, cy + Math.sin(ang) * s * 0.26)
    ctx.lineTo(cx + Math.cos(ang) * s * 0.34, cy + Math.sin(ang) * s * 0.38)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawStoneMonument({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#6a8494', '#c4b49a')

  // Cloud drift
  for (let i = 0; i < 5; i++) {
    const x = ((t * 12 + i * 90) % (w + 120)) - 60
    const y = h * (0.12 + (i % 3) * 0.08)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.beginPath()
    ctx.ellipse(x, y, 50 + i * 8, 18, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ground
  ctx.fillStyle = '#4a5340'
  ctx.fillRect(0, h * 0.78, w, h * 0.22)

  const baseY = h * 0.78
  const cx = w * 0.5
  const sway = Math.sin(t * 0.4) * 2

  // Platform
  ctx.fillStyle = '#8a8578'
  ctx.fillRect(cx - w * 0.28, baseY - 16, w * 0.56, 20)

  // Columns
  const cols = 4
  for (let i = 0; i < cols; i++) {
    const x = cx - w * 0.2 + (i / (cols - 1)) * w * 0.4 + sway * 0.3
    ctx.fillStyle = '#b8b0a0'
    ctx.fillRect(x - 10, baseY - h * 0.42, 20, h * 0.42)
    ctx.fillStyle = '#d0c8b8'
    ctx.fillRect(x - 14, baseY - h * 0.44, 28, 12)
    ctx.fillRect(x - 14, baseY - 18, 28, 10)
  }

  // Arch / pediment
  ctx.fillStyle = '#cfc6b4'
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.24, baseY - h * 0.44)
  ctx.lineTo(cx, baseY - h * 0.56 + Math.sin(t * 0.5) * 2)
  ctx.lineTo(cx + w * 0.24, baseY - h * 0.44)
  ctx.closePath()
  ctx.fill()

  // Soft sun flare (secular daylight, not a halo on a figure)
  const sunX = w * 0.78 + Math.sin(t * 0.3) * 10
  const sunY = h * 0.18
  const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 80)
  sun.addColorStop(0, 'rgba(255, 230, 180, 0.55)')
  sun.addColorStop(1, 'rgba(255, 230, 180, 0)')
  ctx.fillStyle = sun
  ctx.beginPath()
  ctx.arc(sunX, sunY, 80, 0, Math.PI * 2)
  ctx.fill()
}

function drawBridgeDawn({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#1c2a3a', '#e07a3d')

  // Water
  const waterTop = h * 0.62
  const water = ctx.createLinearGradient(0, waterTop, 0, h)
  water.addColorStop(0, '#1a3a48')
  water.addColorStop(1, '#0e2228')
  ctx.fillStyle = water
  ctx.fillRect(0, waterTop, w, h - waterTop)

  // Ripples
  ctx.strokeStyle = 'rgba(180, 220, 220, 0.2)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 8; i++) {
    const y = waterTop + 20 + i * 18 + Math.sin(t * 1.2 + i) * 3
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.7, y - 6, w, y)
    ctx.stroke()
  }

  // Bridge deck
  const deckY = h * 0.48 + Math.sin(t * 0.5) * 2
  ctx.fillStyle = '#2a3038'
  ctx.fillRect(0, deckY, w, 14)

  // Towers
  const towerW = w * 0.06
  for (const tx of [w * 0.28, w * 0.72]) {
    ctx.fillStyle = '#3a4250'
    ctx.fillRect(tx - towerW / 2, deckY - h * 0.28, towerW, h * 0.28)
    ctx.fillStyle = '#4a5568'
    ctx.fillRect(tx - towerW * 0.7, deckY - h * 0.3, towerW * 1.4, 12)
  }

  // Cables
  ctx.strokeStyle = 'rgba(220, 230, 240, 0.55)'
  ctx.lineWidth = 2
  for (let i = 0; i < 10; i++) {
    const x0 = w * 0.28
    const x1 = w * (0.32 + i * 0.035)
    ctx.beginPath()
    ctx.moveTo(x0, deckY - h * 0.26)
    ctx.quadraticCurveTo((x0 + x1) / 2, deckY - h * 0.08, x1, deckY)
    ctx.stroke()
    const x2 = w * 0.72
    const x3 = w * (0.68 - i * 0.035)
    ctx.beginPath()
    ctx.moveTo(x2, deckY - h * 0.26)
    ctx.quadraticCurveTo((x2 + x3) / 2, deckY - h * 0.08, x3, deckY)
    ctx.stroke()
  }

  // Traffic lights crawling across
  for (let i = 0; i < 6; i++) {
    const x = ((t * 40 + i * 70) % (w + 40)) - 20
    ctx.fillStyle = i % 2 === 0 ? '#e07a3d' : '#f0e0c0'
    ctx.beginPath()
    ctx.arc(x, deckY + 6, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawTheme(id: ThemeId, ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const args = { ctx, w, h, t }
  switch (id) {
    case 'midnight-drive':
      drawMidnightDrive(args)
      break
    case 'studio-portrait':
      drawStudioPortrait(args)
      break
    case 'stone-monument':
      drawStoneMonument(args)
      break
    case 'bridge-dawn':
      drawBridgeDawn(args)
      break
  }
}
