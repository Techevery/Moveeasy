import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { AlertTriangle, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/app/reminders")({
  component: RemindersPage,
});

const cycleMonths = (cycle: string) => {
  switch (cycle) {
    case "weekly": return 0.25;
    case "monthly": return 1;
    case "quarterly": return 3;
    case "yearly": return 12;
    default: return 1;
  }
};
const MS_PER_MONTH = 1000 * 60 * 60 * 24 * (365.25 / 12);

function RemindersPage() {
  const now = new Date();

  const { data: rentals } = useQuery({
    queryKey: ["reminders-rentals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rentals")
        .select("id, start_date, end_date, status, rate, billing_cycle, auto_renew, customers(full_name), storage_units(unit_code, name), payments(amount, status)")
        .order("end_date", { ascending: true });
      return data ?? [];
    },
  });

  const overdue = (rentals ?? [])
    .map((r: any) => {
      if (r.status === "cancelled") return null;
      const rate = Number(r.rate ?? 0);
      const perMonth = rate / cycleMonths(r.billing_cycle ?? "monthly");
      const start = r.start_date ? new Date(r.start_date) : null;
      if (!start || perMonth <= 0) return null;
      const elapsedMonths = Math.max(0, (now.getTime() - start.getTime()) / MS_PER_MONTH);
      const totalPaid = (r.payments ?? [])
        .filter((p: any) => p.status === "paid")
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      const owed = elapsedMonths * perMonth - totalPaid;
      // tolerance for date drift
      if (owed <= perMonth * 0.05) return null;
      return { ...r, owedAmount: owed };
    })
    .filter(Boolean) as any[];

  const upcoming = (rentals ?? []).filter((r: any) => {
    if (!r.end_date || r.status === "cancelled") return false;
    // Auto-renewing rentals don't expire — skip them
    if (r.auto_renew) return false;
    const days = (new Date(r.end_date).getTime() - now.getTime()) / 86400000;
    if (days < 0 || days > 7) return false;

    // Skip if the customer has paid ahead — total payments cover beyond the
    // rental's current end_date (with small drift tolerance).
    const rate = Number(r.rate ?? 0);
    const perMonth = rate / cycleMonths(r.billing_cycle ?? "monthly");
    const start = r.start_date ? new Date(r.start_date) : null;
    if (start && perMonth > 0) {
      const totalPaid = (r.payments ?? [])
        .filter((p: any) => p.status === "paid")
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      const monthsPaid = totalPaid / perMonth;
      const paidUntil = new Date(start.getTime() + monthsPaid * MS_PER_MONTH);
      const endDate = new Date(r.end_date);
      // If payments cover at/after the end_date, customer is paid ahead
      if (paidUntil.getTime() >= endDate.getTime() - perMonth * 0.05 * MS_PER_MONTH) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reminders & alerts</h2>
        <p className="text-sm text-muted-foreground">Upcoming expiries and overdue rentals</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-[var(--shadow-card)] border-destructive/20">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <CardTitle>Overdue ({overdue.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing overdue. </p>
            ) : overdue.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="font-medium">{r.customers?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.storage_units?.unit_code} · owes {formatMoney(r.owedAmount)}</p>
                </div>
                <Badge variant="destructive">Overdue</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <CardTitle>Expiring within 7 days ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contracts expiring soon.</p>
            ) : upcoming.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="font-medium">{r.customers?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.storage_units?.unit_code} · ends {formatDate(r.end_date)}</p>
                </div>
                <Badge variant="secondary">Upcoming</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
