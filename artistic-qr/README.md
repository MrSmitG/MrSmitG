# VEIL — an image that acts like a QR

Not a decorated QR code. **The picture itself carries the message.**

Subjects are limited to **cars, portraits, and secular monuments** — no idols, gods, or religious figures.

## How

1. Pick a theme (Midnight Drive, Studio Portrait, Stone Monument, Bridge at Dawn)
2. Choose **Link / Text** or **UPI Payment**
3. Enter your link, or the payee name + UPI ID + amount
4. VEIL embeds it into pixel LSBs (invisible steganography)
5. Download a PNG, or hit **Scan this frame**
6. Later: **Scan a PNG** to unlock it

Phone camera QR apps will **not** read these images — that’s intentional.

## UPI payments

In **UPI Payment** mode, VEIL hides a standard `upi://pay?pa=…&pn=…&am=…` link inside the art.
When scanned in VEIL, it shows a payment card (payee, UPI ID, amount, note) with a **Pay with UPI
app** button. On a phone, that button opens GPay / PhonePe / Paytm / any UPI app with the details
pre-filled — the user just confirms.

> The app builds and reads UPI intent links; it never touches money or bank APIs itself.

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
  lib/upi.ts        UPI deep-link build / parse
  lib/mark.ts       VEIL corner badge
  lib/themes.ts     Car / portrait / monument themes
```
