-- BCN Member Reimbursement Form — Supabase Schema
-- Run this entire file in your Supabase SQL editor

-- ── Submissions table ──────────────────────────────────────────────────────────
create table if not exists reimbursement_submissions (
  id uuid default gen_random_uuid() primary key,
  email text not null default '',
  enrollee_name text not null default '',
  submitter_ip text,
  created_at timestamptz default now()
);

alter table reimbursement_submissions enable row level security;

create policy "Allow anonymous inserts" on reimbursement_submissions
  for insert to anon with check (true);

create policy "Allow authenticated reads" on reimbursement_submissions
  for select to authenticated using (true);

-- ── Fax jobs table ─────────────────────────────────────────────────────────────
create table if not exists fax_jobs (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid references reimbursement_submissions(id) on delete cascade,
  telnyx_fax_id text,
  status text not null default 'queued',  -- queued | sending | delivered | failed
  attempts int not null default 0,
  to_number text not null default '+18666374972',
  pdf_storage_path text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table fax_jobs enable row level security;

create policy "Allow anonymous inserts on fax_jobs" on fax_jobs
  for insert to anon with check (true);

create policy "Allow anon updates on fax_jobs" on fax_jobs
  for update to anon using (true);

create policy "Allow authenticated reads on fax_jobs" on fax_jobs
  for select to authenticated using (true);

-- ── Storage bucket for PDFs ────────────────────────────────────────────────────
-- Run this separately in the Supabase Storage UI or SQL editor:
-- 1. Go to Storage in your Supabase dashboard
-- 2. Create a new bucket named: reimbursement-pdfs
-- 3. Set it to PUBLIC (so Telnyx can fetch the PDF URL)
--
-- Or run via SQL:
insert into storage.buckets (id, name, public)
values ('reimbursement-pdfs', 'reimbursement-pdfs', true)
on conflict (id) do nothing;

create policy "Allow anon uploads to reimbursement-pdfs"
  on storage.objects for insert to anon
  with check (bucket_id = 'reimbursement-pdfs');

create policy "Allow public reads from reimbursement-pdfs"
  on storage.objects for select to anon
  using (bucket_id = 'reimbursement-pdfs');

-- ── Storage bucket for receipt uploads ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipt-uploads', 'receipt-uploads', true)
on conflict (id) do nothing;

create policy "Allow anon uploads to receipt-uploads"
  on storage.objects for insert to anon
  with check (bucket_id = 'receipt-uploads');

create policy "Allow public reads from receipt-uploads"
  on storage.objects for select to anon
  using (bucket_id = 'receipt-uploads');
