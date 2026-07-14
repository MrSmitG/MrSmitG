import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { embedPayload, extractPayload } from '../lib/stego'
import { drawVeilMark } from '../lib/mark'
import { drawTheme, type ThemeId } from '../lib/themes'

export type VeilCanvasHandle = {
  getDataUrl: () => string
  scan: () => string | null
}

type Props = {
  payload: string
  theme: ThemeId
  motion?: boolean
  showMark?: boolean
  size?: number
  className?: string
}

const VeilCanvas = forwardRef<VeilCanvasHandle, Props>(function VeilCanvas(
  { payload, theme, motion = true, showMark = true, size = 512, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const artRef = useRef<HTMLCanvasElement | null>(null)
  const lastFrameRef = useRef<ImageData | null>(null)
  const payloadRef = useRef(payload)
  const themeRef = useRef(theme)
  const motionRef = useRef(motion)
  const markRef = useRef(showMark)
  const tRef = useRef(0)

  useEffect(() => {
    payloadRef.current = payload
  }, [payload])
  useEffect(() => {
    themeRef.current = theme
  }, [theme])
  useEffect(() => {
    motionRef.current = motion
  }, [motion])
  useEffect(() => {
    markRef.current = showMark
  }, [showMark])

  useImperativeHandle(ref, () => ({
    getDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? '',
    scan: () => (lastFrameRef.current ? extractPayload(lastFrameRef.current) : null),
  }))

  useEffect(() => {
    if (!artRef.current) {
      artRef.current = document.createElement('canvas')
      artRef.current.width = size
      artRef.current.height = size
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const artCtx = artRef.current.getContext('2d', { willReadFrequently: true })
    if (!ctx || !artCtx) return

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (motionRef.current) tRef.current += dt

      artCtx.clearRect(0, 0, size, size)
      drawTheme(themeRef.current, artCtx, size, size, tRef.current)
      if (markRef.current) drawVeilMark(artCtx, size, size, tRef.current)

      const raw = artCtx.getImageData(0, 0, size, size)
      try {
        const hidden = embedPayload(raw, payloadRef.current.trim() || ' ')
        ctx.putImageData(hidden, 0, 0)
        lastFrameRef.current = hidden
      } catch {
        ctx.putImageData(raw, 0, 0)
        lastFrameRef.current = raw
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={canvasRef} width={size} height={size} className={className} />
})

export default VeilCanvas
