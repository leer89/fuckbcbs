import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
