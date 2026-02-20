"use client";

import { useState, useEffect } from "react";
import { useFinancials } from "@/hooks/use-financials";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Receipt,
  PiggyBank,
  Calculator,
  FileText,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { Area, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  SUPPORTED_TAX_YEARS,
  getIncomeTaxBrackets,
  isSupportedTaxYear,
} from "@/lib/constants/dutch-tax";

const formatChange = (change: number): string => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

const revenueExpensesChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export default function FinancialsOverview() {
  const [timeRange, setTimeRange] = useState("all");
  const [taxYear, setTaxYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const { data: stats, isLoading } = useFinancials(timeRange, taxYear);

  useEffect(() => {
    if (isMobile) {
      queueMicrotask(() => setTimeRange("30d"));
    }
  }, [isMobile]);

  useEffect(() => {
    if (currency === "USD") {
      fetch("https://api.exchangerate-api.com/v4/latest/EUR")
        .then((res) => res.json())
        .then((data) => {
          const rate = data.rates?.USD;
          setExchangeRate(typeof rate === "number" ? rate : 1.08);
        })
        .catch(() => setExchangeRate(1.08));
    } else {
      queueMicrotask(() => setExchangeRate(null));
    }
  }, [currency]);

  const convert = (amount: number): number =>
    currency === "USD" && exchangeRate ? amount * exchangeRate : amount;

  if (isLoading || !stats) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const combinedChartData = stats.revenue.chartData.map((r, i) => ({
    date: r.date,
    revenue: r.revenue,
    expenses: stats.expenses.chartData[i]?.expenses ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Financial Overview</h2>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={currency}
              onValueChange={(v) => {
                if (v === "EUR" || v === "USD") setCurrency(v);
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="EUR">EUR</ToggleGroupItem>
              <ToggleGroupItem value="USD">USD</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
              className="hidden @[767px]:flex"
            >
              <ToggleGroupItem value="all">All Time</ToggleGroupItem>
              <ToggleGroupItem value="year">This Year</ToggleGroupItem>
              <ToggleGroupItem value="90d">90 days</ToggleGroupItem>
              <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
              <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-36 @[767px]:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {timeRange === "all"
                    ? "Revenue"
                    : timeRange === "year"
                      ? "Revenue (This year)"
                      : timeRange === "90d"
                        ? "Revenue (Last 90 days)"
                        : timeRange === "30d"
                          ? "Revenue (Last 30 days)"
                          : "Revenue (Last 7 days)"}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Sum of paid invoice totals (excl. reimbursements) in the
                      period.
                    </TooltipContent>
                  </Tooltip>
                </dt>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        stats.revenue.change >= 0
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      {stats.revenue.change >= 0 ? (
                        <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                      )}
                      {formatChange(stats.revenue.change)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {timeRange === "all"
                      ? "Last 30 days vs previous 30 days"
                      : "Period vs previous period"}
                  </TooltipContent>
                </Tooltip>
              </div>
              <dd className="mt-2 text-2xl font-semibold">
                {formatCurrency(convert(stats.revenue.total), currency)}
              </dd>
              {timeRange === "all" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last 30 days:{" "}
                  {formatCurrency(convert(stats.revenue.last30Days), currency)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Expenses
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      All recorded expenses. Reimbursed expenses excluded.
                    </TooltipContent>
                  </Tooltip>
                </dt>
              </div>
              <dd className="mt-2 text-2xl font-semibold">
                {formatCurrency(convert(stats.expenses.total), currency)}
              </dd>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Profit
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Revenue minus expenses (gross profit).
                    </TooltipContent>
                  </Tooltip>
                </dt>
              </div>
              <dd
                className={cn(
                  "mt-2 text-2xl font-semibold",
                  stats.profit.gross >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {formatCurrency(convert(stats.profit.gross), currency)}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Margin: {stats.profit.margin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Outstanding
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Invoices sent or overdue, not yet paid. Estimated future
                      revenue.
                    </TooltipContent>
                  </Tooltip>
                </dt>
              </div>
              <dd className="mt-2 text-2xl font-semibold">
                {formatCurrency(
                  convert(stats.estimations.outstandingInvoices),
                  currency
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.estimations.outstandingCount} invoice
                {stats.estimations.outstandingCount !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={revenueExpensesChartConfig}
            className="aspect-auto h-[280px] w-full"
          >
            <ComposedChart data={combinedChartData}>
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
                <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-expenses)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-expenses)"
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
                tickFormatter={(v) =>
                  formatCurrencyCompact(convert(v), currency)
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => v}
                    formatter={(value) =>
                      formatCurrency(convert(Number(value)), currency)
                    }
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
              <Area
                dataKey="expenses"
                type="natural"
                fill="url(#fillExpenses)"
                stroke="var(--color-expenses)"
                strokeWidth={2}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Profit & Tax Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Profit & Tax Breakdown
            </CardTitle>
            {stats.revenue.vatCollected !== 0 && (
              <p className="text-sm text-muted-foreground">
                Omzetbelasting collected:{" "}
                {formatCurrency(convert(stats.revenue.vatCollected), currency)}{" "}
                (owed to Belastingdienst)
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                ZZP/eenmanszaak – Income tax (Box 1)
              </p>
              <Select
                value={String(taxYear)}
                onValueChange={(v) => setTaxYear(parseInt(v, 10))}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TAX_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Gross profit</span>
                <span
                  className={cn(
                    "font-medium",
                    stats.profit.gross >= 0
                      ? "text-foreground"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {formatCurrency(convert(stats.profit.gross), currency)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Profit margin</span>
                <span className="font-medium">
                  {stats.profit.margin.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Taxable profit</span>
                <span className="font-medium">
                  {formatCurrency(convert(stats.profit.taxable), currency)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">
                  Income tax (Box 1)
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(convert(stats.profit.incomeTax), currency)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-medium">Net profit</span>
                <span
                  className={cn(
                    "font-semibold",
                    stats.profit.net >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {formatCurrency(convert(stats.profit.net), currency)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Tax estimate only. Consult a tax advisor for filing.{" "}
              {isSupportedTaxYear(stats.taxYear) &&
                (() => {
                  const brackets = getIncomeTaxBrackets(stats.taxYear);
                  return brackets
                    .map((b, i) => {
                      if (b.upperLimit === Infinity) {
                        const prev = brackets[i - 1]?.upperLimit ?? 0;
                        return `>€${prev.toLocaleString()} @ ${b.rate}%`;
                      }
                      return `≤€${b.upperLimit.toLocaleString()} @ ${b.rate}%`;
                    })
                    .join(" · ");
                })()}
            </p>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardAction>
              <Link href="/dashboard/expenses">
                <span className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {stats.expenses.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No expenses recorded yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {stats.expenses.byCategory.slice(0, 8).map((cat) => (
                  <div
                    key={cat.category}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-normal">
                        {cat.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {cat.count} item{cat.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(convert(cat.amount), currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/invoices">
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent py-1.5 px-3"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Invoices
          </Badge>
        </Link>
        <Link href="/dashboard/expenses">
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent py-1.5 px-3"
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Expenses
          </Badge>
        </Link>
      </div>
    </div>
  );
}
