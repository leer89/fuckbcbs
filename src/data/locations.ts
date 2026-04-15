// Location → procedure codes + NPI mapping.
//
// To add a new location:
//   1. Parse the facility's standard charges CSV
//   2. Save codes as src/data/sparrow/<slug>.ts
//   3. Add an entry here with npi (Type 2 / facility NPI) and codes
//
// NPI lookup: https://npiregistry.cms.hhs.gov/search

import { GENERAL_URGENT_CARE_CODES } from './generalCodes';
import { SPARROW_LANSING_CODES } from './sparrow/lansing';

export interface LocationEntry {
  /** Type 2 (organizational) NPI for the facility. Omit for generic code lists. */
  npi?: string;
  codes: readonly string[];
}

export const LOCATION_CODES: Record<string, LocationEntry> = {
  // ─── Lansing Urgent Care (lansingurgentcare.com) ─────────────────────────────
  // All 8 locations bill under the same organizational NPI: 1780987990
  // NPI source: NPPES NPI Registry (npiregistry.cms.hhs.gov)
  // Codes: general urgent care CPT codes (location-specific CSV not available)
  'Lansing Urgent Care - Frandor': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - Westside': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - Southside': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - Okemos': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - DeWitt': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - Haslett': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - Mason': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },
  'Lansing Urgent Care - Grand Ledge': {
    npi: '1780987990',
    codes: GENERAL_URGENT_CARE_CODES,
  },

  // ─── UM Health-Sparrow locations ─────────────────────────────────────────────
  // NPI source: standard charges CSV header (type_2_npi column)
  'UM Health-Sparrow Lansing': {
    npi: '1073588711',
    codes: SPARROW_LANSING_CODES,
  },
  // 'UM Health-Sparrow Carson':             { npi: 'TODO', codes: SPARROW_CARSON_CODES }
  // 'UM Health-Sparrow Clinton':            { npi: 'TODO', codes: SPARROW_CLINTON_CODES }
  // 'UM Health-Sparrow Eaton':              { npi: 'TODO', codes: SPARROW_EATON_CODES }
  // 'UM Health-Sparrow Ionia':              { npi: 'TODO', codes: SPARROW_IONIA_CODES }
  // 'UM Health-Sparrow Specialty Hospital': { npi: 'TODO', codes: SPARROW_SPECIALTY_CODES }
  // 'UM Health-Sparrow St. Lawrence':       { npi: '1811942436', codes: SPARROW_STLAWRENCE_CODES }
};

/** Returns the procedure codes for a location, or empty array if not found. */
export function getLocationCodes(location: string): readonly string[] {
  return LOCATION_CODES[location]?.codes ?? [];
}

/** Returns the NPI for a location, or undefined if none (e.g. generic lists). */
export function getLocationNpi(location: string): string | undefined {
  return LOCATION_CODES[location]?.npi;
}

// All location names for the dropdown
export const ALL_LOCATIONS = Object.keys(LOCATION_CODES) as string[];
