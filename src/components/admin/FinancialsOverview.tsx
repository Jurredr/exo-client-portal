"use client";

import { useState, useEffect } from "react";
import { useFinancials, useBTWAangifte } from "@/hooks/use-financials";
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
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Area, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getBTWAangifteYears } from "@/lib/constants/exo-company";
import {
  SUPPORTED_TAX_YEARS,
  getIncomeTaxBrackets,
  isSupportedTaxYear,
} from "@/lib/constants/dutch-tax";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

const formatChange = (change: number): string => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

function AssetDepreciationRow({
  asset,
  formatCurrency,
}: {
  asset: {
    id: string;
    name: string;
    purchaseDate: Date;
    purchasePrice: number;
    residualValue: number;
    usefulLifeYears: number;
    category: string | null;
    yearlyDepreciation: number;
    currentBookValue: number;
    totalDepreciationInPeriod: number;
    schedule: Array<{ year: number; depreciation: number; bookValue: number }>;
  };
  formatCurrency: (amount: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const purchaseDate =
    asset.purchaseDate instanceof Date
      ? asset.purchaseDate
      : new Date(asset.purchaseDate);

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left hover:bg-muted/50 rounded p-1 -m-1"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{asset.name}</span>
          {asset.category && (
            <Badge variant="secondary" className="font-normal text-xs">
              {asset.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Book value: {formatCurrency(asset.currentBookValue)}
          </span>
          <span className="text-muted-foreground">
            {formatCurrency(asset.yearlyDepreciation)}/yr
          </span>
        </div>
      </button>
      <div className="text-xs text-muted-foreground pl-6">
        Purchased {purchaseDate.toLocaleDateString()} ·{" "}
        {formatCurrency(asset.purchasePrice)} · {asset.usefulLifeYears} years
      </div>
      {expanded && (
        <div className="pl-6 pt-2 border-t">
          <p className="text-sm font-medium mb-2">Depreciation schedule</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Year</th>
                  <th className="text-right py-1">Depreciation</th>
                  <th className="text-right py-1">Book value</th>
                </tr>
              </thead>
              <tbody>
                {asset.schedule.map((row) => (
                  <tr key={row.year} className="border-b last:border-0">
                    <td className="py-1">{row.year}</td>
                    <td className="text-right py-1">
                      {formatCurrency(row.depreciation)}
                    </td>
                    <td className="text-right py-1">
                      {formatCurrency(row.bookValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="btw">BTW Aangifte</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-8 mt-0">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Financial Overview</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(
                      `/api/dashboard/financials/export-pl?year=${taxYear}`,
                      "_blank"
                    );
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export jaar P&L
                </Button>
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
                          Sum of paid invoice totals (excl. reimbursements) in
                          the period.
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
                      {formatCurrency(
                        convert(stats.revenue.last30Days),
                        currency
                      )}
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
                          Invoices sent or overdue, not yet paid. Estimated
                          future revenue.
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
                    <linearGradient
                      id="fillRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                    <linearGradient
                      id="fillExpenses"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                    {formatCurrency(
                      convert(stats.revenue.vatCollected),
                      currency
                    )}{" "}
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
                    <span className="text-muted-foreground">
                      Taxable profit
                    </span>
                    <span className="font-medium">
                      {formatCurrency(convert(stats.profit.taxable), currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">
                      Income tax (Box 1)
                    </span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {formatCurrency(
                        convert(stats.profit.incomeTax),
                        currency
                      )}
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

          {/* Assets & Depreciation */}
          {stats.assets && stats.assets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Assets & Depreciation
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Total depreciation in period:{" "}
                  {formatCurrency(
                    convert(stats.expenses.depreciation ?? 0),
                    currency
                  )}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.assets.map((asset) => (
                    <AssetDepreciationRow
                      key={asset.id}
                      asset={asset}
                      formatCurrency={(amt) =>
                        formatCurrency(convert(amt), currency)
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
      </TabsContent>

      <TabsContent value="btw">
        <BTWAangifteTab />
      </TabsContent>
    </Tabs>
  );
}

function BTWAangifteTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: quarters, isLoading } = useBTWAangifte(year);

  const handleExportPDF = () => {
    window.open(`/api/dashboard/btw-aangifte/export?year=${year}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold">BTW Aangifte</h2>
        <div className="flex items-center gap-2">
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(parseInt(v, 10))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getBTWAangifteYears().map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExportPDF} variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Export as PDF
          </Button>
        </div>
      </div>

      {quarters?.some((q) => q.isInKORPeriod) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            KOR (Kleine Ondernemersregeling) ended 1 April 2026
          </p>
          <p className="text-muted-foreground mt-1">
            EXO was in the small business scheme from 1 July 2024 until 1 April
            2026. No VAT was charged during that period.
          </p>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : quarters && quarters.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 font-medium">Kwartaal</th>
                    <th className="text-right py-3 font-medium">
                      1a BTW omzet
                    </th>
                    <th className="text-right py-3 font-medium">
                      4a BTW betaald
                    </th>
                    <th className="text-right py-3 font-medium">
                      Netto positie
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quarters.map((q) => (
                    <tr key={q.quarter} className="border-b last:border-0">
                      <td className="py-3">
                        <span className="font-medium">{q.quarter}</span>
                        {q.isInKORPeriod && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (KOR)
                          </span>
                        )}
                      </td>
                      <td className="text-right py-3">
                        {formatCurrency(q.btwCollected, "EUR")}
                      </td>
                      <td className="text-right py-3">
                        {formatCurrency(q.btwPaid, "EUR")}
                      </td>
                      <td className="text-right py-3 font-medium">
                        {formatCurrency(q.netPosition, "EUR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              4a (BTW betaald) must be filled from your purchase invoices. This
              overview shows 1a (BTW collected) from paid sales invoices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No BTW data for this year.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
