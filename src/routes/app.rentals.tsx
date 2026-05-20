import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Package, Truck, X, Pencil, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { generateInvoiceForRental } from "@/lib/billing-pdf";

export const Route = createFileRoute("/app/rentals")({
  component: ServicesPage,
});

type RentStatus = {
  paidMonths: number;
  elapsedMonths: number;
  diffMonths: number; // positive = advance, negative = owing
  owedAmount: number;
  totalPaid: number;
  label: "paid_in_advance" | "current" | "owing";
};

function cycleMonths(cycle: string) {
  switch (cycle) {
    case "weekly": return 0.25;
    case "monthly": return 1;
    case "quarterly": return 3;
    case "yearly": return 12;
    default: return 1;
  }
}

function computeRentStatus(rental: any): RentStatus {
  const rate = Number(rental.rate ?? 0);
  const perMonth = rate / cycleMonths(rental.billing_cycle ?? "monthly");
  const start = new Date(rental.start_date);
  const now = new Date();
  const msPerMonth = 1000 * 60 * 60 * 24 * (365.25 / 12);
  const elapsedMonths = Math.max(0, (now.getTime() - start.getTime()) / msPerMonth);
  const totalPaid = (rental.payments ?? [])
    .filter((p: any) => p.status === "paid")
    .reduce((s: number, p: any) => s + Number(p.amount), 0);
  const paidMonths = perMonth > 0 ? totalPaid / perMonth : 0;
  const diffMonths = paidMonths - elapsedMonths;
  const owedAmount = Math.max(0, elapsedMonths * perMonth - totalPaid);
  const label: RentStatus["label"] =
    diffMonths >= 0.5 ? "paid_in_advance" : diffMonths < -0.05 ? "owing" : "current";
  return { paidMonths, elapsedMonths, diffMonths, owedAmount, totalPaid, label };
}

function ServicesPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [openStorage, setOpenStorage] = useState(false);
  const [openMoving, setOpenMoving] = useState(false);
  const [editInv, setEditInv] = useState<any | null>(null);
  const [closeRental, setCloseRental] = useState<any | null>(null);

  const { data: services } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*, customers(full_name), storage_units(name, unit_code), payments(amount, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const storage = (services ?? []).filter((s: any) => s.service_type === "storage");
  const moving = (services ?? []).filter((s: any) => s.service_type === "moving");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Services</h2>
          <p className="text-sm text-muted-foreground">Storage rentals and moving jobs</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openStorage} onOpenChange={setOpenStorage}>
            <DialogTrigger asChild><Button variant="outline"><Package className="h-4 w-4 mr-2" /> New storage</Button></DialogTrigger>
            <StorageForm onDone={() => { setOpenStorage(false); qc.invalidateQueries({ queryKey: ["rentals"] }); qc.invalidateQueries({ queryKey: ["units"] }); }} />
          </Dialog>
          <Dialog open={openMoving} onOpenChange={setOpenMoving}>
            <DialogTrigger asChild><Button><Truck className="h-4 w-4 mr-2" /> New moving job</Button></DialogTrigger>
            <MovingForm onDone={() => { setOpenMoving(false); qc.invalidateQueries({ queryKey: ["rentals"] }); }} />
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="storage">
        <TabsList>
          <TabsTrigger value="storage"><Package className="h-4 w-4 mr-2" /> Storage ({storage.length})</TabsTrigger>
          <TabsTrigger value="moving"><Truck className="h-4 w-4 mr-2" /> Moving ({moving.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="storage">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-left px-4 py-3">Unit</th>
                      <th className="text-left px-4 py-3">Period</th>
                      <th className="text-left px-4 py-3">Cycle</th>
                      <th className="text-left px-4 py-3">Rate</th>
                      <th className="text-left px-4 py-3">Rent status</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storage.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No storage rentals yet.</td></tr>
                    )}
                    {storage.map((r: any) => {
                      const rs = computeRentStatus(r);
                      return (
                      <tr key={r.id} className="border-t hover:bg-secondary/30">
                        <td className="px-4 py-3 font-medium">{r.customers?.full_name ?? "—"}</td>
                        <td className="px-4 py-3">{r.storage_units?.name ?? "—"} <span className="text-muted-foreground">({r.storage_units?.unit_code})</span></td>
                        <td className="px-4 py-3">{formatDate(r.start_date)} → {formatDate(r.end_date)}</td>
                        <td className="px-4 py-3 capitalize">{r.billing_cycle}</td>
                        <td className="px-4 py-3">{formatMoney(r.rate, r.currency)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={rs.label === "owing" ? "destructive" : rs.label === "paid_in_advance" ? "secondary" : "outline"} className="w-fit capitalize">
                              {rs.label === "paid_in_advance"
                                ? `+${rs.diffMonths.toFixed(1)} mo ahead`
                                : rs.label === "owing"
                                ? `${Math.abs(rs.diffMonths).toFixed(1)} mo owing`
                                : "Current"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {rs.paidMonths.toFixed(1)} / {rs.elapsedMonths.toFixed(1)} mo
                              {rs.owedAmount > 0 && ` · ${formatMoney(rs.owedAmount, r.currency)} due`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={r.status === "active" ? "secondary" : r.status === "overdue" ? "destructive" : "outline"}>{r.status}</Badge>
                          {r.closed_reason && (
                            <div className="text-[11px] text-muted-foreground mt-1 capitalize">{r.closed_reason.replace(/_/g, " ")}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && r.status === "active" ? (
                            <Button variant="ghost" size="sm" onClick={() => setCloseRental(r)}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Close
                            </Button>
                          ) : !isAdmin ? (
                            <span className="inline-flex items-center text-xs text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Admin only</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moving">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-left px-4 py-3">Pickup → Destination</th>
                      <th className="text-left px-4 py-3">Move date</th>
                      <th className="text-left px-4 py-3">Vehicle</th>
                      <th className="text-left px-4 py-3">Inventory</th>
                      <th className="text-left px-4 py-3">Fee</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moving.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No moving jobs yet.</td></tr>
                    )}
                    {moving.map((r: any) => (
                      <tr key={r.id} className="border-t hover:bg-secondary/30">
                        <td className="px-4 py-3 font-medium">{r.customers?.full_name ?? "—"}</td>
                        <td className="px-4 py-3 max-w-md">
                          <span className="text-foreground">{r.pickup_address}</span>
                          <span className="text-muted-foreground"> → {r.destination_address}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.move_date ? formatDate(r.move_date) : "—"}
                          {r.move_time_start && <span className="text-muted-foreground"> · {r.move_time_start}{r.move_time_end ? `–${r.move_time_end}` : ""}</span>}
                        </td>
                        <td className="px-4 py-3">{r.vehicle_type ?? "—"}</td>
                        <td className="px-4 py-3">
                          {Array.isArray(r.inventory) && r.inventory.length > 0 ? (
                            <div className="text-xs">
                              <div className="font-medium">{r.inventory.length} item{r.inventory.length === 1 ? "" : "s"}</div>
                              <div className="text-muted-foreground truncate max-w-[180px]">
                                {r.inventory.slice(0, 2).map((it: any) => `${it.name}${it.qty ? ` ×${it.qty}` : ""}`).join(", ")}
                                {r.inventory.length > 2 && "…"}
                              </div>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">{formatMoney(r.rate, r.currency)}</td>
                        <td className="px-4 py-3"><Badge variant={r.status === "active" ? "secondary" : r.status === "overdue" ? "destructive" : "outline"}>{r.status}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setEditInv(r)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                              {r.status === "active" && (
                                <Button variant="ghost" size="sm" onClick={() => setCloseRental(r)}>
                                  <XCircle className="h-3.5 w-3.5 mr-1" /> Close
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center text-xs text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Admin only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editInv} onOpenChange={(o) => !o && setEditInv(null)}>
        {editInv && (
          <EditInventoryForm
            rental={editInv}
            onDone={() => { setEditInv(null); qc.invalidateQueries({ queryKey: ["rentals"] }); }}
          />
        )}
      </Dialog>

      <Dialog open={!!closeRental} onOpenChange={(o) => !o && setCloseRental(null)}>
        {closeRental && (
          <CloseRentalForm
            rental={closeRental}
            onDone={() => { setCloseRental(null); qc.invalidateQueries({ queryKey: ["rentals"] }); qc.invalidateQueries({ queryKey: ["units"] }); }}
          />
        )}
      </Dialog>
    </div>
  );
}

function StorageForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => (await supabase.from("customers").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: units } = useQuery({
    queryKey: ["units-vacant"],
    queryFn: async () => (await supabase.from("storage_units").select("id, name, unit_code, monthly_price, currency").eq("status", "vacant").order("unit_code")).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const monthAhead = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [f, setF] = useState({
    customer_id: "",
    unit_id: "",
    start_date: today,
    end_date: monthAhead,
    billing_cycle: "monthly" as "weekly" | "monthly" | "quarterly" | "yearly",
    rate: 0,
    currency: "NGN",
    security_deposit: 0,
    auto_renew: false,
    grace_days: 3,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.customer_id || !f.unit_id) return toast.error("Choose customer and unit");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: ins, error } = await supabase.from("rentals").insert({ ...f, service_type: "storage", created_by: auth.user?.id, status: "active" }).select("id").single();
    if (!error) {
      await supabase.from("storage_units").update({ status: "occupied" }).eq("id", f.unit_id);
      if (ins?.id) {
        try { await generateInvoiceForRental(ins.id); }
        catch (e: any) { toast.error(`Invoice PDF failed: ${e.message ?? e}`); }
      }
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Storage rental created");
    onDone();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New storage rental</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Customer *">
            <Select value={f.customer_id} onValueChange={(v) => set("customer_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Unit (vacant) *">
            <Select value={f.unit_id} onValueChange={(v) => {
              set("unit_id", v);
              const u = units?.find((x) => x.id === v);
              if (u) { set("rate", Number(u.monthly_price)); set("currency", u.currency); }
            }}>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_code} — {u.name}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Start date *"><Input type="date" required value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></F>
          <F label="End date *"><Input type="date" required value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></F>
          <F label="Billing cycle">
            <Select value={f.billing_cycle} onValueChange={(v) => set("billing_cycle", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["weekly", "monthly", "quarterly", "yearly"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Rate *"><Input type="number" required value={f.rate} onChange={(e) => set("rate", Number(e.target.value))} /></F>
          <F label="Currency"><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} /></F>
          <F label="Security deposit"><Input type="number" value={f.security_deposit} onChange={(e) => set("security_deposit", Number(e.target.value))} /></F>
          <F label="Grace days"><Input type="number" value={f.grace_days} onChange={(e) => set("grace_days", Number(e.target.value))} /></F>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Auto-renew</p>
            <p className="text-xs text-muted-foreground">Renew automatically when payment is confirmed</p>
          </div>
          <Switch checked={f.auto_renew} onCheckedChange={(v) => set("auto_renew", v)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create rental"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MovingForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => (await supabase.from("customers").select("id, full_name").order("full_name")).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);

  const [f, setF] = useState({
    customer_id: "",
    pickup_address: "",
    destination_address: "",
    move_date: today,
    move_time_start: "09:00",
    move_time_end: "13:00",
    vehicle_type: "",
    rate: 0,
    currency: "NGN",
    service_notes: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const [crew, setCrew] = useState<string[]>([]);
  const [crewInput, setCrewInput] = useState("");
  const [items, setItems] = useState<{ name: string; qty: number; notes?: string }[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemNotes, setItemNotes] = useState("");

  function addItem() {
    const name = itemName.trim();
    if (!name) return;
    setItems([...items, { name, qty: itemQty || 1, notes: itemNotes.trim() || undefined }]);
    setItemName("");
    setItemQty(1);
    setItemNotes("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.customer_id) return toast.error("Choose a customer");
    if (!f.pickup_address || !f.destination_address) return toast.error("Pickup and destination required");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: ins, error } = await supabase.from("rentals").insert({
      customer_id: f.customer_id,
      service_type: "moving",
      pickup_address: f.pickup_address,
      destination_address: f.destination_address,
      move_date: f.move_date,
      move_time_start: f.move_time_start || null,
      move_time_end: f.move_time_end || null,
      vehicle_type: f.vehicle_type || null,
      crew,
      inventory: items,
      service_notes: f.service_notes || null,
      rate: f.rate,
      currency: f.currency,
      // satisfy NOT NULL legacy fields
      start_date: f.move_date,
      end_date: f.move_date,
      billing_cycle: "monthly",
      created_by: auth.user?.id,
      status: "active",
    }).select("id").single();
    if (!error && ins?.id) {
      try { await generateInvoiceForRental(ins.id); }
      catch (e: any) { toast.error(`Invoice PDF failed: ${e.message ?? e}`); }
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Moving job created");
    onDone();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New moving job</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <F label="Customer *">
          <Select value={f.customer_id} onValueChange={(v) => set("customer_id", v)}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>{customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </F>

        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Pickup address *"><Textarea rows={2} required value={f.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} /></F>
          <F label="Destination address *"><Textarea rows={2} required value={f.destination_address} onChange={(e) => set("destination_address", e.target.value)} /></F>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <F label="Move date *"><Input type="date" required value={f.move_date} onChange={(e) => set("move_date", e.target.value)} /></F>
          <F label="Start time"><Input type="time" value={f.move_time_start} onChange={(e) => set("move_time_start", e.target.value)} /></F>
          <F label="End time"><Input type="time" value={f.move_time_end} onChange={(e) => set("move_time_end", e.target.value)} /></F>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <F label="Vehicle type"><Input placeholder="e.g. 7-tonne truck" value={f.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} /></F>
          <F label="Fee *"><Input type="number" required value={f.rate} onChange={(e) => set("rate", Number(e.target.value))} /></F>
          <F label="Currency"><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} /></F>
        </div>

        {/* Crew */}
        <div className="space-y-2">
          <Label className="text-xs">Crew assigned</Label>
          <div className="flex gap-2">
            <Input placeholder="Crew member name" value={crewInput} onChange={(e) => setCrewInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (crewInput.trim()) { setCrew([...crew, crewInput.trim()]); setCrewInput(""); } } }} />
            <Button type="button" variant="outline" onClick={() => { if (crewInput.trim()) { setCrew([...crew, crewInput.trim()]); setCrewInput(""); } }}>Add</Button>
          </div>
          {crew.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {crew.map((c, i) => (
                <Badge key={i} variant="secondary" className="gap-1">{c}
                  <button type="button" onClick={() => setCrew(crew.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Inventory */}
        <div className="space-y-2">
          <Label className="text-xs">Inventory</Label>
          <div className="grid grid-cols-12 gap-2">
            <Input placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              className="col-span-5" />
            <Input type="number" min={1} placeholder="Qty" value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} className="col-span-2" />
            <Input placeholder="Notes (e.g. fragile)" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              className="col-span-4" />
            <Button type="button" variant="outline" onClick={addItem} className="col-span-1 px-2">Add</Button>
          </div>
          {items.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-left px-3 py-2 w-20">Qty</th>
                    <th className="text-left px-3 py-2">Notes</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{it.name}</td>
                      <td className="px-3 py-2">{it.qty}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.notes ?? "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove item"><X className="h-3 w-3" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <F label="Notes"><Textarea rows={2} value={f.service_notes} onChange={(e) => set("service_notes", e.target.value)} placeholder="Special instructions, fragile items, access info…" /></F>

        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create moving job"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

type InvItem = { name: string; qty: number; notes?: string };

function EditInventoryForm({ rental, onDone }: { rental: any; onDone: () => void }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const initial: InvItem[] = Array.isArray(rental.inventory)
    ? rental.inventory.map((it: any) => ({ name: String(it.name ?? ""), qty: Number(it.qty ?? 1), notes: it.notes ?? "" }))
    : [];
  const [items, setItems] = useState<InvItem[]>(initial);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function addItem() {
    const n = name.trim();
    if (!n) return;
    setItems([...items, { name: n, qty: qty || 1, notes: notes.trim() || undefined }]);
    setName(""); setQty(1); setNotes("");
  }

  function update(i: number, patch: Partial<InvItem>) {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function save() {
    if (!isAdmin) return toast.error("Only super admin can edit inventory");
    setBusy(true);
    const cleaned = items
      .map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 1, notes: it.notes?.trim() || undefined }))
      .filter((it) => it.name.length > 0);
    const { error } = await supabase.from("rentals").update({ inventory: cleaned }).eq("id", rental.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Inventory updated");
    onDone();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit inventory</DialogTitle>
        <p className="text-xs text-muted-foreground">
          {rental.customers?.full_name ?? "Moving job"} · {rental.pickup_address} → {rental.destination_address}
        </p>
      </DialogHeader>

      {!isAdmin && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4" /> Only the super admin can edit inventory after creation.
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            className="col-span-5" />
          <Input type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(Number(e.target.value))}
            disabled={!isAdmin} className="col-span-2" />
          <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            disabled={!isAdmin}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            className="col-span-4" />
          <Button type="button" variant="outline" onClick={addItem} disabled={!isAdmin} className="col-span-1 px-2">Add</Button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">No inventory items yet.</div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-left px-3 py-2 w-24">Qty</th>
                  <th className="text-left px-3 py-2">Notes</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} disabled={!isAdmin} />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={1} value={it.qty} onChange={(e) => update(i, { qty: Number(e.target.value) })} disabled={!isAdmin} />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={it.notes ?? ""} onChange={(e) => update(i, { notes: e.target.value })} disabled={!isAdmin} placeholder="—" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" disabled={!isAdmin} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={save} disabled={!isAdmin || busy}>{busy ? "Saving…" : "Save inventory"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CloseRentalForm({ rental, onDone }: { rental: any; onDone: () => void }) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [reason, setReason] = useState<"completed" | "abandoned" | "breach_of_contract" | "other">("completed");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [releaseQty, setReleaseQty] = useState<Record<string, number>>({});
  const [recipient, setRecipient] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  const isStorage = rental.service_type === "storage";

  const { data: remainingItems, refetch: refetchItems } = useQuery({
    queryKey: ["rental-remaining-items", rental.id],
    enabled: isStorage,
    queryFn: async () => {
      const { data } = await supabase
        .from("stored_items")
        .select("id, name, item_code, qty, qty_released, customer_id")
        .eq("rental_id", rental.id);
      return (data ?? []).filter((it: any) => Number(it.qty) - Number(it.qty_released ?? 0) > 0);
    },
  });

  const hasRemaining = (remainingItems?.length ?? 0) > 0;
  const remainingCount = remainingItems?.reduce(
    (s: number, it: any) => s + (Number(it.qty) - Number(it.qty_released ?? 0)),
    0,
  ) ?? 0;

  const releaseTotal = Object.values(releaseQty).reduce((s, n) => s + (Number(n) || 0), 0);

  function setQty(id: string, max: number, val: string) {
    const n = Math.max(0, Math.min(max, Number(val) || 0));
    setReleaseQty((s) => ({ ...s, [id]: n }));
  }

  function selectAll() {
    const next: Record<string, number> = {};
    (remainingItems ?? []).forEach((it: any) => {
      next[it.id] = Number(it.qty) - Number(it.qty_released ?? 0);
    });
    setReleaseQty(next);
  }

  async function releaseSelected() {
    if (!isAdmin) return toast.error("Admin only");
    if (releaseTotal <= 0) return toast.error("Enter quantities to release");
    if (!recipient.trim()) return toast.error("Recipient name is required");
    setReleasing(true);
    const tId = toast.loading("Releasing items…");
    const { data: auth } = await supabase.auth.getUser();
    const actor = auth.user?.id ?? null;

    let okCount = 0;
    let failCount = 0;
    for (const it of remainingItems ?? []) {
      const q = Number(releaseQty[it.id] ?? 0);
      if (q <= 0) continue;
      const newReleased = Number(it.qty_released ?? 0) + q;
      const remainingAfter = Number(it.qty) - newReleased;
      const { error: uErr } = await supabase
        .from("stored_items")
        .update({
          qty_released: newReleased,
          status: remainingAfter === 0 ? "released" : "in_storage",
        })
        .eq("id", it.id);
      if (uErr) { failCount++; continue; }
      const { error: mErr } = await supabase.from("item_movements").insert({
        stored_item_id: it.id,
        rental_id: rental.id,
        customer_id: it.customer_id,
        movement_type: "release",
        qty_change: -q,
        qty_after: remainingAfter,
        notes: `Released to ${recipient}${releaseNotes ? ` — ${releaseNotes}` : ""}`,
        actor,
      });
      if (mErr) failCount++; else okCount++;
    }

    setReleasing(false);
    setReleaseQty({});
    await refetchItems();
    qc.invalidateQueries({ queryKey: ["stored-items"] });

    if (failCount === 0) {
      toast.success(`Released ${okCount} item record(s)`, { id: tId, description: `Recipient: ${recipient}` });
    } else {
      toast.error(`Released ${okCount}, failed ${failCount}`, { id: tId, description: "Check item logs for details" });
    }
  }

  function tryClose() {
    if (!isAdmin) return toast.error("Admin only");
    if (reason === "other" && !notes.trim()) {
      return toast.error("Please add a note explaining the reason");
    }
    if (reason === "completed" && hasRemaining) {
      return toast.error(
        `Cannot mark as completed — ${remainingCount} item(s) still in storage. Release them first or pick a different reason.`,
      );
    }
    setConfirmOpen(true);
  }

  async function submit() {
    setConfirmOpen(false);
    setBusy(true);
    const tId = toast.loading("Closing rental…");

    // Pre-check: re-read status to give an immediate clear message
    const { data: fresh, error: fErr } = await supabase
      .from("rentals")
      .select("status, closed_at")
      .eq("id", rental.id)
      .maybeSingle();
    if (fErr) {
      setBusy(false);
      toast.error("Could not verify rental status", { id: tId, description: fErr.message });
      return;
    }
    if (fresh?.status === "cancelled") {
      setBusy(false);
      toast.warning("Rental is already closed", {
        id: tId,
        description: fresh.closed_at ? `Closed on ${formatDate(fresh.closed_at)}` : "No further action needed",
      });
      onDone();
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("rentals")
      .update({
        status: "cancelled",
        closed_reason: reason,
        closed_notes: notes || null,
        closed_at: new Date().toISOString(),
        closed_by: auth.user?.id ?? null,
      })
      .eq("id", rental.id);
    if (error) {
      setBusy(false);
      const msg = error.message || "";
      if (/already closed/i.test(msg)) {
        toast.warning("Rental is already closed", {
          id: tId,
          description: "Another admin may have just closed it. Refreshing…",
        });
        onDone();
        return;
      }
      toast.error("Failed to close rental", { id: tId, description: msg });
      return;
    }
    let unitFreed = false;
    if (isStorage && rental.unit_id) {
      const { error: uErr } = await supabase
        .from("storage_units")
        .update({ status: "vacant" })
        .eq("id", rental.unit_id);
      unitFreed = !uErr;
    }
    setBusy(false);
    const desc = isStorage
      ? unitFreed
        ? `Reason: ${reason.replace(/_/g, " ")}. Unit marked vacant.`
        : `Reason: ${reason.replace(/_/g, " ")}. Note: unit status was not updated.`
      : `Reason: ${reason.replace(/_/g, " ")}.`;
    toast.success("Rental closed", { id: tId, description: desc });
    onDone();
  }

  const reasonLabels: Record<typeof reason, string> = {
    completed: "Completed — all items released",
    abandoned: "Abandoned — owner not responding",
    breach_of_contract: "Breach of contract — long overdue",
    other: "Other",
  };

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Close rental</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Closing will cancel this {isStorage ? "storage rental and free the unit" : "moving job"}. The reason and notes are recorded for audit.
        </p>
        {isStorage && (
          <div className={`rounded-md border p-3 text-xs ${hasRemaining ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-secondary/30 text-muted-foreground"}`}>
            {hasRemaining
              ? `⚠ ${remainingCount} item(s) still in storage across ${remainingItems?.length} record(s).`
              : "✓ No items remain in storage for this rental."}
          </div>
        )}

        {isStorage && hasRemaining && (
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-medium">Release items now</div>
              <Button type="button" size="sm" variant="ghost" onClick={selectAll} disabled={releasing}>Select all</Button>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y">
              {(remainingItems ?? []).map((it: any) => {
                const max = Number(it.qty) - Number(it.qty_released ?? 0);
                return (
                  <div key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.item_code} · {max} in storage</div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      value={releaseQty[it.id] ?? ""}
                      placeholder="0"
                      className="w-20 h-8"
                      onChange={(e) => setQty(it.id, max, e.target.value)}
                      disabled={releasing}
                    />
                    <span className="text-xs text-muted-foreground w-10">/ {max}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 p-3 border-t">
              <F label="Recipient *">
                <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Name receiving items" disabled={releasing} />
              </F>
              <F label="Release notes">
                <Input value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="Condition, ID, etc." disabled={releasing} />
              </F>
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t bg-secondary/30">
              <div className="text-xs text-muted-foreground">Total to release: <strong className="text-foreground">{releaseTotal}</strong></div>
              <Button type="button" size="sm" onClick={releaseSelected} disabled={!isAdmin || releasing || releaseTotal <= 0}>
                {releasing ? "Releasing…" : "Release selected"}
              </Button>
            </div>
          </div>
        )}

        <F label="Reason">
          <Select value={reason} onValueChange={(v) => setReason(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed — all items released to owner</SelectItem>
              <SelectItem value="abandoned">Abandoned — owner not responding</SelectItem>
              <SelectItem value="breach_of_contract">Breach of contract — long overdue</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label={`Notes${reason === "other" ? " *" : ""}`}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, agreement clause, communication attempts…" rows={4} />
        </F>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>
        <Button variant="destructive" onClick={tryClose} disabled={!isAdmin || busy}>
          {busy ? "Closing…" : "Close rental"}
        </Button>
      </DialogFooter>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this rental?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium text-foreground">{rental.customers?.full_name ?? "—"}</span></div>
                {isStorage && (
                  <div><span className="text-muted-foreground">Unit:</span> <span className="font-medium text-foreground">{rental.storage_units?.unit_code ?? "—"}</span></div>
                )}
                <div><span className="text-muted-foreground">Reason:</span> <span className="font-medium text-foreground">{reasonLabels[reason]}</span></div>
                {notes && <div className="text-muted-foreground italic">"{notes}"</div>}
                <div className="pt-2 text-destructive">
                  This sets the rental to <strong>cancelled</strong>{isStorage ? " and frees the unit" : ""}. This action cannot be undone from the UI.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={submit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, close rental
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  );
}
