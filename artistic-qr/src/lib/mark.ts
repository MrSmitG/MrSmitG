/** A subtle, tasteful VEIL mark so people know an image is scannable in VEIL. */

/**
 * Draw a small corner emblem onto the art context. Must be called BEFORE
 * embedding the payload so the hidden bits are written over the final pixels.
 */
export function drawVeilMark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  const s = Math.min(w, h)
  const pad = s * 0.045
  const x = w - pad
  const y = h - pad
  const r = s * 0.028

  ctx.save()

  // Soft backing so the mark stays legible on any scene
  const backing = ctx.createRadialGradient(x, y, 1, x, y, r * 2.6)
  backing.addColorStop(0, 'rgba(8, 12, 11, 0.45)')
  backing.addColorStop(1, 'rgba(8, 12, 11, 0)')
  ctx.fillStyle = backing
  ctx.beginPath()
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2)
  ctx.fill()

  // Rotating ring — signals "living / encoded"
  const pulse = 0.6 + (Math.sin(t * 2) + 1) * 0.2
  ctx.strokeStyle = `rgba(224, 122, 61, ${pulse})`
  ctx.lineWidth = Math.max(1.5, s * 0.004)
  ctx.beginPath()
  ctx.arc(x, y, r, t % (Math.PI * 2), (t % (Math.PI * 2)) + Math.PI * 1.5)
  ctx.stroke()

  // Inner dot
  ctx.fillStyle = `rgba(126, 200, 192, ${pulse})`
  ctx.beginPath()
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2)
  ctx.fill()

  // "VEIL" wordmark to the left of the emblem
  ctx.font = `600 ${Math.floor(s * 0.026)}px "Sora", system-ui, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(245, 239, 230, 0.82)'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 4
  ctx.fillText('VEIL', x - r * 1.7, y)

  ctx.restore()
}
