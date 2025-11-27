"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, Calendar, Target } from "lucide-react";

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

export function HourStatsCards() {
  const [registrations, setRegistrations] = useState<HourRegistration[]>([]);
  const [loading, setLoading] = useState(true);

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

  const calculateStats = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let total = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    let thisYear = 0;

    registrations.forEach((reg) => {
      const hours = parseFloat(reg.hours);
      const date = new Date(reg.date);

      total += hours;
      if (date >= startOfYear) thisYear += hours;
      if (date >= startOfMonth) thisMonth += hours;
      if (date >= startOfWeek) thisWeek += hours;
    });

    return { total, thisWeek, thisMonth, thisYear };
  };

  const stats = calculateStats();

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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatHours(stats.total)}</div>
          <p className="text-xs text-muted-foreground">All time</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Year</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatHours(stats.thisYear)}</div>
          <p className="text-xs text-muted-foreground">
            Since {new Date().getFullYear()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatHours(stats.thisMonth)}</div>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleString("default", { month: "long" })}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatHours(stats.thisWeek)}</div>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </CardContent>
      </Card>
    </div>
  );
}

