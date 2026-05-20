import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileSignature } from "lucide-react";
const AGREEMENT_VERSION = "v1";
const AGREEMENT_URL = "https://zwcynryvcscsxtnuzwyw.supabase.co/storage/v1/object/public/app-assets/storage-agreement.pdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/Brand";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { LogOut, Boxes, CalendarClock, CreditCard, Package, FileDown, History, FileText, Lock } from "lucide-react";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { toast } from "sonner";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: "My storage — MoveEasy" }] }),
  component: PortalPage,
});

function PortalPage() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [movementLogOpen, setMovementLogOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [submittingAck, setSubmittingAck] = useState(false);
  const [renterForm, setRenterForm] = useState({
    full_name: "",
    address: "",
    rental_start_date: "",
    rental_months: "",
    rent_amount: "",
    rent_months: "",
    surname: "",
    other_names: "",
    guarantor_name: "",
    guarantor_address: "",
    guarantor_phone: "",
    guarantor_occupation: "",
    guarantor_company: "",
    guarantor_id: "",
    guarantor_email: "",
    declaration_known_years: "",
    declaration_relationship: "",
    signature_name: "",
    signature_date: "",
  });

  // Close any open dialogs when the user signs out / loses session
  useEffect(() => {
    if (!user) {
      setSelectedItemId(null);
      setMovementLogOpen(false);
      setAgreementOpen(false);
    }
  }, [user]);

  const { data: acknowledgement, isLoading: ackLoading } = useQuery({
    queryKey: ["my-agreement-ack", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase
      .from("agreement_acknowledgements")
      .select("*")
      .eq("user_id", user!.id)
      .eq("agreement_version", AGREEMENT_VERSION)
      .maybeSingle()).data,
  });

  const requiredRenterFields: (keyof typeof renterForm)[] = useMemo(
    () => ["full_name", "address", "rental_start_date", "rental_months", "rent_amount", "signature_name", "signature_date"],
    []
  );
  const renterFormValid = requiredRenterFields.every((k) => renterForm[k].trim().length > 0);

  async function submitAcknowledgement() {
    if (!user || !agreementChecked || !renterFormValid) return;
    setSubmittingAck(true);
    try {
      const { error } = await supabase.from("agreement_acknowledgements").insert({
        user_id: user.id,
        customer_id: customer?.id ?? null,
        agreement_version: AGREEMENT_VERSION,
        renter_data: renterForm,
      });
      if (error) throw error;
      toast.success("Storage agreement acknowledged");
      setAgreementOpen(false);
      qc.invalidateQueries({ queryKey: ["my-agreement-ack", user.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save acknowledgement");
    } finally {
      setSubmittingAck(false);
    }
  }

  const { data: customer } = useQuery({
    queryKey: ["my-customer", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("customers").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });

  // Prefill renter form with customer info when dialog opens
  useEffect(() => {
    if (agreementOpen && customer) {
      setRenterForm((prev) => ({
        ...prev,
        full_name: prev.full_name || customer.full_name || "",
        address: prev.address || customer.address || "",
        signature_name: prev.signature_name || customer.full_name || "",
      }));
    }
  }, [agreementOpen, customer]);

  const { data: rentals } = useQuery({
    queryKey: ["my-rentals", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => (await supabase
      .from("rentals")
      .select("*, storage_units(name, unit_code, dimensions, size)")
      .eq("customer_id", customer!.id)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: payments } = useQuery({
    queryKey: ["my-payments", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => (await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", customer!.id)
      .order("paid_at", { ascending: false })
      .limit(10)).data ?? [],
  });

  const { data: storedItems } = useQuery({
    queryKey: ["my-stored-items", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => (await supabase
      .from("stored_items")
      .select("*, rentals(storage_units(name, unit_code))")
      .eq("customer_id", customer!.id)
      .order("intake_date", { ascending: false })).data ?? [],
  });

  const { data: releases } = useQuery({
    queryKey: ["my-releases", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => (await supabase
      .from("item_releases")
      .select("*")
      .eq("customer_id", customer!.id)
      .order("released_at", { ascending: false })).data ?? [],
  });

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <header className="bg-background border-b">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Brand />
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 sm:px-6 py-16">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-8 text-center space-y-4">
              <div className="size-12 mx-auto rounded-full bg-accent text-accent-foreground grid place-items-center">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Sign in to view your storage</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Item details, movement history, and waybills are only available to signed-in customers.
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <Button onClick={() => nav({ to: "/auth" })}>Sign in</Button>
                <Button variant="outline" onClick={() => nav({ to: "/" })}>Back home</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Brand />
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back{customer?.full_name ? `, ${customer.full_name.split(" ")[0]}` : ""}</h1>
          <p className="text-sm text-muted-foreground">Your storage at a glance</p>
        </div>

        {user && !ackLoading && (
          <Card className={`shadow-[var(--shadow-card)] border-l-4 ${acknowledgement ? "border-l-primary" : "border-l-destructive"}`}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-accent text-accent-foreground grid place-items-center shrink-0">
                  <FileSignature className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Storage Agreement</p>
                  <p className="text-xs text-muted-foreground">
                    {acknowledgement
                      ? `Acknowledged on ${formatDate(acknowledgement.acknowledged_at)} (version ${acknowledgement.agreement_version}).`
                      : "Please review and acknowledge the storage agreement to keep your account in good standing."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={AGREEMENT_URL} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-1" /> View PDF
                  </a>
                </Button>
                <Button size="sm" onClick={() => { setAgreementChecked(false); setAgreementOpen(true); }}>
                  {acknowledgement ? "Review again" : "Review & acknowledge"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!customer ? (
          <ClaimLinkCodeCard onLinked={() => qc.invalidateQueries({ queryKey: ["my-customer", user?.id] })} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat icon={Boxes} label="Active rentals" value={(rentals ?? []).filter((r) => r.status === "active").length} />
              <Stat icon={CalendarClock} label="Next expiry" value={(rentals ?? [])[0] ? formatDate((rentals as any)[0].end_date) : "—"} />
              <Stat icon={CreditCard} label="Total paid" value={formatMoney((payments ?? []).reduce((s, p: any) => s + Number(p.amount), 0), customer?.email ? "NGN" : "NGN")} />
            </div>

            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader><CardTitle>My units</CardTitle></CardHeader>
              <CardContent>
                {(rentals?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No rentals yet.</p>
                ) : (
                  <div className="space-y-3">
                    {rentals!.map((r: any) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b last:border-0 pb-3 last:pb-0">
                        <div>
                          <p className="font-semibold">{r.storage_units?.name} <span className="text-xs text-muted-foreground">({r.storage_units?.unit_code})</span></p>
                          <p className="text-xs text-muted-foreground">
                            {r.storage_units?.size} · {r.storage_units?.dimensions ?? "—"} · {formatDate(r.start_date)} → {formatDate(r.end_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatMoney(r.rate, r.currency)}<span className="text-xs text-muted-foreground">/{r.billing_cycle}</span></span>
                          <Badge variant={r.status === "active" ? "secondary" : r.status === "overdue" ? "destructive" : "outline"}>{r.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)]">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> My stored items</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setMovementLogOpen(true)}>
                  <History className="h-4 w-4 mr-1" /> Movement log
                </Button>
              </CardHeader>
              <CardContent>
                {(storedItems?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No items recorded in storage yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                        <tr>
                          <th className="text-left px-3 py-2">Code</th>
                          <th className="text-left px-3 py-2">Item</th>
                          <th className="text-left px-3 py-2">Unit</th>
                          <th className="text-left px-3 py-2">In storage / Total</th>
                          <th className="text-left px-3 py-2">Released</th>
                          <th className="text-left px-3 py-2">Condition</th>
                          <th className="text-left px-3 py-2">Intake</th>
                          <th className="text-left px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storedItems!.map((it: any) => {
                          const remaining = (it.qty ?? 0) - (it.qty_released ?? 0);
                          return (
                            <tr key={it.id} className="border-t align-top hover:bg-secondary/40 cursor-pointer" onClick={() => setSelectedItemId(it.id)}>
                              <td className="px-3 py-2 font-mono text-xs">{it.item_code}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{it.name}</div>
                                {it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {it.rentals?.storage_units?.name ? (
                                  <>
                                    {it.rentals.storage_units.name}
                                    <span className="text-muted-foreground"> ({it.rentals.storage_units.unit_code})</span>
                                  </>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2"><span className="font-semibold">{remaining}</span> / {it.qty}</td>
                              <td className="px-3 py-2 text-muted-foreground">{it.qty_released ?? 0}</td>
                              <td className="px-3 py-2 text-muted-foreground">{it.condition ?? "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{formatDate(it.intake_date)}</td>
                              <td className="px-3 py-2">
                                <Badge
                                  variant={it.status === "released" ? "outline" : "secondary"}
                                  className="capitalize"
                                >
                                  {String(it.status).replace("_", " ")}
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

            {(releases?.length ?? 0) > 0 && (
              <Card className="shadow-[var(--shadow-card)]">
                <CardHeader><CardTitle className="flex items-center gap-2"><FileDown className="h-4 w-4" /> Past releases</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
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
                        {releases!.map((r: any) => (
                          <tr key={r.id} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{r.waybill_number}</td>
                            <td className="px-3 py-2">
                              {r.recipient_name}
                              {r.recipient_phone && <span className="text-muted-foreground"> · {r.recipient_phone}</span>}
                            </td>
                            <td className="px-3 py-2">{formatDate(r.released_at)}</td>
                            <td className="px-3 py-2 text-right">
                              {r.waybill_url ? (
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  const { data: signed, error } = await supabase.storage.from("waybills").createSignedUrl(r.waybill_url, 60);
                                  if (error || !signed?.signedUrl) return toast.error(error?.message ?? "Could not open waybill");
                                  window.open(signed.signedUrl, "_blank");
                                }}>
                                  <FileDown className="h-3.5 w-3.5 mr-1" /> Waybill
                                </Button>
                              ) : <span className="text-xs text-muted-foreground">no PDF</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-[var(--shadow-card)]">

              <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
              <CardContent>
                {(payments?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left py-2">Date</th>
                          <th className="text-left py-2">Method</th>
                          <th className="text-left py-2">Amount</th>
                          <th className="text-left py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments!.map((p: any) => (
                          <tr key={p.id} className="border-t">
                            <td className="py-2">{formatDate(p.paid_at)}</td>
                            <td className="py-2 capitalize">{p.method.replace("_", " ")}</td>
                            <td className="py-2 font-semibold">{formatMoney(p.amount, p.currency)}</td>
                            <td className="py-2"><Badge variant={p.status === "paid" ? "secondary" : "outline"}>{p.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <DocumentsPanel customerId={customer.id} readOnly title="My documents" />
          </>
        )}

        <p className="text-xs text-muted-foreground text-center pt-4">
          Need help? <Link to="/" className="underline">Contact support</Link>
        </p>
      </main>

      <ItemDetailsDialog
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
      />

      <Dialog open={movementLogOpen} onOpenChange={setMovementLogOpen}>
        {movementLogOpen && customer && <CustomerMovementLog customerId={customer.id} />}
      </Dialog>

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" /> Storage Agreement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-secondary/30 overflow-hidden h-[50vh]">
              <object
                data={`${AGREEMENT_URL}#view=FitH&toolbar=1`}
                type="application/pdf"
                className="w-full h-full"
                aria-label="Storage Agreement PDF"
              >
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(AGREEMENT_URL)}&embedded=true`}
                  title="Storage Agreement"
                  className="w-full h-full"
                />
              </object>
            </div>
            <p className="text-xs text-muted-foreground">
              Can't see the document?{" "}
              <a href={AGREEMENT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                Open in a new tab
              </a>.
            </p>

            {acknowledgement ? (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                You acknowledged this agreement on{" "}
                <span className="font-medium">{formatDate(acknowledgement.acknowledged_at)}</span>.
              </div>
            ) : (
              <>
                <div className="rounded-md border p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm">Renter details</h3>
                    <p className="text-xs text-muted-foreground">
                      Fill in the blanks of the agreement that apply to you. Fields marked * are required.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-name">Renter's full name *</Label>
                      <Input id="ag-name" maxLength={120} value={renterForm.full_name}
                        onChange={(e) => setRenterForm((p) => ({ ...p, full_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ag-addr">Renter's address *</Label>
                      <Textarea id="ag-addr" maxLength={300} rows={2} value={renterForm.address}
                        onChange={(e) => setRenterForm((p) => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-start">Rental start date *</Label>
                      <Input id="ag-start" type="date" value={renterForm.rental_start_date}
                        onChange={(e) => setRenterForm((p) => ({ ...p, rental_start_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-months">Rental period (months) *</Label>
                      <Input id="ag-months" type="number" min={1} max={120} value={renterForm.rental_months}
                        onChange={(e) => setRenterForm((p) => ({ ...p, rental_months: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-rent">Rent amount (₦) *</Label>
                      <Input id="ag-rent" type="number" min={0} value={renterForm.rent_amount}
                        onChange={(e) => setRenterForm((p) => ({ ...p, rent_amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-rent-months">For how many months</Label>
                      <Input id="ag-rent-months" type="number" min={1} max={120} value={renterForm.rent_months}
                        onChange={(e) => setRenterForm((p) => ({ ...p, rent_months: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-surname">Surname</Label>
                      <Input id="ag-surname" maxLength={80} value={renterForm.surname}
                        onChange={(e) => setRenterForm((p) => ({ ...p, surname: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ag-other">Other names</Label>
                      <Input id="ag-other" maxLength={120} value={renterForm.other_names}
                        onChange={(e) => setRenterForm((p) => ({ ...p, other_names: e.target.value }))} />
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <h4 className="font-semibold text-sm mb-2">Guarantor details</h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="g-name">Name</Label>
                        <Input id="g-name" maxLength={120} value={renterForm.guarantor_name}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-phone">Telephone</Label>
                        <Input id="g-phone" maxLength={40} value={renterForm.guarantor_phone}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_phone: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="g-addr">Residential address</Label>
                        <Textarea id="g-addr" maxLength={300} rows={2} value={renterForm.guarantor_address}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_address: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-occ">Occupation/Profession</Label>
                        <Input id="g-occ" maxLength={120} value={renterForm.guarantor_occupation}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_occupation: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-co">Company name/address</Label>
                        <Input id="g-co" maxLength={200} value={renterForm.guarantor_company}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_company: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-id">ID type/number</Label>
                        <Input id="g-id" maxLength={80} value={renterForm.guarantor_id}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_id: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-email">Email</Label>
                        <Input id="g-email" type="email" maxLength={160} value={renterForm.guarantor_email}
                          onChange={(e) => setRenterForm((p) => ({ ...p, guarantor_email: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <h4 className="font-semibold text-sm mb-2">Declaration</h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="d-years">Known for (years)</Label>
                        <Input id="d-years" type="number" min={0} max={100} value={renterForm.declaration_known_years}
                          onChange={(e) => setRenterForm((p) => ({ ...p, declaration_known_years: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="d-rel">Relationship</Label>
                        <Input id="d-rel" maxLength={80} value={renterForm.declaration_relationship}
                          onChange={(e) => setRenterForm((p) => ({ ...p, declaration_relationship: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-name">Signature (typed full name) *</Label>
                      <Input id="s-name" maxLength={120} value={renterForm.signature_name}
                        onChange={(e) => setRenterForm((p) => ({ ...p, signature_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-date">Date *</Label>
                      <Input id="s-date" type="date" value={renterForm.signature_date}
                        onChange={(e) => setRenterForm((p) => ({ ...p, signature_date: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox
                    checked={agreementChecked}
                    onCheckedChange={(v) => setAgreementChecked(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    I have read and agree to the terms of the MoveEasy Storage Agreement, and confirm the
                    information I have entered above is true and acts as my electronic signature.
                  </span>
                </label>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAgreementOpen(false)}>Close</Button>
              {!acknowledgement && (
                <Button
                  disabled={!agreementChecked || !renterFormValid || submittingAck}
                  onClick={submitAcknowledgement}
                >
                  {submittingAck ? "Saving…" : "Acknowledge"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemDetailsDialog({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const open = !!itemId;

  const { data, isLoading } = useQuery({
    queryKey: ["portal-item-detail", itemId],
    enabled: open,
    queryFn: async () => {
      const [itemRes, movementsRes] = await Promise.all([
        supabase.from("stored_items").select("*").eq("id", itemId!).maybeSingle(),
        supabase
          .from("item_movements")
          .select("*, item_releases(waybill_number, recipient_name, waybill_url)")
          .eq("stored_item_id", itemId!)
          .order("created_at", { ascending: false }),
      ]);
      if (itemRes.error) throw itemRes.error;
      const item = itemRes.data as any;
      let rental: any = null;
      let documents: any[] = [];
      if (item?.rental_id) {
        const [rentalRes, docsRes] = await Promise.all([
          supabase
            .from("rentals")
            .select("id, start_date, end_date, billing_cycle, currency, rate, storage_units(name, unit_code, dimensions, size)")
            .eq("id", item.rental_id)
            .maybeSingle(),
          supabase
            .from("documents")
            .select("*")
            .eq("rental_id", item.rental_id)
            .order("created_at", { ascending: false }),
        ]);
        rental = rentalRes.data;
        documents = docsRes.data ?? [];
      }
      return { item: item ? { ...item, rentals: rental } : null, movements: movementsRes.data ?? [], documents };
    },
  });

  async function downloadWaybill(path: string) {
    const { data: signed, error } = await supabase.storage.from("waybills").createSignedUrl(path, 60);
    if (error || !signed?.signedUrl) return toast.error(error?.message ?? "Could not open waybill");
    window.open(signed.signedUrl, "_blank");
  }

  async function downloadDocument(path: string) {
    const { data: signed, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !signed?.signedUrl) return toast.error(error?.message ?? "Could not open document");
    window.open(signed.signedUrl, "_blank");
  }

  const item = data?.item;
  const remaining = item ? Number(item.qty) - Number(item.qty_released) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {item?.name ?? "Item"}
            {item && (
              <Badge variant={item.status === "in_storage" ? "secondary" : "outline"} className="capitalize ml-2">
                {String(item.status).replace("_", " ")}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading item details…</p>}
        {!isLoading && !item && <p className="text-sm text-muted-foreground py-8 text-center">Item not found or you don't have access.</p>}

        {item && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Card><CardContent className="p-4 space-y-2">
                <p className="font-semibold text-xs uppercase text-muted-foreground">Item info</p>
                <Row label="Code" value={<span className="font-mono text-xs">{item.item_code}</span>} />
                <Row label="In storage" value={<span className="font-semibold">{remaining} of {item.qty}</span>} />
                <Row label="Released" value={item.qty_released ?? 0} />
                <Row label="Condition" value={item.condition ?? "—"} />
                <Row label="Intake date" value={formatDate(item.intake_date)} />
              </CardContent></Card>

              <Card><CardContent className="p-4 space-y-2">
                <p className="font-semibold text-xs uppercase text-muted-foreground">Storage unit</p>
                {item.rentals?.storage_units ? (
                  <>
                    <Row label="Unit" value={`${item.rentals.storage_units.name} (${item.rentals.storage_units.unit_code})`} />
                    <Row label="Size" value={`${item.rentals.storage_units.size}${item.rentals.storage_units.dimensions ? ` · ${item.rentals.storage_units.dimensions}` : ""}`} />
                    <Row label="Rental" value={`${formatDate(item.rentals.start_date)} → ${formatDate(item.rentals.end_date)}`} />
                    <Row label="Rate" value={`${formatMoney(item.rentals.rate, item.rentals.currency)} / ${item.rentals.billing_cycle}`} />
                  </>
                ) : (
                  <p className="text-muted-foreground">No unit linked.</p>
                )}
              </CardContent></Card>
            </div>

            {item.notes && (
              <Card><CardContent className="p-4 text-sm">
                <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{item.notes}</p>
              </CardContent></Card>
            )}

            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <History className="h-4 w-4" /> Storage history ({data?.movements.length ?? 0})
              </h3>
              <Card><CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                      <tr>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Action</th>
                        <th className="text-left px-3 py-2">Qty change</th>
                        <th className="text-left px-3 py-2">Remaining</th>
                        <th className="text-left px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.movements.length ?? 0) === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No movements recorded.</td></tr>
                      )}
                      {data?.movements.map((m: any) => (
                        <tr key={m.id} className="border-t align-top">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.created_at)}</td>
                          <td className="px-3 py-2 capitalize">
                            <Badge variant={m.movement_type === "intake" ? "secondary" : "outline"}>
                              {String(m.movement_type).replace("_", " ")}
                            </Badge>
                          </td>
                          <td className={`px-3 py-2 font-medium ${m.qty_change < 0 ? "text-destructive" : ""}`}>
                            {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                          </td>
                          <td className="px-3 py-2">{m.qty_after}</td>
                          <td className="px-3 py-2 text-xs">
                            {m.notes && <div className="text-muted-foreground">{m.notes}</div>}
                            {m.item_releases?.waybill_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 mt-1"
                                onClick={() => downloadWaybill(m.item_releases.waybill_url)}
                              >
                                <FileDown className="h-3.5 w-3.5 mr-1" />
                                {m.item_releases.waybill_number ?? "Waybill"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            </section>

            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" /> Related documents ({data?.documents.length ?? 0})
              </h3>
              <Card><CardContent className="p-4">
                {(data?.documents.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents attached to this rental.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data?.documents.map((d: any) => (
                      <li key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0 gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{d.title}</span>
                          <Badge variant="outline" className="text-xs capitalize">{d.kind}</Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                          <Button variant="ghost" size="sm" onClick={() => downloadDocument(d.storage_path)}>
                            <FileDown className="h-3.5 w-3.5 mr-1" /> Open
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent></Card>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function CustomerMovementLog({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-item-movements", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_movements")
        .select("*, stored_items(name, item_code)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Item movement log</DialogTitle></DialogHeader>
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
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading movement history…</td></tr>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No movements yet — your storage activity will appear here.</td></tr>
            )}
            {data?.map((m: any) => (
              <tr key={m.id} className="border-t align-top">
                <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div>{m.stored_items?.name ?? "—"}</div>
                  {m.stored_items?.item_code && <div className="text-[10px] font-mono text-muted-foreground">{m.stored_items.item_code}</div>}
                </td>
                <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{String(m.movement_type).replace("_", " ")}</Badge></td>
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

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="size-10 rounded-md bg-accent text-accent-foreground grid place-items-center"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ClaimLinkCodeCard({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)("claim_customer_link_code", { _code: code.trim().toUpperCase() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account linked!");
    setCode("");
    onLinked();
  }

  return (
    <Card className="shadow-[var(--shadow-card)] max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Link your account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the one-time link code provided by the facility staff to connect this account to your customer record.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            placeholder="e.g. ABCD2345"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono tracking-widest text-center text-lg"
            maxLength={12}
            autoFocus
          />
          <Button type="submit" disabled={busy || !code.trim()} className="w-full">
            {busy ? "Linking…" : "Link account"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          Don't have a code? Contact the facility staff to request one.
        </p>
      </CardContent>
    </Card>
  );
}
