"use client";

import { useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

interface HourRegistration {
  id: string;
  userId: string;
  projectId: string | null;
  description: string;
  hours: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

const chartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function HourChart() {
  const [registrations, setRegistrations] = useState<HourRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30d");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  useEffect(() => {
    fetchRegistrations();

    // Listen for hour registration saved events
    const handleRefresh = () => {
      fetchRegistrations();
    };
    window.addEventListener("hour-registration-saved", handleRefresh);
    return () => window.removeEventListener("hour-registration-saved", handleRefresh);
  }, []);

  const fetchRegistrations = async () => {
    try {
      const response = await fetch("/api/hour-registrations");
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data);
      }
    } catch (error) {
      console.error("Error fetching hour registrations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group hours by date
  const groupByDate = () => {
    const grouped: { [key: string]: number } = {};
    registrations.forEach((reg) => {
      const date = new Date(reg.date).toISOString().split("T")[0];
      grouped[date] = (grouped[date] || 0) + parseFloat(reg.hours);
    });
    return grouped;
  };

  // Generate chart data
  const generateChartData = () => {
    const grouped = groupByDate();
    const now = new Date();
    let daysToSubtract = 30;
    if (timeRange === "90d") daysToSubtract = 90;
    else if (timeRange === "7d") daysToSubtract = 7;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    const data: { date: string; hours: number }[] = [];
    for (let i = 0; i <= daysToSubtract; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      data.push({
        date: dateStr,
        hours: grouped[dateStr] || 0,
      });
    }

    return data;
  };

  const chartData = generateChartData();
  const totalHours = chartData.reduce((sum, item) => sum + item.hours, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hours Over Time</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Hours Over Time</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total: {totalHours.toFixed(2)} hours in selected period
          </span>
          <span className="@[540px]/card:hidden">
            {totalHours.toFixed(2)} hours
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select time range"
            >
              <SelectValue placeholder="Last 30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
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
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
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
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
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
  );
}

