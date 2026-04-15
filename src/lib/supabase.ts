import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Always call this inside a function — never at module level. */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}

export type SubmissionInsert = {
  enrollee_id: string;
  enrollee_name: string;
  patient_name: string;
  patient_dob: string | null;
  address: string;
  city: string;
  state_zip: string;
  claim_description: string;
  signature_data: string | null;
  signature_date: string | null;
};
