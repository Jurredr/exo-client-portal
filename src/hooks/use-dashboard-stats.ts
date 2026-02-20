import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  revenue: {
    total: number;
    last30Days: number;
    change: number;
    chartData: Array<{ date: string; revenue: number }>;
  };
  hours: {
    total: number;
    thisWeek: number;
    last30Days: number;
    thisYear: number;
    change: number;
    chartData: Array<{ date: string; hours: number }>;
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    chartData: Array<{ stage: string; count: number }>;
  };
}

export const dashboardStatsKeys = {
  all: ["dashboard-stats"] as const,
  stats: (filters: { revenueTimeRange?: string; hoursTimeRange?: string }) =>
    [...dashboardStatsKeys.all, filters] as const,
};

async function fetchDashboardStats(
  revenueTimeRange: string = "year",
  hoursTimeRange: string = "30d"
): Promise<DashboardStats> {
  const params = new URLSearchParams({
    revenueTimeRange,
    hoursTimeRange,
    clientDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD for date range calculations
  });
  const response = await fetch(`/api/dashboard/stats?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard stats");
  }
  return response.json();
}

export function useDashboardStats(
  revenueTimeRange: string = "year",
  hoursTimeRange: string = "30d"
) {
  return useQuery({
    queryKey: dashboardStatsKeys.stats({ revenueTimeRange, hoursTimeRange }),
    queryFn: () => fetchDashboardStats(revenueTimeRange, hoursTimeRange),
    staleTime: 60 * 1000, // 60 seconds
  });
}
