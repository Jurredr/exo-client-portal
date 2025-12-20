"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Clock,
  FolderKanban,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface DashboardStatsData {
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    change: number;
    chartData: { date: string; revenue: number }[];
  };
  hours: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    change: number;
    chartData: { date: string; hours: number }[];
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    chartData: { stage: string; count: number }[];
  };
}

// Format hours (as decimal) to "xhrs ymin" format
const formatHours = (decimalHours: number) => {
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
};

const formatChange = (change: number): string => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const hoursChartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const projectsChartConfig = {
  count: {
    label: "Projects",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenueTimeRange, setRevenueTimeRange] = useState("year");
  const [hoursTimeRange, setHoursTimeRange] = useState("year");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setRevenueTimeRange("30d");
      setHoursTimeRange("7d");
    }
  }, [isMobile]);

  useEffect(() => {
    fetchStats();
  }, [revenueTimeRange, hoursTimeRange]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams({
        revenueTimeRange,
        hoursTimeRange,
      });
      const response = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 w-full">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 py-4 w-full">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Loading...
                  </dt>
                </div>
                <dd className="text-3xl font-semibold text-foreground mt-2">
                  —
                </dd>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Revenue Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 w-full">
          <Card className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Revenue
                </dt>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {formatCurrency(stats.revenue.total)}
              </dd>
            </CardContent>
          </Card>
          <Card className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenue This Month
                </dt>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium inline-flex items-center px-1.5 ps-2.5 py-0.5 text-xs",
                    stats.revenue.change >= 0
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {stats.revenue.change >= 0 ? (
                    <TrendingUp className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-green-500" />
                  ) : (
                    <TrendingDown className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-red-500" />
                  )}
                  <span className="sr-only">
                    {stats.revenue.change >= 0 ? "Increased" : "Decreased"}{" "}
                    by{" "}
                  </span>
                  {formatChange(stats.revenue.change)}
                </Badge>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {formatCurrency(stats.revenue.thisMonth)}
              </dd>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardAction>
              <ToggleGroup
                type="single"
                value={revenueTimeRange}
                onValueChange={setRevenueTimeRange}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
              >
                <ToggleGroupItem value="year">This Year</ToggleGroupItem>
                <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
                <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
                <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
              </ToggleGroup>
              <Select
                value={revenueTimeRange}
                onValueChange={setRevenueTimeRange}
              >
                <SelectTrigger
                  className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                  size="sm"
                  aria-label="Select time range"
                >
                  <SelectValue placeholder="This Year" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="year" className="rounded-lg">
                    This Year
                  </SelectItem>
                  <SelectItem value="90d" className="rounded-lg">
                    Last 3 months
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    Last 30 days
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    Last 7 days
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={revenueChartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={stats.revenue.chartData}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => value}
                      formatter={(value) => formatCurrency(Number(value))}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="natural"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hours Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 w-full">
          <Card className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Total Hours
                </dt>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {formatHours(stats.hours.total)}
              </dd>
            </CardContent>
          </Card>
          <Card className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Hours This Month
                </dt>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium inline-flex items-center px-1.5 ps-2.5 py-0.5 text-xs",
                    stats.hours.change >= 0
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {stats.hours.change >= 0 ? (
                    <TrendingUp className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-green-500" />
                  ) : (
                    <TrendingDown className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-red-500" />
                  )}
                  <span className="sr-only">
                    {stats.hours.change >= 0 ? "Increased" : "Decreased"}{" "}
                    by{" "}
                  </span>
                  {formatChange(stats.hours.change)}
                </Badge>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {formatHours(stats.hours.thisMonth)}
              </dd>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Hours Over Time</CardTitle>
            <CardAction>
              <ToggleGroup
                type="single"
                value={hoursTimeRange}
                onValueChange={setHoursTimeRange}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
              >
                <ToggleGroupItem value="year">This Year</ToggleGroupItem>
                <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
                <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
                <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
              </ToggleGroup>
              <Select value={hoursTimeRange} onValueChange={setHoursTimeRange}>
                <SelectTrigger
                  className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                  size="sm"
                  aria-label="Select time range"
                >
                  <SelectValue placeholder="This Year" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="year" className="rounded-lg">
                    This Year
                  </SelectItem>
                  <SelectItem value="90d" className="rounded-lg">
                    Last 3 months
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    Last 30 days
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    Last 7 days
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={hoursChartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={stats.hours.chartData}>
                <defs>
                  <linearGradient id="fillHours" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-hours)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-hours)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatHours(value)}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => value}
                      formatter={(value) => formatHours(Number(value))}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="hours"
                  type="natural"
                  fill="url(#fillHours)"
                  stroke="var(--color-hours)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 w-full">
          <Card className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Active Projects
                </dt>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {stats.projects.active}
              </dd>
            </CardContent>
          </Card>
          <Card className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Total Projects
                </dt>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {stats.projects.total}
              </dd>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Projects by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={projectsChartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <BarChart data={stats.projects.chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="stage"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `${value} projects`}
                      indicator="dot"
                    />
                  }
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
