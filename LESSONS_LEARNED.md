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

## 2026-04-16 — ALL env vars must be in Vercel, not just NEXT_PUBLIC_ ones
**What happened:** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were added to Vercel. The submit route also needs `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_FROM_NUMBER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Missing any of these causes a 500 on submit.
**What was wrong:** Every env var in `.env.local` has a Vercel counterpart. Forgetting server-side vars (no `NEXT_PUBLIC_` prefix) causes silent runtime crashes — they don't fail the build, they fail the request.
**Correct approach:** When adding or changing any env var, add it to Vercel immediately. Keep the full list in CLAUDE.md. After adding vars, always trigger a redeploy.

## 2026-04-16 — Submit route needs a global try/catch to surface 500 errors
**What happened:** Any unhandled throw in the submit route returned a blank 500 with no error message. Users saw "Submission failed" with no detail; logs were only visible in Vercel function logs.
**What was wrong:** No top-level error handler. A single uncaught throw anywhere in the pipeline (Supabase, renderToBuffer, pdf-lib, Telnyx) killed the response silently.
**Correct approach:** Wrap the entire POST handler body in a `try/catch` that returns `{ error: err.message }` with status 500. This surfaces the real error to the client immediately without needing to dig through Vercel logs.

## 2026-04-16 — Email failures were silently swallowed
**What happened:** `sendSubmissionConfirmation` was called fire-and-forget with `.catch(console.error)`. When Resend failed (unverified domain, wrong API key), users got no confirmation email and no indication anything was wrong.
**What was wrong:** Non-blocking fire-and-forget hides failures completely from the user. Resend requires domain verification for custom from-addresses — `noreply@makotechs.com` silently fails if `makotechs.com` isn't verified in Resend.
**Correct approach:** `await` the email send inside a try/catch. On failure, return a `warning` field in the JSON response (not an error — fax already sent) and display it in the UI. Always verify the sending domain in Resend before using a custom from-address.

## 2026-04-16 — Receipt upload hangs forever when Supabase env vars are missing
**What happened:** Clicking "Confirm & Submit" in the modal caused the app to hang on "Uploading receipts…" indefinitely with no timeout.
**What was wrong:** `getSupabaseClient()` throws `Invalid supabaseUrl` when `NEXT_PUBLIC_SUPABASE_URL` is undefined. The throw was not caught, so `setUploadingReceipts(false)` never ran and the modal stayed frozen forever.
**Correct approach:** Wrap the entire upload block in try/catch/finally. Add a 30-second per-file timeout via `Promise.race` with a timeout promise. Catch throws from `getSupabaseClient()` and display the error message in the modal.

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
**Correct approach:** Always initialize Supabase client *inside* the handler function, not at module level. For shared client code, use a lazy getter (`getSupabaseClient()`) that creates on first call. NEVER export `const supabase = createClient(...)` at module level — if any client component imports it, Next.js will run it during prerendering and crash with "Invalid supabaseUrl".

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

## 2026-04-15 — BCNPDFDocument crashes silently without explicit React import
**What happened:** PDF preview went blank with no console errors and no error boundary catch.
**What was wrong:** `BCNPDFDocument.tsx` used JSX without `import React from 'react'`. Next.js/SWC auto-injects React for JSX, masking the missing import in the browser build. But react-pdf's custom reconciler calls the component function in a CJS context where JSX compiles to `React.createElement` — `React` is not in scope, so it throws `ReferenceError: React is not defined` silently inside the reconciler. The iframe goes blank. No React error boundary catches it because the error is inside react-pdf's internal renderer.
**Correct approach:** Always add `import React from 'react'` to any component used with react-pdf's renderer (`renderToBuffer`, `PDFViewer`, `usePDF`). Also: use `usePDF` hook + manual `<iframe>` instead of `<PDFViewer>` — `usePDF` exposes errors via `instance.error`, while `PDFViewer` swallows them silently.

## 2026-04-06 — PDFDownloadLink in @react-pdf/renderer v3 does not accept render props
**What happened:** Used `{({ loading }) => <span>...</span>}` as children of `PDFDownloadLink`.
**What was wrong:** In v3, `PDFDownloadLink` types `children` as `ReactNode`, not a render function. TypeScript rejects the function signature.
**Correct approach:** Use `BlobProvider` (which does accept a render function) to generate the URL, then render an `<a>` tag manually with `href={url}` and `download` attribute.
