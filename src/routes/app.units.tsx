import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Users, Boxes } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/units")({
  component: UnitsPage,
});

const statusVariant: Record<string, any> = {
  vacant: "secondary",
  occupied: "default",
  reserved: "outline",
  maintenance: "destructive",
};

function UnitsPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canViewItems = role === "admin" || role === "staff";
  const [open, setOpen] = useState(false);
  const [activeUnit, setActiveUnit] = useState<any | null>(null);

  const { data: units, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("storage_units").select("*").order("unit_code");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Storage units</h2>
          <p className="text-sm text-muted-foreground">Track every unit in your facility</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add unit</Button></DialogTrigger>
          <UnitForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["units"] }); }} />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (units?.length ?? 0) === 0 ? (
        <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-12 text-center text-muted-foreground">No units yet. Add your first storage unit.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units!.map((u) => (
            <Card
              key={u.id}
              className={`shadow-[var(--shadow-card)] transition-shadow ${canViewItems ? "cursor-pointer hover:shadow-[var(--shadow-elegant)]" : ""}`}
              onClick={() => canViewItems && setActiveUnit(u)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{u.unit_code}</p>
                    <h3 className="font-semibold mt-0.5">{u.name}</h3>
                  </div>
                  <Badge variant={statusVariant[u.status]}>{u.status}</Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {u.size} · {u.dimensions ?? "—"} · floor {u.floor_level}
                  {u.climate_controlled && " · climate"}
                </div>
                <div className="mt-3 text-lg font-bold">{formatMoney(u.monthly_price, u.currency)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!activeUnit} onOpenChange={(o) => !o && setActiveUnit(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {activeUnit && <UnitDetail unit={activeUnit} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UnitDetail({ unit }: { unit: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["unit-items", unit.id],
    queryFn: async () => {
      // Get all storage rentals on this unit, plus customer + items
      const { data: rentals, error } = await supabase
        .from("rentals")
        .select("id, status, start_date, end_date, customer_id, customers(id, full_name, phone)")
        .eq("unit_id", unit.id)
        .eq("service_type", "storage");
      if (error) throw error;

      const rentalIds = (rentals ?? []).map((r: any) => r.id);
      let items: any[] = [];
      if (rentalIds.length) {
        const { data: it, error: e2 } = await supabase
          .from("stored_items")
          .select("*")
          .in("rental_id", rentalIds)
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        items = it ?? [];
      }
      return { rentals: rentals ?? [], items };
    },
  });

  const grouped = new Map<string, { customer: any; rental: any; items: any[] }>();
  (data?.rentals ?? []).forEach((r: any) => {
    grouped.set(r.id, { customer: r.customers, rental: r, items: [] });
  });
  (data?.items ?? []).forEach((it: any) => {
    const g = grouped.get(it.rental_id);
    if (g) g.items.push(it);
  });

  const totalItems = data?.items.length ?? 0;
  const inStorage = (data?.items ?? []).reduce((s: number, it: any) => s + (it.qty - (it.qty_released ?? 0)), 0);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" /> {unit.unit_code} · {unit.name}
        </SheetTitle>
        <SheetDescription>
          {unit.size} · {unit.dimensions ?? "—"} · floor {unit.floor_level}
          {unit.climate_controlled && " · climate controlled"}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Customers" value={grouped.size} />
        <Stat label="Items" value={totalItems} />
        <Stat label="In storage" value={inStorage} />
      </div>

      <div className="mt-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Customers using this unit
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && grouped.size === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No customers assigned to this unit yet.</CardContent></Card>
        )}

        {Array.from(grouped.values()).map(({ customer, rental, items }) => (
          <Card key={rental.id} className="shadow-[var(--shadow-card)]">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{customer?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{customer?.phone ?? "—"}</p>
                </div>
                <Badge variant="outline">{rental.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(rental.start_date)} → {formatDate(rental.end_date)}
              </p>

              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No items recorded.</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase">
                      <tr>
                        <th className="text-left px-2 py-1.5">Code</th>
                        <th className="text-left px-2 py-1.5">Item</th>
                        <th className="text-left px-2 py-1.5">Qty</th>
                        <th className="text-left px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const left = it.qty - (it.qty_released ?? 0);
                        return (
                          <tr key={it.id} className="border-t">
                            <td className="px-2 py-1.5 font-mono">{it.item_code}</td>
                            <td className="px-2 py-1.5 font-medium">{it.name}</td>
                            <td className="px-2 py-1.5">{left} / {it.qty}</td>
                            <td className="px-2 py-1.5">
                              <Badge variant={it.status === "released" ? "outline" : "secondary"}>
                                {it.status.replace("_", " ")}
                              </Badge>
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
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function UnitForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    unit_code: "",
    name: "",
    size: "medium" as "small" | "medium" | "large" | "custom",
    dimensions: "",
    floor_level: 0,
    climate_controlled: false,
    monthly_price: 0,
    weekly_price: 0,
    yearly_price: 0,
    currency: "NGN",
    status: "vacant" as "vacant" | "occupied" | "reserved" | "maintenance",
    notes: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("storage_units").insert(f);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Unit added");
    onDone();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New storage unit</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Unit code *"><Input required value={f.unit_code} onChange={(e) => set("unit_code", e.target.value)} placeholder="A-101" /></F>
          <F label="Name *"><Input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Block A · Unit 101" /></F>
          <F label="Size">
            <Select value={f.size} onValueChange={(v) => set("size", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["small", "medium", "large", "custom"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Dimensions"><Input value={f.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="5x10 ft" /></F>
          <F label="Floor"><Input type="number" value={f.floor_level} onChange={(e) => set("floor_level", Number(e.target.value))} /></F>
          <F label="Status">
            <Select value={f.status} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["vacant", "occupied", "reserved", "maintenance"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Currency"><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} placeholder="NGN" /></F>
          <F label="Monthly price *"><Input type="number" required value={f.monthly_price} onChange={(e) => set("monthly_price", Number(e.target.value))} /></F>
          <F label="Weekly price"><Input type="number" value={f.weekly_price} onChange={(e) => set("weekly_price", Number(e.target.value))} /></F>
          <F label="Yearly price"><Input type="number" value={f.yearly_price} onChange={(e) => set("yearly_price", Number(e.target.value))} /></F>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Climate controlled</p>
            <p className="text-xs text-muted-foreground">Temperature-regulated environment</p>
          </div>
          <Switch checked={f.climate_controlled} onCheckedChange={(v) => set("climate_controlled", v)} />
        </div>
        <F label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></F>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save unit"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
