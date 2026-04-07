# BCN Member Reimbursement Form — Claude Context

## What this project is
A Next.js web app that mimics the **Blue Care Network (BCN) Member Reimbursement Form** (DF 16006 JUL 16).
- Left panel: fillable form fields
- Right panel: live PDF preview (updates ~350ms after typing stops)
- Backend: Supabase (stores submissions) + Vercel (hosting)
- GitHub: https://github.com/leer89/fuckbcbs

## Tech stack
| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| PDF generation | @react-pdf/renderer v3 |
| Signature | react-signature-canvas |
| Backend | Supabase (Postgres + Storage) |
| Hosting | Vercel |
| Fax | Telnyx |
| Email | Resend |
| Bot protection | Cloudflare Turnstile |
| Rate limiting | Upstash Redis |
| Validation | Zod v4 |

---

## External accounts & services

| Service | Account email | Dashboard URL | Notes |
|---|---|---|---|
| **GitHub** | leer89 | https://github.com/leer89/fuckbcbs | Repo: fuckbcbs |
| **Vercel** | — | https://vercel.com/dashboard | Auto-deploys on push to `main` |
| **Supabase** | — | https://supabase.com/dashboard | Free tier |
| **Telnyx** | services@makotechs.com | https://app.telnyx.com | Fax connectivity, ~$0.01/fax |
| **Resend** | services@makotechs.com | https://resend.com/overview | Free tier: 3k emails/mo |
| **Cloudflare** | services@makotechs.com | https://dash.cloudflare.com | Turnstile widget only (no proxy) |
| **Upstash** | services@makotechs.com | https://console.upstash.com | Redis DB: `fuckbcbs-ratelimit` (free tier, AWS us-east-2) |

**`services@makotechs.com`** is a cPanel email created under the `makotechs.com` Bluehost hosting account. It forwards to the personal inbox. Used as the "company email" for all third-party service sign-ups.

---

## Live URL
**https://fubcbs.makotechs.com**

DNS: `fubcbs` CNAME → `2b5c2f7c83377cdb.vercel-dns-017.com` (set in Bluehost DNS for `makotechs.com`)

---

## Project setup (first time on a new machine)

### 1. Install dependencies
```bash
cd C:\Users\Administrator\Desktop\fuckyoubcbs
npm install
```

