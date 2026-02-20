"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, Calendar, Target } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

// Format hours (as decimal) to "xhrs ymin" format
function formatHours(decimalHours: number) {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) {
    return "0min";
  }

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}hr${hours !== 1 ? "s" : ""}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }

  return parts.join(" ");
}

export function HourStatsCards() {
  // Use same dashboard stats API as home dashboard for consistent numbers
  const { data: stats, isLoading: loading } = useDashboardStats("year", "30d");

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const hours = stats?.hours;
  if (!hours) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatHours(hours.total)}</div>
          <p className="text-xs text-muted-foreground">All time</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Year</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatHours(hours.thisYear)}
          </div>
          <p className="text-xs text-muted-foreground">
            Since {new Date().getFullYear()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last 30 days</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatHours(hours.last30Days)}
          </div>
          <p className="text-xs text-muted-foreground">Rolling window</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatHours(hours.thisWeek)}
          </div>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </CardContent>
      </Card>
    </div>
  );
}
