# VEIL — an image that acts like a QR

Not a decorated QR code. **The picture itself carries the message.**

You see a painting or a car flying through space. Someone else opens that image in VEIL and unlocks the hidden URL/text. There is no scannable black grid.

## How

1. Pick art + motion theme
2. Enter a URL or message
3. VEIL embeds it into pixel LSBs (invisible steganography)
4. Download a PNG, or hit **Scan this frame**
5. Later: **Scan a PNG** to unlock the same message

Phone camera QR apps will **not** read these images — that’s intentional. The image isn’t a QR; it only behaves like one inside VEIL.

## Run

```bash
cd artistic-qr
npm install
npm run dev
```

## Important

- Save / share as **PNG** (or lossless WebP)
- Screenshots and JPEG recompression strip the hidden bits
- Keep messages under ~2KB

## Layout

```
src/
  App.tsx           UI + live canvas
  lib/stego.ts      Invisible embed / extract
  lib/themes.ts     Motion art themes
```
