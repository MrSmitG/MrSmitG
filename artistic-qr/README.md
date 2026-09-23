# VEIL — an image that acts like a QR

Not a decorated QR code. **The picture itself carries the message.**

Subjects are limited to **cars, portraits, and secular monuments** — no idols, gods, or religious figures.

## How

1. Pick a theme (Midnight Drive, Studio Portrait, Stone Monument, Bridge at Dawn)
2. Enter a URL or message
3. VEIL embeds it into pixel LSBs (invisible steganography)
4. Download a PNG, or hit **Scan this frame**
5. Later: **Scan PNG / explicitly lossless WebP** to unlock the same message

Phone camera QR apps will **not** read these images — that’s intentional.

## Run

```bash
cd artistic-qr
npm install
npm run dev
```

## Important

- Save / share as **PNG** (or WebP encoded explicitly in lossless mode)
- Screenshots, JPEG recompression, and lossy WebP encoding destroy the hidden bits
- Keep messages under ~2KB

## Layout

```
src/
  App.tsx           UI + live canvas
  lib/stego.ts      Invisible embed / extract
  lib/themes.ts     Car / portrait / monument themes
```
