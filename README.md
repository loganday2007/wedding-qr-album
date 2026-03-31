# Wedding QR Album (Self-Hosted, Scalable)

This project is a self-owned wedding upload system modeled after apps like Wedibox/Guestpix, but it runs on your own storage.

Guests scan a QR code, upload photos/videos, and you download original files later from your bucket.

## Why this version

- No dependency on wedding upload apps
- Scales to very large albums (limited by your storage budget, not app caps)
- Original file quality preserved
- Host dashboard protected by access code
- One-click ZIP export for iCloud Photos import

## Project files

- `index.html` guest upload page
- `host.html` host-only dashboard (lists uploads + download originals)
- `qr.html` QR generator
- `poster.html` printable QR sign
- `admin.html` admin controls (edit all words/buttons/colors)
- `ui-customizer.js` shared customization engine
- `wedding-config.js` frontend settings
- `server.js` API + static server
- `.env.example` backend secrets template

## Storage provider options (best for "as many as you want")

Use any S3-compatible bucket:

1. Cloudflare R2 (often best egress economics)
2. Backblaze B2 S3 API (very simple pay-as-you-go)
3. AWS S3 (most mature ecosystem)

This app supports all three via environment variables.

## 1) Create bucket + API credentials

Create:

- One bucket (for example `wedding-media`)
- One API key with read/write for that bucket

Keep key/secret private.

## 2) Configure backend env

Copy `.env.example` to `.env` and fill values:

- `EVENT_SLUG` album path prefix (example `alex-and-jordan-2026`)
- `HOST_ACCESS_CODE` password for host dashboard
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` for R2/B2 (leave empty for AWS S3)
- `S3_REGION` (`auto` for R2 is common)

## 3) Configure frontend

Edit `wedding-config.js`:

- `apiBaseUrl`: `""` if same domain as server
- `eventSlug`: should match backend event slug convention
- `guestUploadUrl`: final public guest URL (for QR/poster)
- `coupleNames`, `welcomeMessage`: optional branding

## 4) Run locally

```bash
npm install
npm run dev
```

Open:

- `http://localhost:8787/index.html`
- `http://localhost:8787/host.html`
- `http://localhost:8787/qr.html`
- `http://localhost:8787/poster.html`
- `http://localhost:8787/admin.html`

## 5) Deploy

Deploy as a Node web service (Render, Railway, Fly.io, VPS, etc.).

Requirements:

- Node 18+
- `npm install`
- start command: `npm start`
- set all `.env` variables in platform secrets

## 6) Wedding-day flow

1. Set `guestUploadUrl` to deployed `index.html` URL.
2. Optional: open `admin.html` and customize all text/buttons/colors.
3. Open `qr.html` and generate QR PNG.
4. Print `poster.html` and place at venue.
5. Guests upload from phones.
6. Open `host.html`, enter host access code.
7. Click `Export ZIP for iCloud` to download all originals at once.
8. Unzip and import into iCloud Photos.

## Operational notes

- "Unlimited" means practical scale based on your storage/transfer budget.
- Large videos depend on guest network quality.
- `MAX_UPLOAD_MB` controls per-file size cap.
- For very large events, consider lifecycle rules after backup.
