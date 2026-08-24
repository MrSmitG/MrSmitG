# VEIL — an image that acts like a QR

VEIL is a browser-only React demo in which **the picture itself carries the message**. It draws
animated canvas art, embeds UTF-8 text into the least-significant bits (LSBs) of its RGB channels,
and exports the encoded frame as a PNG.

It is not a decorated QR code: phone QR scanners will not recognize it. A VEIL image must be
reopened in VEIL (or passed to the extraction API) to recover its payload.

Subjects are limited to **cars, portraits, and secular monuments**—no idols, gods, or religious
figures.

## Run locally

Vite 8 requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
cd artistic-qr
npm ci
npm run dev
```

Open the URL printed by Vite. Useful checks and production commands:

```bash
npm run lint       # lint React and TypeScript
npm run build      # type-check and create dist/
npm run preview    # serve the production build locally
```

There is no backend, database, or upload service. Drawing, encoding, decoding, and downloading all
happen in the browser.

## Use the app

1. Choose Midnight Drive, Studio Portrait, Stone Monument, or Bridge at Dawn.
2. Enter a URL or message. The limit is **2,048 UTF-8 bytes**, not 2,048 characters.
3. Select **Scan this frame** to verify the current canvas.
4. Select **Download PNG** to save `veil-<theme>.png`.
5. Later, select **Scan a PNG** and choose that file to recover the message.

Keep encoded images as PNG or lossless WebP. Resizing, screenshots, image filters, metadata tools
that re-render pixels, and lossy formats such as JPEG can change the LSBs and destroy the payload.
The upload control accepts PNG and WebP; VEIL itself always downloads PNG.

> [!IMPORTANT]
> LSB steganography hides the payload visually, but it does **not** encrypt it. Anyone with a
> compatible extractor can read the message. The checksum detects corruption; it does not provide
> authentication or tamper resistance. Do not embed secrets.

## How encoding works

Each frame follows this pipeline:

1. `drawTheme` paints a 512×512 frame on an off-screen canvas.
2. `embedPayload` creates a packet containing the `VEIL` marker, two-byte payload length, UTF-8
   body, and two-byte checksum.
3. A deterministic shuffle based on image dimensions distributes packet bits across pixels.
4. One bit is written to each red, green, and blue channel; alpha is unchanged.
5. The encoded `ImageData` is displayed and retained for scanning or PNG download.

Extraction repeats the same pixel order, validates the marker, length, capacity, and checksum, then
decodes the body as UTF-8. It returns no result when any validation fails. Animation changes the
art between frames, but every rendered frame is independently encoded with the current message.

## Encoding API

`src/lib/stego.ts` exports the two browser `ImageData` helpers:

```ts
import { embedPayload, extractPayload } from './lib/stego'

const encoded = embedPayload(sourceImageData, 'https://example.com')
canvasContext.putImageData(encoded, 0, 0)

const message = extractPayload(encoded) // string | null
```

- `embedPayload(imageData, text)` returns a new `ImageData`; it does not mutate the input.
- It throws when the UTF-8 body exceeds 2,048 bytes or the source image has too few RGB channels
  for the packet.
- `extractPayload(imageData)` returns `null` for non-VEIL, truncated, empty, or corrupted packets.
- Encoding and extraction must use the same pixel dimensions because dimensions seed the pixel
  order.

The app trims whitespace before encoding and substitutes one space for an empty message. Direct API
callers should provide a non-empty string because the extractor rejects zero-length packets.

## Architecture

| Codepath | Responsibility |
| --- | --- |
| `src/App.tsx` | Canvas render loop, controls, file loading, download, and scan status |
| `src/lib/stego.ts` | Packet format, deterministic pixel order, LSB embedding, and extraction |
| `src/lib/themes.ts` | Theme metadata and canvas drawing implementations |
| `src/App.css`, `src/index.css` | Component and page styling |
| `vite.config.ts` | Vite React build configuration |

To add a theme, extend `ThemeId`, add its user-facing metadata to `THEMES`, implement a drawing
function with the `DrawCtx` inputs, and route the new ID in `drawTheme`. Keep the subject restrictions
above when adding artwork.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| **No hidden message found** after sharing | Use the original downloaded PNG. Do not resize it, take a screenshot, convert it to JPEG, or pass it through an image optimizer. |
| **Scan this frame** fails for a long message | The UI currently renders unencoded art when embedding throws. Shorten the message to at most 2,048 UTF-8 bytes; emoji and other multibyte characters consume more than one byte. |
| A phone camera does not detect a QR | Expected: the image has no QR grid. Use **Scan a PNG** in VEIL. |
| An uploaded image does not decode | Confirm it is an unmodified VEIL PNG or lossless WebP with its original dimensions. |
| Vite reports an unsupported Node version | Use Node `20.19.x` or `22.12+`, then rerun `npm ci`. |
