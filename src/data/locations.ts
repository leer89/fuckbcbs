// Location → procedure codes mapping.
//
// To add a new Sparrow location:
//   1. Parse that location's CSV from https://www.uofmhealthsparrow.org/patient-resources/financial-resources/standard-charges
//   2. Save as src/data/sparrow/<location-slug>.ts with export const SPARROW_<LOCATION>_CODES
//   3. Add an entry here

import { GENERAL_URGENT_CARE_CODES } from './generalCodes';
import { SPARROW_LANSING_CODES } from './sparrow/lansing';

export const LOCATION_CODES: Record<string, readonly string[]> = {
  // General list — common urgent care CPT codes not tied to a specific facility
  'General Urgent Care Codes': GENERAL_URGENT_CARE_CODES,

  // UM Health-Sparrow locations (add new ones below as CSVs become available)
  'UM Health-Sparrow Lansing': SPARROW_LANSING_CODES,
  // 'UM Health-Sparrow Carson':            add src/data/sparrow/carson.ts    → SPARROW_CARSON_CODES
  // 'UM Health-Sparrow Clinton':           add src/data/sparrow/clinton.ts   → SPARROW_CLINTON_CODES
  // 'UM Health-Sparrow Eaton':             add src/data/sparrow/eaton.ts     → SPARROW_EATON_CODES
  // 'UM Health-Sparrow Ionia':             add src/data/sparrow/ionia.ts     → SPARROW_IONIA_CODES
  // 'UM Health-Sparrow Specialty Hospital':add src/data/sparrow/specialty.ts → SPARROW_SPECIALTY_CODES
  // 'UM Health-Sparrow St. Lawrence':      add src/data/sparrow/stlawrence.ts→ SPARROW_STLAWRENCE_CODES
};

// All location names for the dropdown
export const ALL_LOCATIONS = Object.keys(LOCATION_CODES) as string[];
