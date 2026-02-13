import { VAT_PERCENTAGE } from "@/lib/constants";

export function parseNumeric(value: string | null | undefined): number {
  if (!value) return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

/** Calculate total from invoice line items (same logic as InvoicesTable Total column, for reimbursements) */
export function calculateTotalFromLineItems(
  lineItems: Array<{
    quantity: string | number;
    unitPrice: string | number;
    taxPercentage: string | number;
  }>
): number {
  return lineItems.reduce((sum, item) => {
    const quantity = parseFloat(String(item.quantity)) || 0;
    const unitPrice = parseFloat(String(item.unitPrice)) || 0;
    const taxPercentage = parseFloat(String(item.taxPercentage)) || 0;
    const subtotal = quantity * unitPrice;
    const tax = subtotal * (taxPercentage / 100);
    return sum + subtotal + tax;
  }, 0);
}

export function formatCurrency(
  amount: number,
  currency: string = "EUR"
): string {
  const symbol = currency === "USD" ? "$" : "€";
  const space = currency === "EUR" ? " " : "";
  return `${symbol}${space}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact format for chart axes: no decimals when value >= 1000 to prevent label wrapping */
export function formatCurrencyCompact(
  amount: number,
  currency: string = "EUR"
): string {
  const symbol = currency === "USD" ? "$" : "€";
  const space = currency === "EUR" ? " " : "";
  const fractionDigits = Math.abs(amount) >= 1000 ? 0 : 2;
  return `${symbol}${space}${amount.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function calculateVAT(
  subtotal: string | null | undefined,
  currency: string = "EUR"
): string {
  const subtotalValue = parseNumeric(subtotal);
  const vat = subtotalValue * (VAT_PERCENTAGE / 100);
  return formatCurrency(vat, currency);
}

export function calculateTotal(
  subtotal: string | null | undefined,
  currency: string = "EUR"
): string {
  const subtotalValue = parseNumeric(subtotal);
  const vat = subtotalValue * (VAT_PERCENTAGE / 100);
  const total = subtotalValue + vat;
  return formatCurrency(total, currency);
}

export function calculatePaymentAmount(
  subtotal: string | null | undefined,
  stage: string | null | undefined,
  currency: string = "EUR"
): string | null {
  const symbol = currency === "USD" ? "$" : "€";
  if (!subtotal) return `${symbol}0`;
  const subtotalValue = parseNumeric(subtotal);
  const total = subtotalValue * (1 + VAT_PERCENTAGE / 100);

  // Payment amount depends on the project stage
  switch (stage) {
    case "pay_first":
      // First payment is 50% of total
      return formatCurrency(total * 0.5, currency);
    case "pay_final":
      // Final payment is 50% of total
      return formatCurrency(total * 0.5, currency);
    case "completed":
      // Payment is complete, return null to indicate special handling
      return null;
    default:
      // For other stages, show 0
      return `${symbol}0`;
  }
}
