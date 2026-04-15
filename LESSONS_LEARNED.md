# Lessons Learned

This file is updated whenever Claude makes a mistake that requires correction.
It is loaded as context at the start of new sessions to prevent repeating the same errors.

---

## Format
Each entry follows this structure:
```
## [Date] — [Short title]
**What happened:** ...
**What was wrong:** ...
**Correct approach:** ...
```

---

<!-- New lessons go below this line -->

## 2026-04-14 — react-pdf Document crashes silently on empty array children
**What happened:** Added `{(data.receipts ?? []).filter(...).map(...)}` inside `<Document>`. When receipts was empty, `.map()` returned `[]`, killing the PDFViewer (blank/black iframe, no error surfaced).
**What was wrong:** react-pdf's reconciler does not handle `[]` (empty array) as a direct child of `<Document>`. It crashes silently — the iframe goes blank and no React error boundary catches it.
**Correct approach:** Never use `{array.map(...)}` directly inside `<Document>` if the array might be empty. Always use a ternary with a `null` fallback: `{items.length > 0 ? items.map(...) : null}`. Pre-compute the filtered array outside JSX so the check is clean.

## 2026-04-14 — NEXT_PUBLIC_ env vars must be added to Vercel separately
**What happened:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` was defined in `.env.local` but missing from Vercel, causing a `TurnstileError: got "undefined"` on the deployed site.
**What was wrong:** `.env.local` is gitignored and never deployed. Vercel has its own env var store. Any `NEXT_PUBLIC_` key (baked into the client bundle at build time) must be added manually in Vercel → Project → Settings → Environment Variables, then a redeploy triggered.
**Correct approach:** After adding any new env var to `.env.local`, immediately add it to Vercel too. All vars in `.env.local` must have a matching entry in Vercel.

## 2026-04-06 — next.config.ts not supported in Next.js 14
**What happened:** Created `next.config.ts` for Next.js 14.2.15.
**What was wrong:** Next.js 14 does not support TypeScript config files. Build fails with "Configuring Next.js via 'next.config.ts' is not supported."
**Correct approach:** Use `next.config.mjs` (ESM) for Next.js 14 projects. The `.ts` extension is only supported in Next.js 15+.

## 2026-04-06 — Supabase client at module level breaks build
**What happened:** Created Supabase client at top of `route.ts` using `process.env` values.
**What was wrong:** At build time, env vars are not populated, so `createClient(undefined!, ...)` throws "supabaseUrl is required" and the build fails during "Collecting page data."
**Correct approach:** Always initialize Supabase client *inside* the handler function, not at module level.

## 2026-04-06 — Zod v4 uses .issues not .errors on ZodError
**What happened:** Used `err.errors.map(...)` to extract Zod validation messages.
**What was wrong:** Zod v4 renamed the property from `.errors` to `.issues`. TypeScript correctly rejects `.errors`.
**Correct approach:** Use `err.issues.map((e) => e.message)` when catching `ZodError` in Zod v4+.

## 2026-04-06 — BCNPDFDocument must not have 'use client' directive
**What happened:** Added `'use client'` to BCNPDFDocument.tsx.
**What was wrong:** Server-side PDF generation via `renderToBuffer` in API routes requires the Document component to be importable server-side. `'use client'` prevents that.
**Correct approach:** `@react-pdf/renderer` Document/Page/Text/View/Image components work fine on both server and client. No `'use client'` needed on BCNPDFDocument.

## 2026-04-06 — renderToBuffer type mismatch with wrapper components
**What happened:** Passed `createElement(BCNPDFDocument, props)` to `renderToBuffer`.
**What was wrong:** TypeScript expects `ReactElement<DocumentProps>` but our wrapper component's props are `BCNPDFDocumentProps`. TS rejects the mismatch even though the runtime value is valid.
**Correct approach:** Cast with `as any` — `renderToBuffer(createElement(BCNPDFDocument, props) as any)`.

## 2026-04-06 — PDFDownloadLink in @react-pdf/renderer v3 does not accept render props
**What happened:** Used `{({ loading }) => <span>...</span>}` as children of `PDFDownloadLink`.
**What was wrong:** In v3, `PDFDownloadLink` types `children` as `ReactNode`, not a render function. TypeScript rejects the function signature.
**Correct approach:** Use `BlobProvider` (which does accept a render function) to generate the URL, then render an `<a>` tag manually with `href={url}` and `download` attribute.