### 2. Set up Supabase
1. Log into https://supabase.com/dashboard
2. Open the project → **SQL Editor** → run `supabase/schema.sql`
3. Go to **Project Settings** → **API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (new UI name for anon key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ The "Publishable key" tab is the correct one — ignore "Secret keys" for this app

### 3. Configure environment variables
```bash
cp .env.example .env.local
```
Fill in all values — see `.env.example` for the full list.

### 4. Run locally
```bash
npm run dev
# Opens at http://localhost:3000
```

### 5. Deploy to Vercel
- Vercel is connected to GitHub — every push to `main` auto-deploys
- Add all env vars in: Vercel dashboard → Project → Settings → Environment Variables

---

## All environment variables

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → Publishable key |
| `TELNYX_API_KEY` | app.telnyx.com → API Keys |
| `TELNYX_CONNECTION_ID` | app.telnyx.com → Fax → your Fax Application ID |
| `TELNYX_FROM_NUMBER` | app.telnyx.com → your fax-capable phone number |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` for testing; verified domain for prod |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; `https://fubcbs.makotechs.com` in prod |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | dash.cloudflare.com → Turnstile → your widget → Site Key |
| `TURNSTILE_SECRET_KEY` | dash.cloudflare.com → Turnstile → your widget → Secret Key |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com → fuckbcbs-ratelimit → REST tab |
| `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com → fuckbcbs-ratelimit → REST tab (reveal with eye icon) |

---

## Fax + email pipeline

On form submit:
1. Rate limit check (Upstash — 3/IP/hour)
2. Zod validation of all fields
3. Honeypot check (silent bot rejection)
4. Turnstile server verification (Cloudflare)
5. Saves to `reimbursement_submissions` (Supabase)
6. Generates PDF server-side via `renderToBuffer`
7. Uploads PDF to `reimbursement-pdfs` Supabase Storage bucket (public)
8. Creates `fax_jobs` row
9. POSTs to Telnyx `/v2/faxes` → faxes to BCN at 1-866-637-4972
10. Sends confirmation email via Resend
11. Telnyx POSTs to `/api/fax/webhook` on delivery/failure
12. Webhook updates `fax_jobs.status` → sends follow-up email
13. Auto-retries on failure up to 3 attempts

BCN fax number is hardcoded in `src/lib/telnyx.ts` as `+18666374972`.

---

## Security layers

| Layer | Implementation | File |
|---|---|---|
| Bot protection | Cloudflare Turnstile (invisible widget) | `src/components/TurnstileWidget.tsx` + `src/lib/turnstile.ts` |
| Honeypot | Hidden off-screen input, silently drops bots | `src/components/ReimbursementForm.tsx` |
| Input validation | Zod v4 schema, all fields sanitized + length-capped | `src/app/api/submit/route.ts` |
| Rate limiting | Upstash Redis sliding window, 3/IP/hour | `src/lib/ratelimit.ts` |

---

## Key files
| File | Purpose |
|---|---|
| `src/app/page.tsx` | Root layout: manages form state + debouncing |
| `src/components/ReimbursementForm.tsx` | Left panel — all input fields, honeypot, Turnstile |
| `src/components/TurnstileWidget.tsx` | Cloudflare Turnstile React wrapper |
| `src/components/BCNPDFDocument.tsx` | `@react-pdf/renderer` Document (PDF layout) |
| `src/components/PDFPreview.tsx` | Right panel — dynamic-imports PDFViewer (no SSR) |
| `src/components/PDFViewerWrapper.tsx` | Actual PDFViewer + Download button (client-only) |
| `src/components/SignaturePad.tsx` | Canvas signature component |
| `src/app/api/submit/route.ts` | POST endpoint — full security pipeline + Supabase + fax |
| `src/app/api/fax/webhook/route.ts` | Telnyx delivery status webhook + retry logic |
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/telnyx.ts` | Telnyx fax API wrapper |
| `src/lib/email.ts` | Resend email helpers (confirmation, delivered, failed) |
| `src/lib/ratelimit.ts` | Upstash rate limiter (3/IP/hour) |
| `src/lib/turnstile.ts` | Cloudflare Turnstile server-side verifier |
| `src/types/form.ts` | `FormData` type + `initialFormData` |
| `supabase/schema.sql` | DB tables + RLS policies + storage bucket |

---

## Architecture notes

### Debouncing
`page.tsx` maintains two pieces of state:
- `formData` — updates on every keystroke (controls inputs)
- `debouncedData` — 350ms debounce of formData (fed to PDFPreview)

This keeps inputs snappy while preventing PDF re-renders on every character.

### PDF preview SSR issue
`@react-pdf/renderer`'s `PDFViewer` uses browser APIs (iframe, Blob). It must only render client-side.
Solution: `PDFPreview.tsx` uses `next/dynamic` with `ssr: false` to load `PDFViewerWrapper.tsx`.

### Signature flow
1. User draws on `<SignatureCanvas>` in `SignaturePad.tsx`
2. Clicks "Save Signature" → `toDataURL('image/png')` → stored as base64 in form state
3. Base64 string passed as `data.signatureData` to `BCNPDFDocument.tsx`
4. `<Image src={data.signatureData} />` renders the signature in the PDF

### Turnstile widget flow
1. Turnstile script loaded lazily in `layout.tsx` via `next/script`
2. `TurnstileWidget.tsx` polls for `window.turnstile` then calls `.render()`
3. On verify → token stored in `ReimbursementForm` state → submit button unlocks
4. Token sent with form POST → verified server-side in `src/lib/turnstile.ts`
5. On expire → token cleared → submit button re-locks

### Security tokens in submit flow
`ReimbursementForm` manages `turnstileToken` and `honeypot` internally (not part of `FormData` type).
They're passed up via `onSubmit(e, { turnstileToken, honeypot })` and merged into the POST body in `page.tsx`.

---

## Form sections (matching original BCN form)
- **Section 1** — Member Information: Enrollee ID, Enrollee Name, Patient Name, Patient DOB, Address, City, State/ZIP
- **Section 2** — Comments: Description/explanation of claim
- **Section 3** — Signature: canvas pad + date
- **Section 4** — Instructions (static, displayed for reference)

---

## Lessons learned
See `LESSONS_LEARNED.md` — updated whenever Claude makes a mistake that needs correcting.

## Context flattening tips
When starting a new Claude session on this project, paste this into your first message:
> "I'm working on the BCN reimbursement form project at C:\Users\Administrator\Desktop\fuckyoubcbs. Read CLAUDE.md and LESSONS_LEARNED.md before doing anything."

This ensures Claude has full context without re-reading every source file.
