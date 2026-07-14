import QRCode from 'qrcode'

export type QrMatrix = {
  size: number
  modules: boolean[][]
}

/** Build a QR module grid with high error correction for artistic freedom. */
export function createQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const size = qr.modules.size
  const modules: boolean[][] = []

  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) {
      // BitMatrix.get(row, col) returns 1 for dark modules
      row.push(qr.modules.get(y, x) === 1)
    }
    modules.push(row)
  }

  return { size, modules }
}

/** Finder + timing patterns need stronger contrast to stay reliably scannable. */
export function isProtectedModule(x: number, y: number, size: number): boolean {
  const inFinder = (ox: number, oy: number) =>
    x >= ox && x < ox + 8 && y >= oy && y < oy + 8

  if (inFinder(0, 0) || inFinder(size - 8, 0) || inFinder(0, size - 8)) {
    return true
  }

  // Timing patterns
  if (x === 6 || y === 6) return true

  return false
}
