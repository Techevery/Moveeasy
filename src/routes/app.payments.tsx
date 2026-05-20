import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Check, X, Clock, Upload, Receipt as ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { generateReceiptForPayment, downloadBlob } from "@/lib/billing-pdf";

export const Route = createFileRoute("/app/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState<any | null>(null);

  const { data: canApprove } = useQuery({
    queryKey: ["can-approve", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return (data ?? []).some((r: any) => r.role === "admin" || r.role === "payment_approver");
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, customers(full_name), rentals(storage_units(unit_code))")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-sm text-muted-foreground">
            Record transactions and approve pending receipts
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Record payment
            </Button>
          </DialogTrigger>
          <PaymentForm
            canApprove={!!canApprove}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["payments"] });
            }}
          />
        </Dialog>
      </div>

      {!canApprove && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Payments you record will be marked <strong>Pending approval</strong> until a super
          admin or designated approver reviews them.
        </div>
      )}

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Unit</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Receipt</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(payments?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
                {payments?.map((p: any) => (
                  <tr key={p.id} className="border-t hover:bg-secondary/30">
                    <td className="px-4 py-3">{formatDate(p.paid_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      {p.customers?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.rentals?.storage_units?.unit_code ?? "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {p.method.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {p.receipt_url ? (
                        <ReceiptLink path={p.receipt_url} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === "paid" && <ReceiptButton paymentId={p.id} />}
                        {p.status === "pending_approval" && canApprove && (
                          <Button size="sm" variant="outline" onClick={() => setReviewing(p)}>
                            Review
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ReviewDialog
        payment={reviewing}
        onClose={() => setReviewing(null)}
        onDone={() => {
          setReviewing(null);
          qc.invalidateQueries({ queryKey: ["payments"] });
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending_approval") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3 mr-1" /> Pending approval
      </Badge>
    );
  }
  if (status === "paid") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">Paid</Badge>;
  if (status === "failed") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function ReceiptLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.storage.from("receipts").createSignedUrl(path, 300).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
    >
      <FileText className="h-3 w-3" /> View
    </a>
  );
}

function ReviewDialog({
  payment,
  onClose,
  onDone,
}: {
  payment: any | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNotes(payment?.approval_notes ?? "");
  }, [payment]);

  if (!payment) return null;

  async function decide(approve: boolean) {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("payments")
      .update({
        status: approve ? "paid" : "failed",
        approved_by: auth.user?.id,
        approved_at: new Date().toISOString(),
        approval_notes: notes || null,
      })
      .eq("id", payment.id);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    if (approve) {
      try {
        await generateReceiptForPayment(payment.id);
      } catch (e: any) {
        toast.error(`Receipt PDF failed: ${e.message ?? e}`);
      }
    }
    setBusy(false);
    toast.success(approve ? "Payment approved" : "Payment rejected");
    onDone();
  }

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review payment</DialogTitle>
          <DialogDescription>
            {payment.customers?.full_name ?? "Customer"} ·{" "}
            {formatMoney(payment.amount, payment.currency)} ·{" "}
            {payment.method.replace("_", " ")}
          </DialogDescription>
        </DialogHeader>

        {payment.receipt_url ? (
          <div className="rounded-md border p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Receipt attached</span>
            <ReceiptLink path={payment.receipt_url} />
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No receipt was uploaded with this payment.
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Approval / rejection notes</Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional reason or comment"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => decide(false)}
            disabled={busy}
          >
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
          <Button onClick={() => decide(true)} disabled={busy}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ canApprove, onDone }: { canApprove: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { data: rentals } = useQuery({
    queryKey: ["rentals-list"],
    queryFn: async () =>
      (
        await supabase
          .from("rentals")
          .select("id, customer_id, currency, customers(full_name), storage_units(unit_code)")
          .eq("status", "active")
      ).data ?? [],
  });

  const [f, setF] = useState({
    rental_id: "",
    customer_id: "",
    amount: 0,
    discount: 0,
    balance: 0,
    currency: "NGN",
    method: "cash" as "cash" | "pos" | "bank_transfer" | "online",
    reference: "",
    notes: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 10 * 1024 * 1024) {
      toast.error("Receipt must be under 10MB");
      return;
    }
    if (
      f &&
      !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(f.type)
    ) {
      toast.error("Receipt must be an image or PDF");
      return;
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.rental_id) return toast.error("Choose a rental");
    if (f.amount <= 0) return toast.error("Amount must be greater than 0");

    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setBusy(false);
      return toast.error("Not signed in");
    }

    let receiptPath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) {
        setBusy(false);
        return toast.error(`Receipt upload failed: ${up.error.message}`);
      }
      receiptPath = path;
    }

    const { data: ins, error } = await supabase.from("payments").insert({
      ...f,
      // Approvers can mark paid directly; everyone else gets forced to pending_approval by trigger.
      status: canApprove ? "paid" : "pending_approval",
      receipt_url: receiptPath,
      recorded_by: uid,
      paid_at: new Date().toISOString(),
    }).select("id, status").single();

    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    if (ins?.status === "paid") {
      try { await generateReceiptForPayment(ins.id); }
      catch (e: any) { toast.error(`Receipt PDF failed: ${e.message ?? e}`); }
    }
    setBusy(false);
    toast.success(
      canApprove ? "Payment recorded" : "Payment submitted for approval",
    );
    onDone();
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          {canApprove
            ? "You can approve this payment immediately or leave it pending."
            : "Submitted payments are queued for approval by a super admin or approver."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Rental *">
          <Select
            value={f.rental_id}
            onValueChange={(v) => {
              set("rental_id", v);
              const r = rentals?.find((x: any) => x.id === v);
              if (r) {
                set("customer_id", r.customer_id);
                set("currency", r.currency);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select active rental" />
            </SelectTrigger>
            <SelectContent>
              {rentals?.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.customers?.full_name} — {r.storage_units?.unit_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Amount *">
            <Input
              type="number"
              required
              min={0}
              step="0.01"
              value={f.amount}
              onChange={(e) => set("amount", Number(e.target.value))}
            />
          </Field>
          <Field label="Currency">
            <Input value={f.currency} onChange={(e) => set("currency", e.target.value)} />
          </Field>
          <Field label="Discount">
            <Input
              type="number"
              value={f.discount}
              onChange={(e) => set("discount", Number(e.target.value))}
            />
          </Field>
          <Field label="Balance">
            <Input
              type="number"
              value={f.balance}
              onChange={(e) => set("balance", Number(e.target.value))}
            />
          </Field>
          <Field label="Method">
            <Select value={f.method} onValueChange={(v) => set("method", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["cash", "pos", "bank_transfer", "online"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference">
            <Input
              value={f.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="Transfer ref, POS ID…"
            />
          </Field>
        </div>

        <Field label="Receipt (optional, image or PDF, max 10MB)">
          <label className="flex items-center gap-3 rounded-md border border-dashed px-3 py-3 cursor-pointer hover:bg-muted/40 transition">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm truncate">
              {file ? file.name : "Click to attach a receipt"}
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={onFileChange}
            />
          </label>
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : canApprove ? "Record" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ReceiptButton({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      // Try to find existing generated receipt document first
      const { data: existing } = await supabase
        .from("documents")
        .select("storage_path, doc_number")
        .eq("payment_id", paymentId)
        .eq("kind", "receipt")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.storage_path) {
        const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(existing.storage_path, 300);
        if (signed?.signedUrl) {
          window.open(signed.signedUrl, "_blank");
          setBusy(false);
          return;
        }
      }
      const res = await generateReceiptForPayment(paymentId);
      downloadBlob(res.blob, `${res.number}.pdf`);
      toast.success("Receipt generated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate receipt");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={go} disabled={busy} title="Receipt PDF">
      <ReceiptIcon className="h-4 w-4 mr-1" /> {busy ? "…" : "Receipt"}
    </Button>
  );
}
