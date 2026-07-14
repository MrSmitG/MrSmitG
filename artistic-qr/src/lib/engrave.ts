import { isProtectedModule, type QrMatrix } from './qr'

export type EngraveOptions = {
  /** 0.35–0.95 recommended. Higher = easier scan, more visible grid. */
  strength: number
  quietZoneModules?: number
}

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, n))
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Shift RGB toward a target luminance while keeping approximate chroma. */
function setLuminance(r: number, g: number, b: number, targetLum: number) {
  const lum = Math.max(luminance(r, g, b), 1)
  const scale = targetLum / lum
  return {
    r: clamp(r * scale),
    g: clamp(g * scale),
    b: clamp(b * scale),
  }
}

/**
 * Engrave a QR matrix into image pixels by nudging luminance per module.
 * Art color/texture stays; brightness is biased so scanners can still decode.
 */
export function engraveQrIntoImageData(
  imageData: ImageData,
  matrix: QrMatrix,
  options: EngraveOptions,
): ImageData {
  const { strength, quietZoneModules = 3 } = options
  const { width, height, data } = imageData
  const out = new ImageData(new Uint8ClampedArray(data), width, height)
  const pixels = out.data

  const totalModules = matrix.size + quietZoneModules * 2
  const moduleW = width / totalModules
  const moduleH = height / totalModules

  // Quiet zone: keep borders relatively light/clean for finder lock-on
  const qzPadX = Math.ceil(quietZoneModules * moduleW)
  const qzPadY = Math.ceil(quietZoneModules * moduleH)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inQuiet =
        x < qzPadX ||
        y < qzPadY ||
        x >= width - qzPadX ||
        y >= height - qzPadY
      if (!inQuiet) continue
      const i = (y * width + x) * 4
      const lifted = setLuminance(pixels[i], pixels[i + 1], pixels[i + 2], 210)
      const mix = 0.55
      pixels[i] = clamp(pixels[i] * (1 - mix) + lifted.r * mix)
      pixels[i + 1] = clamp(pixels[i + 1] * (1 - mix) + lifted.g * mix)
      pixels[i + 2] = clamp(pixels[i + 2] * (1 - mix) + lifted.b * mix)
    }
  }

  const darkBase = 42
  const lightBase = 210

  for (let my = 0; my < matrix.size; my++) {
    for (let mx = 0; mx < matrix.size; mx++) {
      const dark = matrix.modules[my][mx]
      const protected_ = isProtectedModule(mx, my, matrix.size)
      const localStrength = protected_ ? Math.min(1, strength * 0.55 + 0.45) : strength

      const target = dark
        ? darkBase + (1 - localStrength) * 50
        : lightBase - (1 - localStrength) * 35

      const x0 = Math.floor((mx + quietZoneModules) * moduleW)
      const y0 = Math.floor((my + quietZoneModules) * moduleH)
      const x1 = Math.floor((mx + quietZoneModules + 1) * moduleW)
      const y1 = Math.floor((my + quietZoneModules + 1) * moduleH)

      // Soft inset so edges feel carved into the painting
      const insetX = protected_ ? 0 : Math.max(0, Math.floor((x1 - x0) * 0.06))
      const insetY = protected_ ? 0 : Math.max(0, Math.floor((y1 - y0) * 0.06))

      for (let y = y0 + insetY; y < y1 - insetY; y++) {
        for (let x = x0 + insetX; x < x1 - insetX; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue
          const i = (y * width + x) * 4
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]

          const shifted = setLuminance(r, g, b, target)
          const mix = protected_ ? 0.55 + localStrength * 0.4 : 0.35 + localStrength * 0.5

          pixels[i] = clamp(r * (1 - mix) + shifted.r * mix)
          pixels[i + 1] = clamp(g * (1 - mix) + shifted.g * mix)
          pixels[i + 2] = clamp(b * (1 - mix) + shifted.b * mix)
        }
      }
    }
  }

  return out
}
