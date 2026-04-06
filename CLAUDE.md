# BCN Member Reimbursement Form — Claude Context

## What this project is
A Next.js web app that mimics the **Blue Care Network (BCN) Member Reimbursement Form** (DF 16006 JUL 16).
- Left panel: fillable form fields
- Right panel: live PDF preview (updates ~350ms after typing stops)
- Backend: Supabase (stores submissions) + Vercel (hosting)
- GitHub: https://github.com/leer89/bcn-reimbursement-form *(create this repo)*

## Tech stack
| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| PDF generation | @react-pdf/renderer v3 |
| Signature | react-signature-canvas |
| Backend | Supabase (Postgres) |
| Hosting | Vercel |

## Project setup (first time)

### 1. Install dependencies
```bash
cd C:\Users\Administrator\Desktop\fuckyoubcbs
npm install
```

### 2. Set up Supabase
1. Go to https://supabase.com and create a new project
2. In the SQL Editor, run the contents of `supabase/schema.sql`
3. Copy your **Project URL** and **anon/public key** from Project Settings → API

### 3. Configure environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run locally
```bash
npm run dev
# Opens at http://localhost:3000
```

### 5. Deploy to Vercel
```bash
npm install -g vercel
vercel
```
- Add the same two env vars in Vercel dashboard → Settings → Environment Variables
- Every push to `main` auto-deploys

## Fax + email pipeline

On form submit:
1. Saves to `reimbursement_submissions` (Supabase)
2. Generates PDF server-side via `renderToBuffer`
3. Uploads PDF to `reimbursement-pdfs` Supabase Storage bucket (public)
4. Creates `fax_jobs` row
5. POSTs to Telnyx `/v2/faxes` → faxes to BCN at 1-866-637-4972
6. Sends confirmation email via Resend
7. Telnyx POSTs to `/api/fax/webhook` on delivery/failure
8. Webhook updates `fax_jobs.status` → sends follow-up email
9. Auto-retries on failure up to 3 attempts

BCN fax number is hardcoded in `src/lib/telnyx.ts` as `+18666374972`.

## Key files
| File | Purpose |
|---|---|
| `src/app/page.tsx` | Root layout: manages form state + debouncing |
| `src/components/ReimbursementForm.tsx` | Left panel — all input fields |
| `src/components/BCNPDFDocument.tsx` | The `@react-pdf/renderer` Document (PDF layout) |
| `src/components/PDFPreview.tsx` | Right panel — dynamic-imports PDFViewer (no SSR) |
| `src/components/PDFViewerWrapper.tsx` | Actual PDFViewer + Download button (client-only) |
| `src/components/SignaturePad.tsx` | Canvas signature component |
| `src/app/api/submit/route.ts` | POST endpoint → saves to Supabase |
| `src/lib/supabase.ts` | Supabase client |
| `src/types/form.ts` | `FormData` type + `initialFormData` |
| `supabase/schema.sql` | DB table + RLS policies |

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

## Form sections (matching original BCN form)
- **Section 1** — Member Information: Enrollee ID, Enrollee Name, Patient Name, Patient DOB, Address, City, State/ZIP
- **Section 2** — Comments: Description/explanation of claim
- **Section 3** — Signature: canvas pad + date
- **Section 4** — Instructions (static, displayed for reference)

## Lessons learned
See `LESSONS_LEARNED.md` — updated whenever Claude makes a mistake that needs correcting.

## Context flattening tips
When starting a new Claude session on this project, paste this into your first message:
> "I'm working on the BCN reimbursement form project at C:\Users\Administrator\Desktop\fuckyoubcbs. Read CLAUDE.md and LESSONS_LEARNED.md before doing anything."

This ensures Claude has full context without re-reading every source file.
