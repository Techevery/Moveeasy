import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, PackageOpen, Plus, FileDown, History, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { generateWaybillPdf } from "@/server/waybills.functions";

type Rental = { id: string; service_type: string; storage_units?: { name?: string; unit_code?: string } | null };

export function StoredItemsPanel({ customerId, customerName, rentals }: {
  customerId: string;
  customerName: string;
  rentals: Rental[];
}) {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [canRelease, setCanRelease] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // role === admin OR has payment_approver role
  useEffect(() => {
    let active = true;
    (async () => {
      if (role === "admin") { if (active) setCanRelease(true); return; }
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (active) setCanRelease((data ?? []).some((r: any) => r.role === "admin" || r.role === "payment_approver"));
    })();
    return () => { active = false; };
  }, [user, role]);

  const storageRentals = rentals.filter((r) => r.service_type === "storage");

  const { data: items } = useQuery({
    queryKey: ["stored-items", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stored_items")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: releases } = useQuery({
    queryKey: ["item-releases", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_releases")
        .select("*")
        .eq("customer_id", customerId)
        .order("released_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remaining = (it: any) => Number(it.qty) - Number(it.qty_released);
  const inStorage = (items ?? []).filter((it: any) => remaining(it) > 0);

  async function downloadWaybill(path: string) {
    const { data, error } = await supabase.storage.from("waybills").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not open waybill");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2"><Boxes className="h-4 w-4" /> Stored items ({inStorage.length})</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-1" /> Movement log
          </Button>
          <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={storageRentals.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Add item
              </Button>
            </DialogTrigger>
            {intakeOpen && (
              <IntakeForm
                customerId={customerId}
                rentals={storageRentals}
                onDone={() => {
                  setIntakeOpen(false);
                  qc.invalidateQueries({ queryKey: ["stored-items", customerId] });
                }}
              />
            )}
          </Dialog>
          <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canRelease || inStorage.length === 0}>
                <PackageOpen className="h-4 w-4 mr-1" /> Release items
              </Button>
            </DialogTrigger>
            {releaseOpen && (
              <ReleaseForm
                customerId={customerId}
                customerName={customerName}
                items={inStorage}
                onDone={() => {
                  setReleaseOpen(false);
                  qc.invalidateQueries({ queryKey: ["stored-items", customerId] });
                  qc.invalidateQueries({ queryKey: ["item-releases", customerId] });
                }}
              />
            )}
          </Dialog>
        </div>
      </div>

      {!canRelease && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Lock className="h-3 w-3" /> Releasing items is restricted to admins and approved staff.
        </p>
      )}

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">In storage / Total</th>
                <th className="text-left px-3 py-2">Condition</th>
                <th className="text-left px-3 py-2">Intake</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(items?.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No items recorded.</td></tr>
              )}
              {items?.map((it: any) => {
                const left = remaining(it);
                return (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{it.item_code}</td>
                    <td className="px-3 py-2 font-medium">{it.name}{it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}</td>
                    <td className="px-3 py-2">{left} / {it.qty}</td>
                    <td className="px-3 py-2 text-muted-foreground">{it.condition ?? "—"}</td>
                    <td className="px-3 py-2">{formatDate(it.intake_date)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={it.status === "released" ? "outline" : it.status === "partially_released" ? "secondary" : "secondary"}>
                        {it.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin ? (
                        <Button variant="ghost" size="sm" onClick={() => setEditItem(it)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      ) : (
                        <span className="inline-flex items-center text-xs text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Admin</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {(releases?.length ?? 0) > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-2">Past releases</h4>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2">Waybill #</th>
                  <th className="text-left px-3 py-2">Recipient</th>
                  <th className="text-left px-3 py-2">Released</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {releases?.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.waybill_number}</td>
                    <td className="px-3 py-2">{r.recipient_name}{r.recipient_phone && <span className="text-muted-foreground"> · {r.recipient_phone}</span>}</td>
                    <td className="px-3 py-2">{formatDate(r.released_at)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.waybill_url ? (
                        <Button variant="ghost" size="sm" onClick={() => downloadWaybill(r.waybill_url)}>
                          <FileDown className="h-3.5 w-3.5 mr-1" /> Waybill
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">no PDF</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        {historyOpen && <MovementLog customerId={customerId} />}
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        {editItem && (
          <EditItemForm
            item={editItem}
            customerId={customerId}
            onDone={() => {
              setEditItem(null);
              qc.invalidateQueries({ queryKey: ["stored-items", customerId] });
              qc.invalidateQueries({ queryKey: ["item-movements", customerId] });
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

function IntakeForm({ customerId, rentals, onDone }: { customerId: string; rentals: Rental[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    rental_id: rentals[0]?.id ?? "",
    name: "",
    qty: 1,
    condition: "",
    notes: "",
    intake_date: new Date().toISOString().slice(0, 10),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.rental_id || !f.name.trim()) return toast.error("Rental and item name required");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("stored_items").insert({
      rental_id: f.rental_id,
      customer_id: customerId,
      name: f.name.trim(),
      qty: f.qty,
      condition: f.condition || null,
      notes: f.notes || null,
      intake_date: f.intake_date,
      created_by: auth.user?.id,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Item added to storage");
    onDone();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Add stored item</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Storage rental</Label>
          <Select value={f.rental_id} onValueChange={(v) => set("rental_id", v)}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>
              {rentals.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.storage_units?.unit_code ?? "—"} · {r.storage_units?.name ?? "Unit"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Item name *</Label>
            <Input required value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Qty *</Label>
            <Input type="number" min={1} required value={f.qty} onChange={(e) => set("qty", Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Condition</Label>
            <Input placeholder="e.g. Good, scratched" value={f.condition} onChange={(e) => set("condition", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Intake date</Label>
            <Input type="date" value={f.intake_date} onChange={(e) => set("intake_date", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add item"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ReleaseForm({ customerId, customerName, items, onDone }: {
  customerId: string;
  customerName: string;
  items: any[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState({ name: "", phone: "", id_type: "", id_number: "" });
  const [notes, setNotes] = useState("");
  const [conditionOnRelease, setConditionOnRelease] = useState("");
  const [picks, setPicks] = useState<Record<string, number>>({}); // stored_item_id -> qty

  function setPick(id: string, qty: number, max: number) {
    const v = Math.max(0, Math.min(qty, max));
    setPicks((p) => ({ ...p, [id]: v }));
  }

  const totalPicked = Object.values(picks).reduce((s, n) => s + n, 0);
  const rentalId = items[0]?.rental_id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (totalPicked === 0) return toast.error("Select at least one item to release");
    if (!recipient.name.trim()) return toast.error("Recipient name required");
    if (!user) return toast.error("Not signed in");

    setBusy(true);
    try {
      // Resolve released-by name
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const releasedByName = profile?.full_name ?? user.email ?? "Staff";

      const waybillNumber = `WB-${Date.now().toString(36).toUpperCase()}`;
      const releaseId = crypto.randomUUID();

      // Insert release
      const { error: relErr } = await supabase.from("item_releases").insert({
        id: releaseId,
        rental_id: rentalId,
        customer_id: customerId,
        waybill_number: waybillNumber,
        recipient_name: recipient.name.trim(),
        recipient_phone: recipient.phone || null,
        recipient_id_type: recipient.id_type || null,
        recipient_id_number: recipient.id_number || null,
        notes: notes || null,
        condition_on_release: conditionOnRelease || null,
        released_by: user.id,
      });
      if (relErr) throw relErr;

      // For each picked item: update qty_released + status, log movement
      const releasedLines: { stored_item_id: string; name: string; qty: number; condition?: string | null; notes?: string | null }[] = [];
      for (const it of items) {
        const qty = picks[it.id] ?? 0;
        if (qty <= 0) continue;
        const newReleased = Number(it.qty_released) + qty;
        const remaining = Number(it.qty) - newReleased;
        const status = remaining <= 0 ? "released" : "partially_released";

        const { error: updErr } = await supabase
          .from("stored_items")
          .update({ qty_released: newReleased, status })
          .eq("id", it.id);
        if (updErr) throw updErr;

        const { error: logErr } = await supabase.from("item_movements").insert({
          stored_item_id: it.id,
          rental_id: it.rental_id,
          customer_id: customerId,
          release_id: releaseId,
          movement_type: "release",
          qty_change: -qty,
          qty_after: remaining,
          notes: `Released to ${recipient.name} (${waybillNumber})`,
          actor: user.id,
        });
        if (logErr) throw logErr;

        releasedLines.push({
          stored_item_id: it.id,
          name: it.name,
          qty,
          condition: it.condition,
          notes: it.notes,
        });
      }

      // Generate + upload waybill PDF
      const wbRes = await generateWaybillPdf({
        data: {
          release_id: releaseId,
          rental_id: rentalId,
          customer_id: customerId,
          waybill_number: waybillNumber,
          recipient_name: recipient.name.trim(),
          recipient_phone: recipient.phone || null,
          recipient_id_type: recipient.id_type || null,
          recipient_id_number: recipient.id_number || null,
          notes: notes || null,
          condition_on_release: conditionOnRelease || null,
          customer_name: customerName,
          released_by_name: releasedByName,
          released_at: new Date().toISOString(),
          items: releasedLines,
        },
      }).catch((e: any) => {
        // Server middleware throws Response on auth fail; surface a real message
        const msg = e instanceof Response ? `Server error (${e.status})` : (e?.message ?? "Waybill request failed");
        return { ok: false as const, error: msg };
      });

      if (!wbRes?.ok) {
        toast.warning(`Items released, but waybill failed: ${wbRes?.error ?? "unknown error"}`);
      } else {
        toast.success(`Released. Waybill ${waybillNumber} generated.`);
      }
      onDone();
    } catch (err: any) {
      const msg = err instanceof Response ? `Server error (${err.status})` : (err?.message ?? "Release failed");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Release items to owner</DialogTitle>
        <p className="text-xs text-muted-foreground">A waybill PDF will be generated and stored automatically.</p>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2 w-28">Available</th>
                <th className="text-left px-3 py-2 w-32">Release qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const max = Number(it.qty) - Number(it.qty_released);
                return (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{it.name}</td>
                    <td className="px-3 py-2">{max}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        value={picks[it.id] ?? 0}
                        onChange={(e) => setPick(it.id, Number(e.target.value), max)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Recipient name *</Label>
            <Input required value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recipient phone</Label>
            <Input value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ID type</Label>
            <Input placeholder="e.g. NIN, Driver's License" value={recipient.id_type} onChange={(e) => setRecipient({ ...recipient, id_type: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ID number</Label>
            <Input value={recipient.id_number} onChange={(e) => setRecipient({ ...recipient, id_number: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Condition on release</Label>
          <Input placeholder="e.g. Items handed over in good condition" value={conditionOnRelease} onChange={(e) => setConditionOnRelease(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={busy || totalPicked === 0}>
            {busy ? "Releasing…" : `Release ${totalPicked} item${totalPicked === 1 ? "" : "s"} & generate waybill`}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MovementLog({ customerId }: { customerId: string }) {
  const { data } = useQuery({
    queryKey: ["item-movements", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_movements")
        .select("*, stored_items(name)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Item movement log</DialogTitle></DialogHeader>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Change</th>
              <th className="text-left px-3 py-2">After</th>
              <th className="text-left px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {(data?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No movements yet.</td></tr>
            )}
            {data?.map((m: any) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 text-xs">{new Date(m.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{m.stored_items?.name ?? "—"}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{m.movement_type}</Badge></td>
                <td className={`px-3 py-2 font-medium ${m.qty_change < 0 ? "text-destructive" : "text-foreground"}`}>{m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}</td>
                <td className="px-3 py-2">{m.qty_after}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{m.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DialogContent>
  );
}

function EditItemForm({ item, customerId, onDone }: { item: any; customerId: string; onDone: () => void }) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const released = Number(item.qty_released);
  const [qty, setQty] = useState<number>(Number(item.qty));
  const [condition, setCondition] = useState<string>(item.condition ?? "");
  const [notes, setNotes] = useState<string>(item.notes ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const qtyDelta = qty - Number(item.qty);
  const remainingAfter = qty - released;
  const newStatus = remainingAfter <= 0 ? "released" : released > 0 ? "partially_released" : "in_storage";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !user) return toast.error("Only admins can edit items");
    if (qty < released) return toast.error(`Quantity cannot be less than ${released} (already released)`);

    const qtyChanged = qty !== Number(item.qty);
    const conditionChanged = (condition || null) !== (item.condition ?? null);
    const notesChanged = (notes || null) !== (item.notes ?? null);

    if (!qtyChanged && !conditionChanged && !notesChanged) {
      return toast.info("Nothing to update");
    }
    if (qtyChanged && !reason.trim()) {
      return toast.error("Please provide a reason for the quantity change");
    }

    setBusy(true);
    try {
      const { error: updErr } = await supabase
        .from("stored_items")
        .update({
          qty,
          condition: condition || null,
          notes: notes || null,
          status: newStatus,
        })
        .eq("id", item.id);
      if (updErr) throw updErr;

      // Always log when something changed
      const changeNotes: string[] = [];
      if (qtyChanged) changeNotes.push(`Qty ${item.qty} → ${qty}${reason ? ` (${reason})` : ""}`);
      if (conditionChanged) changeNotes.push(`Condition: "${item.condition ?? "—"}" → "${condition || "—"}"`);
      if (notesChanged) changeNotes.push(`Notes updated`);

      const { error: logErr } = await supabase.from("item_movements").insert({
        stored_item_id: item.id,
        rental_id: item.rental_id,
        customer_id: customerId,
        movement_type: "adjustment",
        qty_change: qtyDelta,
        qty_after: remainingAfter,
        notes: changeNotes.join(" · ") || "Item edited",
        actor: user.id,
      });
      if (logErr) throw logErr;

      toast.success("Item updated");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit stored item</DialogTitle>
        <p className="text-xs text-muted-foreground">{item.name} · {released} of {item.qty} already released</p>
      </DialogHeader>

      {!isAdmin && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4" /> Only the super admin can edit stored items.
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Total quantity</Label>
            <Input
              type="number"
              min={released}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              Remaining after change: {Math.max(0, remainingAfter)} · status will be{" "}
              <span className="font-medium">{newStatus.replace("_", " ")}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Condition</Label>
            <Input value={condition} onChange={(e) => setCondition(e.target.value)} disabled={!isAdmin} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isAdmin} />
        </div>

        {qtyDelta !== 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Reason for quantity change *</Label>
            <Input
              required
              placeholder="e.g. Recount correction, damaged item written off"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              An adjustment of <span className={`font-medium ${qtyDelta < 0 ? "text-destructive" : "text-foreground"}`}>{qtyDelta > 0 ? `+${qtyDelta}` : qtyDelta}</span> will be recorded in the movement log.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="submit" disabled={!isAdmin || busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
