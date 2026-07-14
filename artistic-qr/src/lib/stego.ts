/** Invisible payload embed/extract — the picture carries the data, no QR grid. */

const MAGIC = [0x56, 0x45, 0x49, 0x4c] // VEIL
const MAX_PAYLOAD_BYTES = 2048

function checksum(bytes: Uint8Array): number {
  let sum = 0x5a5a
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i] * ((i % 7) + 1)) & 0xffff
  }
  return sum
}

function buildPacket(text: string): Uint8Array {
  const encoder = new TextEncoder()
  const body = encoder.encode(text)
  if (body.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`Message too long (max ${MAX_PAYLOAD_BYTES} bytes)`)
  }

  const packet = new Uint8Array(4 + 2 + body.length + 2)
  packet.set(MAGIC, 0)
  packet[4] = (body.length >> 8) & 0xff
  packet[5] = body.length & 0xff
  packet.set(body, 6)
  const cs = checksum(body)
  packet[6 + body.length] = (cs >> 8) & 0xff
  packet[6 + body.length + 1] = cs & 0xff
  return packet
}

/** Walk pixels in a shuffled order so the signal isn't a visible scanline. */
function pixelOrder(width: number, height: number): number[] {
  const total = width * height
  const order = new Array<number>(total)
  for (let i = 0; i < total; i++) order[i] = i

  let state = 0xc0ffee ^ (width * 73856093) ^ (height * 19349663)
  for (let i = total - 1; i > 0; i--) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const j = (state >>> 0) % (i + 1)
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  return order
}

function setBit(value: number, bit: 0 | 1): number {
  return (value & 0xfe) | bit
}

function getBit(value: number): 0 | 1 {
  return (value & 1) as 0 | 1
}

function readBitAt(data: Uint8ClampedArray, order: number[], absBit: number): 0 | 1 {
  const pix = order[Math.floor(absBit / 3)]
  const channel = absBit % 3
  return getBit(data[pix * 4 + channel])
}

/**
 * Hide `text` inside image pixels by tweaking the least-significant bit of RGB.
 * Invisible to the eye; VEIL's scanner recovers it.
 */
export function embedPayload(imageData: ImageData, text: string): ImageData {
  const packet = buildPacket(text)
  const { width, height, data } = imageData
  const out = new ImageData(new Uint8ClampedArray(data), width, height)
  const pixels = out.data
  const order = pixelOrder(width, height)

  const bitsNeeded = packet.length * 8
  const capacity = order.length * 3
  if (bitsNeeded > capacity) {
    throw new Error('Image too small for this message')
  }

  for (let bitIndex = 0; bitIndex < bitsNeeded; bitIndex++) {
    const byteIndex = bitIndex >> 3
    const shift = 7 - (bitIndex & 7)
    const bit = ((packet[byteIndex] >> shift) & 1) as 0 | 1
    const pix = order[Math.floor(bitIndex / 3)]
    const channel = bitIndex % 3
    const i = pix * 4 + channel
    pixels[i] = setBit(pixels[i], bit)
  }

  return out
}

/** Recover a VEIL payload from an image, or null if none / corrupted. */
export function extractPayload(imageData: ImageData): string | null {
  const { width, height, data } = imageData
  const order = pixelOrder(width, height)
  const capacity = order.length * 3

  if (capacity < 48) return null

  const header = new Uint8Array(6)
  for (let i = 0; i < 48; i++) {
    const bit = readBitAt(data, order, i)
    const byteIndex = i >> 3
    const shift = 7 - (i & 7)
    header[byteIndex] |= bit << shift
  }

  for (let i = 0; i < 4; i++) {
    if (header[i] !== MAGIC[i]) return null
  }

  const length = (header[4] << 8) | header[5]
  if (length <= 0 || length > MAX_PAYLOAD_BYTES) return null

  const totalBits = (6 + length + 2) * 8
  if (totalBits > capacity) return null

  const packet = new Uint8Array(6 + length + 2)
  for (let i = 0; i < totalBits; i++) {
    const bit = readBitAt(data, order, i)
    const byteIndex = i >> 3
    const shift = 7 - (i & 7)
    packet[byteIndex] |= bit << shift
  }

  const body = packet.slice(6, 6 + length)
  const expected = (packet[6 + length] << 8) | packet[6 + length + 1]
  if (checksum(body) !== expected) return null

  try {
    return new TextDecoder().decode(body)
  } catch {
    return null
  }
}
