import { useQuery } from "@tanstack/react-query";
import type { FinancialsStats } from "@/lib/db/queries";

export const financialsKeys = {
  all: ["financials"] as const,
  stats: (filters: { timeRange?: string; taxYear?: number }) =>
    [...financialsKeys.all, "stats", filters] as const,
};

async function fetchFinancials(
  timeRange: string = "all",
  taxYear?: number
): Promise<FinancialsStats> {
  const params = new URLSearchParams({
    timeRange,
    clientDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD for date range calculations
  });
  if (taxYear != null) params.set("taxYear", String(taxYear));
  const response = await fetch(`/api/dashboard/financials?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch financials");
  }
  return response.json();
}

export function useFinancials(timeRange: string = "all", taxYear?: number) {
  return useQuery({
    queryKey: financialsKeys.stats({ timeRange, taxYear }),
    queryFn: () => fetchFinancials(timeRange, taxYear),
    staleTime: 60 * 1000, // 60 seconds
  });
}
