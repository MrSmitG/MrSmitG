export interface ImageDimensions {
  width: number
  height: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function matches(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (
    bytes.length < 24 ||
    !matches(bytes, 0, PNG_SIGNATURE) ||
    view.getUint32(8) !== 13 ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR'
  ) {
    return null
  }

  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 25 ||
    String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' ||
    String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP'
  ) {
    return null
  }

  const chunk = String.fromCharCode(...bytes.subarray(12, 16))
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    }
  }

  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    }
  }

  if (
    chunk === 'VP8 ' &&
    bytes.length >= 30 &&
    matches(bytes, 23, [0x9d, 0x01, 0x2a])
  ) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    }
  }

  return null
}

/** Read dimensions from image metadata without decoding an untrusted bitmap. */
export async function readImageDimensions(file: Blob): Promise<ImageDimensions | null> {
  const bytes = new Uint8Array(await file.slice(0, 30).arrayBuffer())
  return readPngDimensions(bytes) ?? readWebpDimensions(bytes)
}

export async function hasExpectedImageDimensions(
  file: Blob,
  width: number,
  height: number,
): Promise<boolean> {
  const dimensions = await readImageDimensions(file)
  return dimensions?.width === width && dimensions.height === height
}
