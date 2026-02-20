/**
 * Dutch tax constants for ZZP / eenmanszaak (sole proprietorship).
 * Income tax (inkomstenbelasting) Box 1 - inkomen uit werk en woning.
 *
 * @see https://www.belastingdienst.nl/wps/wcm/connect/nl/werk-en-inkomen/content/hoeveel-inkomstenbelasting-betalen
 */

/** Standard VAT rate (BTW) in the Netherlands - 21% */
export const DUTCH_VAT_STANDARD_RATE = 21;

/** Reduced VAT rate - 9% (e.g. food, medicines, books) */
export const DUTCH_VAT_REDUCED_RATE = 9;

/** Zero VAT rate - 0% (e.g. exports, certain services) */
export const DUTCH_VAT_ZERO_RATE = 0;

/** Supported tax years for income tax calculations */
export const SUPPORTED_TAX_YEARS = [2025, 2026] as const;
export type TaxYear = (typeof SUPPORTED_TAX_YEARS)[number];

export function isSupportedTaxYear(year: number): year is TaxYear {
  return SUPPORTED_TAX_YEARS.includes(year as TaxYear);
}

/** Income tax bracket: [upperLimit, rateInPercent] - progressive brackets */
export interface IncomeTaxBracket {
  /** Upper limit of this bracket (inclusive). Use Infinity for top bracket */
  upperLimit: number;
  /** Tax rate in percent (e.g. 35.82) */
  rate: number;
}

/**
 * Box 1 income tax brackets (belastingschijven) per year.
 * For ZZP/eenmanszaak - before AOW age.
 * Source: Belastingdienst
 */
export const INCOME_TAX_BRACKETS: Record<TaxYear, IncomeTaxBracket[]> = {
  2025: [
    { upperLimit: 38_441, rate: 35.82 },
    { upperLimit: 76_817, rate: 37.48 },
    { upperLimit: Infinity, rate: 49.5 },
  ],
  2026: [
    { upperLimit: 38_883, rate: 35.75 },
    { upperLimit: 78_426, rate: 37.56 },
    { upperLimit: Infinity, rate: 49.5 },
  ],
};

/**
 * Get income tax brackets for a given year.
 * Falls back to latest supported year if year is not in the map.
 */
export function getIncomeTaxBrackets(year: number): IncomeTaxBracket[] {
  if (isSupportedTaxYear(year)) {
    return INCOME_TAX_BRACKETS[year];
  }
  const latest = SUPPORTED_TAX_YEARS[SUPPORTED_TAX_YEARS.length - 1];
  return INCOME_TAX_BRACKETS[latest];
}

/**
 * Calculate Dutch income tax (Box 1) on taxable profit for ZZP/eenmanszaak.
 * Uses progressive brackets - each portion of income is taxed at its bracket rate.
 *
 * @see https://www.belastingdienst.nl/wps/wcm/connect/nl/werk-en-inkomen/content/hoeveel-inkomstenbelasting-betalen
 */
export function calculateDutchIncomeTax(
  taxableProfit: number,
  year: number = new Date().getFullYear()
): number {
  if (taxableProfit <= 0) return 0;

  const brackets = getIncomeTaxBrackets(year);
  let tax = 0;
  let lowerBound = 0;

  for (const bracket of brackets) {
    if (taxableProfit <= lowerBound) break;

    const upperBound =
      bracket.upperLimit === Infinity ? taxableProfit : bracket.upperLimit;
    const taxableInBracket = Math.min(
      taxableProfit - lowerBound,
      upperBound - lowerBound
    );

    if (taxableInBracket > 0) {
      tax += taxableInBracket * (bracket.rate / 100);
    }

    lowerBound = upperBound;
    if (taxableProfit <= upperBound) break;
  }

  return tax;
}

/**
 * Categories typically associated with recurring expenses (subscriptions, SaaS, etc.)
 * Used to identify and aggregate recurring costs for financial overview.
 */
export const RECURRING_EXPENSE_CATEGORIES = [
  "software",
  "subscription",
  "saas",
  "hosting",
  "rent",
  "insurance",
  "utilities",
  "tools",
  "licenses",
  "domain",
  "maintenance",
] as const;

export type RecurringExpenseCategory =
  (typeof RECURRING_EXPENSE_CATEGORIES)[number];

export function isRecurringExpenseCategory(category: string | null): boolean {
  if (!category) return false;
  const normalized = category.toLowerCase().trim();
  return RECURRING_EXPENSE_CATEGORIES.some(
    (c) => normalized === c || normalized.includes(c)
  );
}
