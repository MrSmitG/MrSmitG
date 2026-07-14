# VEIL — Art that scans

Hide a real QR code inside a small painting or motion scene. The code is **engraved into brightness**, so your eyes see art and a phone camera still reads the payload.

## Idea

Normal QR codes are loud black-and-white grids. VEIL:

1. Generates a high–error-correction QR matrix from your URL/text
2. Paints a live scene (car through space, oil canvas, neon rain, coral reef)
3. Gently darkens / lightens each module region so the pattern lives in luminance
4. Keeps corner finders a bit stronger so scanners can lock on
5. Animates the art while re-applying the engraving every frame

Scanning works with any standard QR reader (and the in-app **Scan this frame** button uses `jsQR`).

## Run

```bash
cd artistic-qr
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Tips for reliable scans

- Start around **60–70%** engrave depth, then lower for a more invisible look
- Pause **Motion** if your phone struggles mid-animation
- Prefer shorter URLs / payloads (smaller QR = larger modules = easier blend)
- Download a PNG and open it full-screen on another device to test

## Project layout

```
src/
  App.tsx           UI + live canvas loop
  lib/qr.ts         QR matrix + protected modules
  lib/engrave.ts    Luminance engraving engine
  lib/themes.ts     Procedural art themes + motion
```

## Going further

- Upload your own photo and engrave into it
- Export short WebM / GIF loops
- AI-generated backgrounds with the same luminance constraints (ControlNet / QR monster style pipelines)
