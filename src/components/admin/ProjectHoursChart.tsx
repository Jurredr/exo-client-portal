"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProjectData {
  project: {
    id: string;
    title: string;
  };
  totalHours?: number;
}

const chartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

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

export function ProjectHoursChart() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"hours" | "name">("hours");
  const [limit, setLimit] = useState(10);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setLimit(5);
    }
  }, [isMobile]);

  useEffect(() => {
    fetchProjects();

    // Listen for hour registration saved events to refresh
    const handleRefresh = () => {
      fetchProjects();
    };
    window.addEventListener("hour-registration-saved", handleRefresh);
    return () =>
      window.removeEventListener("hour-registration-saved", handleRefresh);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = () => {
    // Filter projects with hours and sort
    const projectsWithHours = projects
      .filter((p) => (p.totalHours || 0) > 0)
      .sort((a, b) => {
        if (sortBy === "hours") {
          return (b.totalHours || 0) - (a.totalHours || 0);
        }
        return a.project.title.localeCompare(b.project.title);
      })
      .slice(0, limit);

    return projectsWithHours.map((p) => ({
      project: p.project.title,
      hours: p.totalHours || 0,
    }));
  };

  const chartData = generateChartData();
  const totalHours = chartData.reduce((sum, item) => sum + item.hours, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hours by Project</CardTitle>
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
        <CardTitle>Hours by Project</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total: {formatHours(totalHours)} across top {limit} projects
          </span>
          <span className="@[540px]/card:hidden">
            {formatHours(totalHours)} hours
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={sortBy}
            onValueChange={(value) =>
              value && setSortBy(value as "hours" | "name")
            }
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="hours">Sort by Hours</ToggleGroupItem>
            <ToggleGroupItem value="name">Sort by Name</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={`${limit}`}
            onValueChange={(value) => setLimit(Number(value))}
          >
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select limit"
            >
              <SelectValue placeholder="Top 10" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="5" className="rounded-lg">
                Top 5
              </SelectItem>
              <SelectItem value="10" className="rounded-lg">
                Top 10
              </SelectItem>
              <SelectItem value="20" className="rounded-lg">
                Top 20
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-muted-foreground">No hours registered yet</div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="project"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={120}
                tickFormatter={(value) => {
                  // Truncate long project names
                  return value.length > 20 ? value.slice(0, 20) + "..." : value;
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatHours(Number(value))}
                    indicator="dot"
                  />
                }
              />
              <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
