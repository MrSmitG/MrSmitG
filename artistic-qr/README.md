# VEIL Pay — pay with art, not a QR

A UPI-style payments app (think Google Pay) where **your payment code hides inside a picture** instead of a visible black-and-white QR. Scan a VEIL image in the app to pay; share your own art so others can pay you.

## Why it's better than a plain QR wallet

- **No visible QR to skim.** Your UPI code lives inside art, so it can't be silently screenshotted off a poster and reused.
- **Signed & verified.** Every VEIL image carries a hidden `VEIL` signature — fakes read as "not found," and real ones show a **✓ VEIL verified** badge.
- **Personal.** Your receive code lives in a picture you choose (car, portrait, monument, bridge).

## The app

Mobile-first, four tabs:

- **Home** — balance card, quick actions, People (quick pay), recent activity
- **Pay** — create a private VEIL payment image, then scan it (or a PNG) to pay
- **Activity** — full transaction history with sent/received totals
- **You** — your receive image (downloadable) + why VEIL is better

Payments run through a realistic in-app sheet: **amount → UPI PIN → success → receipt**, and every payment updates your balance and history (stored in `localStorage`). Each payment also offers **Open in another UPI app** via a standard `upi://pay` deep link.

## Run

```bash
cd artistic-qr
npm install
npm run dev
```

## How the hiding works

1. The app paints live theme art on a canvas.
2. Your payload (a `upi://pay?…` link or any text) is embedded into the pixels' least-significant bits — invisible to the eye (`lib/stego.ts`).
3. Scanning reads those bits back; if it's a UPI link, the pay sheet opens.

> Demo notes: the UPI PIN and balance are simulated (front-end only). The app builds/reads UPI intent links but never moves real money or calls bank APIs. Share VEIL art as **PNG** — JPEG/screenshots destroy the hidden bits.

## Layout

```
src/
  App.tsx              App shell + tab routing
  components/
    VeilCanvas.tsx     Animated art + embed/scan
    PaySheet.tsx       Amount -> PIN -> success
    BottomNav.tsx      Tab bar
    Avatar.tsx
  screens/
    Home.tsx  PayScreen.tsx  Activity.tsx  Profile.tsx
  lib/
    stego.ts   Invisible embed / extract
    upi.ts     upi:// build / parse
    store.ts   Wallet state (balance, contacts, txns)
    mark.ts    VEIL badge  ·  themes.ts  Art themes  ·  format.ts
```
