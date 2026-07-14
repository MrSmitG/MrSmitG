import { isProtectedModule, type QrMatrix } from './qr'

export type EngraveOptions = {
  /** 0 = almost invisible art blend, 1 = strong QR contrast */
  strength: number
  quietZoneModules?: number
}

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, n))
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Engrave a QR matrix into image pixels by nudging luminance per module.
 * Hue/texture of the art stay; only brightness is biased so scanners still read it.
 */
export function engraveQrIntoImageData(
  imageData: ImageData,
  matrix: QrMatrix,
  options: EngraveOptions,
): ImageData {
  const { strength, quietZoneModules = 2 } = options
  const { width, height, data } = imageData
  const out = new ImageData(new Uint8ClampedArray(data), width, height)
  const pixels = out.data

  const totalModules = matrix.size + quietZoneModules * 2
  const moduleW = width / totalModules
  const moduleH = height / totalModules

  const darkTarget = 55 + (1 - strength) * 45
  const lightTarget = 200 - (1 - strength) * 40

  for (let my = 0; my < matrix.size; my++) {
    for (let mx = 0; mx < matrix.size; mx++) {
      const dark = matrix.modules[my][mx]
      const protected_ = isProtectedModule(mx, my, matrix.size)
      const localStrength = protected_ ? Math.min(1, strength + 0.35) : strength
      const target = dark ? darkTarget : lightTarget

      const x0 = Math.floor((mx + quietZoneModules) * moduleW)
      const y0 = Math.floor((my + quietZoneModules) * moduleH)
      const x1 = Math.floor((mx + quietZoneModules + 1) * moduleW)
      const y1 = Math.floor((my + quietZoneModules + 1) * moduleH)

      // Soft inset so module edges feel carved, not stamped as a grid
      const insetX = Math.max(0, Math.floor((x1 - x0) * 0.08))
      const insetY = Math.max(0, Math.floor((y1 - y0) * 0.08))

      for (let y = y0 + insetY; y < y1 - insetY; y++) {
        for (let x = x0 + insetX; x < x1 - insetX; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue
          const i = (y * width + x) * 4
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const lum = luminance(r, g, b)

          // How hard we need to pull toward the target luminance
          const delta = target - lum
          const pull = Math.abs(delta) < 8 ? 0 : localStrength * 0.55 + (protected_ ? 0.2 : 0)
          if (pull <= 0) continue

          const factor = 1 + (delta / Math.max(lum, 1)) * pull
          pixels[i] = clamp(r * factor)
          pixels[i + 1] = clamp(g * factor)
          pixels[i + 2] = clamp(b * factor)

          // Extra carve: deepen shadows / lift highlights slightly
          if (dark) {
            pixels[i] = clamp(pixels[i] - 12 * localStrength)
            pixels[i + 1] = clamp(pixels[i + 1] - 10 * localStrength)
            pixels[i + 2] = clamp(pixels[i + 2] - 8 * localStrength)
          } else {
            pixels[i] = clamp(pixels[i] + 10 * localStrength)
            pixels[i + 1] = clamp(pixels[i + 1] + 10 * localStrength)
            pixels[i + 2] = clamp(pixels[i + 2] + 12 * localStrength)
          }
        }
      }
    }
  }

  return out
}
