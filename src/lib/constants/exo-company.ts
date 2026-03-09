/**
 * EXO company dates and tax-related constants.
 */

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
