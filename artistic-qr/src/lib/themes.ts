export type ThemeId = 'space-cruise' | 'oil-canvas' | 'neon-rain' | 'coral-reef'

export type ThemeMeta = {
  id: ThemeId
  name: string
  blurb: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'space-cruise',
    name: 'Cosmic Cruise',
    blurb: 'A car cutting through starfields and nebulae',
  },
  {
    id: 'oil-canvas',
    name: 'Oil Canvas',
    blurb: 'Thick brush strokes like a small painting',
  },
  {
    id: 'neon-rain',
    name: 'Neon Rain',
    blurb: 'Wet city night with streaking light',
  },
  {
    id: 'coral-reef',
    name: 'Coral Drift',
    blurb: 'Soft underwater light and drifting shapes',
  },
]

type DrawCtx = {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  t: number // seconds
}

function fillSky(ctx: CanvasRenderingContext2D, w: number, h: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function stars({ ctx, w, h, t }: DrawCtx, count = 120) {
  for (let i = 0; i < count; i++) {
    const seed = i * 9973
    const x = ((seed * 13) % w) + Math.sin(t * 0.2 + i) * 8
    const y = ((seed * 29) % h) + ((t * (20 + (i % 40))) % h)
    const yy = ((y % h) + h) % h
    const a = 0.35 + (Math.sin(t * 3 + i) + 1) * 0.3
    ctx.fillStyle = `rgba(255,245,220,${a})`
    ctx.fillRect(x % w, yy, 1.5 + (i % 3) * 0.5, 1.5 + (i % 3) * 0.5)
  }
}

function drawCar({ ctx, w, h, t }: DrawCtx) {
  const cx = w * 0.5 + Math.sin(t * 0.8) * w * 0.08
  const cy = h * 0.58 + Math.sin(t * 1.4) * h * 0.03
  const scale = Math.min(w, h) * 0.0011

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.rotate(Math.sin(t * 0.6) * 0.05)

  // Exhaust glow
  const glow = ctx.createRadialGradient(-80, 10, 2, -80, 10, 90)
  glow.addColorStop(0, 'rgba(255,160,60,0.7)')
  glow.addColorStop(1, 'rgba(255,80,20,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(-90, 12, 90, 28, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body
  ctx.fillStyle = '#e8d5b5'
  ctx.beginPath()
  ctx.moveTo(-70, 10)
  ctx.quadraticCurveTo(-40, -35, 20, -28)
  ctx.quadraticCurveTo(70, -18, 85, 8)
  ctx.quadraticCurveTo(90, 28, 60, 32)
  ctx.lineTo(-55, 32)
  ctx.quadraticCurveTo(-80, 28, -70, 10)
  ctx.fill()

  // Cabin glass
  ctx.fillStyle = 'rgba(90,160,200,0.55)'
  ctx.beginPath()
  ctx.moveTo(-10, -8)
  ctx.quadraticCurveTo(15, -30, 45, -12)
  ctx.lineTo(35, 2)
  ctx.lineTo(-5, 2)
  ctx.closePath()
  ctx.fill()

  // Accent stripe
  ctx.strokeStyle = '#c45c26'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-50, 14)
  ctx.lineTo(70, 10)
  ctx.stroke()

  ctx.restore()
}

function nebula({ ctx, w, h, t }: DrawCtx) {
  for (let i = 0; i < 5; i++) {
    const x = w * (0.2 + i * 0.15) + Math.sin(t * 0.3 + i) * 40
    const y = h * (0.25 + (i % 3) * 0.2) + Math.cos(t * 0.25 + i) * 30
    const r = Math.min(w, h) * (0.18 + (i % 3) * 0.06)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const hues = [
      'rgba(40,90,140,0.35)',
      'rgba(180,70,50,0.28)',
      'rgba(30,120,110,0.3)',
      'rgba(120,50,90,0.22)',
      'rgba(70,100,60,0.25)',
    ]
    g.addColorStop(0, hues[i])
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawSpaceCruise(args: DrawCtx) {
  fillSky(args.ctx, args.w, args.h, '#0b1220', '#1a0f18')
  nebula(args)
  stars(args, 160)
  // Distant planets
  const { ctx, w, h, t } = args
  ctx.beginPath()
  ctx.fillStyle = '#2a4a62'
  ctx.arc(w * 0.82, h * 0.22 + Math.sin(t * 0.4) * 6, Math.min(w, h) * 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.fillStyle = '#6b3a2a'
  ctx.arc(w * 0.15, h * 0.35, Math.min(w, h) * 0.045, 0, Math.PI * 2)
  ctx.fill()
  drawCar(args)
}

function drawOilCanvas({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#1c2a24', '#3a2c1e')

  // Impasto-like strokes
  for (let i = 0; i < 80; i++) {
    const seed = i * 173
    const x = ((seed * 17 + t * 12 * ((i % 5) - 2)) % (w + 40)) - 20
    const y = (seed * 31) % h
    const len = 40 + (i % 40)
    const ang = ((seed % 100) / 100) * Math.PI + Math.sin(t + i) * 0.2
    const colors = ['#c4a574', '#5e7a62', '#8b4518', '#d4c4a8', '#2f4f4f', '#a0522d', '#6b8e6b']
    ctx.strokeStyle = colors[i % colors.length]
    ctx.lineWidth = 6 + (i % 10)
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Soft focal bloom that drifts
  const bx = w * 0.5 + Math.sin(t * 0.5) * w * 0.15
  const by = h * 0.45 + Math.cos(t * 0.4) * h * 0.1
  const bloom = ctx.createRadialGradient(bx, by, 10, bx, by, Math.min(w, h) * 0.35)
  bloom.addColorStop(0, 'rgba(255,210,140,0.35)')
  bloom.addColorStop(1, 'rgba(255,210,140,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, w, h)
}

function drawNeonRain({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#0a0e14', '#121a22')

  // Buildings silhouettes
  for (let i = 0; i < 14; i++) {
    const bw = w / 14
    const bh = h * (0.25 + ((i * 37) % 50) / 100)
    ctx.fillStyle = i % 2 === 0 ? '#151c28' : '#0f1620'
    ctx.fillRect(i * bw, h - bh, bw + 1, bh)
    // Windows flicker
    for (let wy = 0; wy < 8; wy++) {
      if ((i + wy + Math.floor(t * 2)) % 3 === 0) {
        ctx.fillStyle = `rgba(255,${180 + (i % 40)},80,${0.35 + (Math.sin(t * 4 + i + wy) + 1) * 0.2})`
        ctx.fillRect(i * bw + bw * 0.3, h - bh + 10 + wy * 14, bw * 0.25, 6)
      }
    }
  }

  // Rain streaks
  ctx.strokeStyle = 'rgba(160,200,220,0.25)'
  ctx.lineWidth = 1
  for (let i = 0; i < 90; i++) {
    const x = ((i * 47 + t * 180) % (w + 20)) - 10
    const y = ((i * 91 + t * 420) % (h + 40)) - 20
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 4, y + 18)
    ctx.stroke()
  }

  // Neon signs
  ctx.shadowBlur = 18
  ctx.shadowColor = '#3dd6c3'
  ctx.fillStyle = '#3dd6c3'
  ctx.font = `bold ${Math.floor(w * 0.06)}px sans-serif`
  ctx.fillText('NIGHT', w * 0.12, h * 0.35 + Math.sin(t) * 4)
  ctx.shadowColor = '#e8a87c'
  ctx.fillStyle = '#e8a87c'
  ctx.fillText('DRIVE', w * 0.55, h * 0.28 + Math.cos(t * 1.2) * 4)
  ctx.shadowBlur = 0
}

function drawCoralReef({ ctx, w, h, t }: DrawCtx) {
  fillSky(ctx, w, h, '#062a32', '#0a4a4e')

  // God rays
  for (let i = 0; i < 6; i++) {
    const x = w * (0.15 + i * 0.14) + Math.sin(t * 0.3 + i) * 20
    const g = ctx.createLinearGradient(x, 0, x + 40, h)
    g.addColorStop(0, 'rgba(180,230,220,0.18)')
    g.addColorStop(1, 'rgba(180,230,220,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 50, 0)
    ctx.lineTo(x + 120, h)
    ctx.lineTo(x - 30, h)
    ctx.closePath()
    ctx.fill()
  }

  // Coral forms
  for (let i = 0; i < 12; i++) {
    const x = ((i + 0.5) / 12) * w
    const baseY = h * 0.85
    const height = h * (0.15 + (i % 5) * 0.06)
    const sway = Math.sin(t * 1.2 + i) * 12
    ctx.strokeStyle = i % 2 === 0 ? '#d97845' : '#2a9d8f'
    ctx.lineWidth = 8 + (i % 4) * 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, baseY)
    ctx.quadraticCurveTo(x + sway, baseY - height * 0.5, x + sway * 1.4, baseY - height)
    ctx.stroke()
  }

  // Bubbles
  for (let i = 0; i < 40; i++) {
    const x = ((i * 53) % w) + Math.sin(t + i) * 10
    const y = h - ((t * 40 + i * 30) % h)
    ctx.strokeStyle = 'rgba(200,240,240,0.4)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2)
    ctx.stroke()
  }
}

export function drawTheme(id: ThemeId, ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const args = { ctx, w, h, t }
  switch (id) {
    case 'space-cruise':
      drawSpaceCruise(args)
      break
    case 'oil-canvas':
      drawOilCanvas(args)
      break
    case 'neon-rain':
      drawNeonRain(args)
      break
    case 'coral-reef':
      drawCoralReef(args)
      break
  }
}
