import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Warehouse,
  Building2,
  DoorOpen,
  AlertOctagon,
  Wallet,
  Calendar,
  ChevronRight,
  Bell,
  Banknote,
  PackageSearch,
  CheckCircle2,
} from "lucide-react";
import { formatMoney, formatDate, daysBetween } from "@/lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function initials(name?: string | null) {
  if (!name) return "··";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("connecting");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [units, customers, rentals, payments] = await Promise.all([
        supabase.from("storage_units").select("id, status, monthly_price, currency"),
        supabase.from("customers").select("id, full_name, created_at"),
        supabase
          .from("rentals")
          .select("id, end_date, start_date, billing_cycle, status, rate, currency, customer_id, unit_id, customers(full_name), storage_units(name, unit_code, size), payments(amount, status)"),
        supabase
          .from("payments")
          .select("id, amount, currency, paid_at, method, customer_id, rental_id, customers(full_name), rentals(storage_units(name, unit_code))")
          .order("paid_at", { ascending: false }),
      ]);
      return {
        units: units.data ?? [],
        customers: customers.data ?? [],
        rentals: rentals.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  // Realtime: refresh dashboard whenever payments, rentals, units or customers change
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-payments"] });
      queryClient.invalidateQueries({ queryKey: ["expiring"] });
    };

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "storage_units" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, invalidate)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setLiveStatus("offline");
        else setLiveStatus("connecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalUnits = stats?.units.length ?? 0;
  const occupied = stats?.units.filter((u: any) => u.status === "occupied").length ?? 0;
  const vacant = stats?.units.filter((u: any) => u.status === "vacant").length ?? 0;
  const occRate = totalUnits ? (occupied / totalUnits) * 100 : 0;
  const vacRate = totalUnits ? (vacant / totalUnits) * 100 : 0;

  const monthRevenue = (stats?.payments ?? [])
    .filter((p: any) => new Date(p.paid_at) >= monthStart)
    .reduce((s: number, p: any) => s + Number(p.amount), 0);

  // Previous month revenue for trend %
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthRevenue = (stats?.payments ?? [])
    .filter((p: any) => {
      const d = new Date(p.paid_at);
      return d >= prevMonthStart && d < monthStart;
    })
    .reduce((s: number, p: any) => s + Number(p.amount), 0);
  const revChange = prevMonthRevenue ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  // Overdue rentals — based on actual payments vs elapsed billing periods.
  // A rental is "overdue" only if the customer truly owes money right now.
  const cycleMonths = (cycle: string) => {
    switch (cycle) {
      case "weekly": return 0.25;
      case "monthly": return 1;
      case "quarterly": return 3;
      case "yearly": return 12;
      default: return 1;
    }
  };
  const msPerMonth = 1000 * 60 * 60 * 24 * (365.25 / 12);

  const overdueRentals = (stats?.rentals ?? [])
    .map((r: any) => {
      if (r.status === "cancelled") return null;
      const rate = Number(r.rate ?? 0);
      const perMonth = rate / cycleMonths(r.billing_cycle ?? "monthly");
      const start = r.start_date ? new Date(r.start_date) : null;
      if (!start || perMonth <= 0) return null;
      const elapsedMonths = Math.max(0, (now.getTime() - start.getTime()) / msPerMonth);
      const totalPaid = (r.payments ?? [])
        .filter((p: any) => p.status === "paid")
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      const owed = elapsedMonths * perMonth - totalPaid;
      // Use a small tolerance so a few days of drift doesn't show as owing
      if (owed <= perMonth * 0.05) return null;
      return { ...r, owedAmount: owed };
    })
    .filter(Boolean) as any[];
  const overdueAmount = overdueRentals.reduce((s: number, r: any) => s + Number(r.owedAmount ?? 0), 0);

  // Upcoming expiries (next 7 days)
  const expiring = (stats?.rentals ?? [])
    .filter((r: any) => {
      if (!r.end_date || r.status === "cancelled") return false;
      const days = daysBetween(now, r.end_date);
      return days >= 0 && days <= 7;
    })
    .sort((a: any, b: any) => +new Date(a.end_date) - +new Date(b.end_date));

  // Revenue trend last 7 months
  const trend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
    const next = new Date(now.getFullYear(), now.getMonth() - (6 - i) + 1, 1);
    const total = (stats?.payments ?? [])
      .filter((p: any) => {
        const t = new Date(p.paid_at);
        return t >= d && t < next;
      })
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    return { month: d.toLocaleString(undefined, { month: "short" }), revenue: total };
  });

  const occupancyData = [
    { name: "Occupied", value: occupied },
    { name: "Vacant", value: Math.max(totalUnits - occupied, 0) },
  ];

  const recentPayments = (stats?.payments ?? []).slice(0, 4);

  const kpis = [
    {
      label: "Total Units",
      value: totalUnits,
      hint: "All storage units",
      icon: Warehouse,
      tone: "primary",
    },
    {
      label: "Occupied Units",
      value: occupied,
      hint: `${occRate.toFixed(1)}% Occupied`,
      icon: Building2,
      tone: "info",
    },
    {
      label: "Vacant Units",
      value: vacant,
      hint: `${vacRate.toFixed(1)}% Vacant`,
      icon: DoorOpen,
      tone: "warning",
    },
    {
      label: "Overdue Payments",
      value: overdueRentals.length,
      hint: formatMoney(overdueAmount),
      icon: AlertOctagon,
      tone: "danger",
    },
    {
      label: "Monthly Revenue",
      value: formatMoney(monthRevenue),
      hint:
        prevMonthRevenue > 0
          ? `${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}% from last month`
          : "First month tracked",
      icon: Wallet,
      tone: "success",
      positive: revChange >= 0,
    },
  ];

  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };

  const greetingName =
    (user?.user_metadata as any)?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Admin";

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Welcome back, {greetingName} <span className="inline-block">👋</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your storage business today.
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            liveStatus === "live"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
              : liveStatus === "connecting"
                ? "bg-muted text-muted-foreground"
                : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
          title="Realtime updates"
        >
          {liveStatus === "live" ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </>
          ) : liveStatus === "connecting" ? (
            <>
              <Wifi className="h-3 w-3" /> Connecting…
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" /> Offline
            </>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((c) => (
          <Card key={c.label} className="shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className={`size-12 rounded-full grid place-items-center shrink-0 ${toneClasses[c.tone]}`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight truncate">{c.value}</p>
                  <p
                    className={`mt-1 text-xs ${
                      c.tone === "danger"
                        ? "text-destructive"
                        : c.tone === "success"
                          ? c.positive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {c.hint}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Monthly Revenue Overview</CardTitle>
            <Badge variant="secondary" className="font-normal">
              Last 7 months
            </Badge>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="month" stroke="currentColor" opacity={0.5} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" opacity={0.5} fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => formatMoney(Number(v))}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#rev)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: "var(--color-background)" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Occupancy Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={occupancyData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="none"
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-bold">{occRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Occupied</p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-primary" /> Occupied Units
                </span>
                <span className="font-medium">
                  {occupied} ({occRate.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" /> Vacant Units
                </span>
                <span className="font-medium">
                  {vacant} ({vacRate.toFixed(1)}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Alerts
              <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
                {overdueRentals.length + expiring.length}
              </Badge>
            </CardTitle>
            <Button asChild variant="link" size="sm" className="text-primary">
              <Link to="/app/reminders">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <AlertRow
              icon={Banknote}
              tone="danger"
              title={`${overdueRentals.length} payments are overdue`}
              subtitle={`Total overdue: ${formatMoney(overdueAmount)}`}
              to="/app/payments"
            />
            <AlertRow
              icon={PackageSearch}
              tone="warning"
              title={`${expiring.length} units expiring in 7 days`}
              subtitle="Check expiring units"
              to="/app/rentals"
            />
            <AlertRow
              icon={Bell}
              tone="info"
              title="Reminders pipeline"
              subtitle="Review scheduled reminders"
              to="/app/reminders"
            />
            <AlertRow
              icon={CheckCircle2}
              tone="success"
              title={`${stats?.customers.length ?? 0} total customers`}
              subtitle="Manage your customer base"
              to="/app/customers"
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom: overdue table + side panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Overdue Payments</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link to="/app/payments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {overdueRentals.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                🎉 No overdue payments. You're all caught up.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Unit</th>
                      <th className="px-5 py-3 font-medium">Due Date</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Days Overdue</th>
                      <th className="px-5 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueRentals.slice(0, 5).map((r: any) => {
                      const days = Math.max(daysBetween(r.end_date, now), 0);
                      const name = r.customers?.full_name ?? "—";
                      return (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {initials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="font-medium">{name}</div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="font-medium">{r.storage_units?.unit_code ?? r.storage_units?.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {r.storage_units?.size ?? ""} unit
                            </div>
                          </td>
                          <td className="px-5 py-3 text-destructive">{formatDate(r.end_date)}</td>
                          <td className="px-5 py-3 font-semibold">{formatMoney(r.rate, r.currency)}</td>
                          <td className="px-5 py-3 text-destructive font-medium">
                            {days} {days === 1 ? "day" : "days"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button asChild size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                              <Link to="/app/reminders">Send Reminder</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Upcoming Expiries</CardTitle>
              <Button asChild variant="link" size="sm">
                <Link to="/app/rentals">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {expiring.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rentals expiring soon.</p>
              ) : (
                expiring.slice(0, 4).map((r: any) => {
                  const days = daysBetween(now, r.end_date);
                  const name = r.customers?.full_name ?? "—";
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs bg-accent text-accent-foreground">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.storage_units?.unit_code ?? r.storage_units?.name ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3" />
                          {formatDate(r.end_date)}
                        </p>
                        <p className="text-xs text-destructive font-medium">
                          {days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"} left`}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Payments</CardTitle>
              <Button asChild variant="link" size="sm">
                <Link to="/app/payments">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                recentPayments.map((p: any) => {
                  const name = p.customers?.full_name ?? "Customer";
                  const unit = p.rentals?.storage_units?.unit_code ?? p.rentals?.storage_units?.name ?? "";
                  const today = new Date();
                  const paid = new Date(p.paid_at);
                  const sameDay = paid.toDateString() === today.toDateString();
                  const yest = new Date(today);
                  yest.setDate(today.getDate() - 1);
                  const isYest = paid.toDateString() === yest.toDateString();
                  const label = sameDay ? "Today" : isYest ? "Yesterday" : formatDate(paid);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">{unit || p.method}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatMoney(p.amount, p.currency)}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AlertRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  to,
}: {
  icon: any;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  subtitle: string;
  to: string;
}) {
  const tones: Record<string, string> = {
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border bg-card hover:bg-muted/40 px-3 py-2.5 transition-colors"
    >
      <div className={`size-9 rounded-md grid place-items-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
