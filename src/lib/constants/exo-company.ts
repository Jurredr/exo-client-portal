/**
 * EXO company information and constants.
 * All EXO-specific details should be defined here and imported where needed.
 */

/** EXO company contact and registration details */
export const EXO_COMPANY = {
  name: "EXO",
  address: "Charlotte v Pallandthof 38,",
  city: "1112ZL, Diemen, Nederland",
  phone: "+31 6 13458011",
  email: "exo@jurre.me",
  website: "www.exo.black",
  kvkNumber: "90251695",
  btwNumber: "NL004799795B92",
  iban: "NL96 KNAB 0781 0679 79",
} as const;

/** EXO founded 19 May 2023 */
export const EXO_FOUNDED_DATE = new Date(2023, 4, 19); // month is 0-indexed

/** Kleine Ondernemersregeling (KOR) - EXO entered on 1 July 2024 */
export const KOR_START_DATE = new Date(2024, 6, 1);

/** KOR ended 1 April 2026 */
export const KOR_END_DATE = new Date(2026, 3, 1);

/** First year for BTW aangifte / financials (founded year) */
export const EXO_FIRST_TAX_YEAR = 2023;

/**
 * Years available in BTW aangifte and tax year dropdowns.
 * From founded year up to and including current year.
 */
export function getBTWAangifteYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = EXO_FIRST_TAX_YEAR; y <= currentYear; y++) {
    years.push(y);
  }
  return years;
}
