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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Package, Receipt, FileText, Phone, Mail, MapPin, User as UserIcon, Link2, Unlink, Check, UserPlus, Pencil, Trash2, KeyRound, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { StoredItemsPanel } from "@/components/StoredItemsPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<any | null>(null);

  async function confirmDelete() {
    if (!deleteCustomer) return;
    const { error } = await supabase.from("customers").delete().eq("id", deleteCustomer.id);
    if (error) return toast.error(error.message);
    toast.success("Customer deleted");
    setDeleteCustomer(null);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", q],
    queryFn: async () => {
      let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const userIds = (data ?? []).map((c: any) => c.user_id).filter(Boolean);
      let profileMap = new Map<string, any>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      return (data ?? []).map((c: any) => ({
        ...c,
        primary_email: c.user_id ? profileMap.get(c.user_id)?.email ?? null : null,
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-sm text-muted-foreground">Manage everyone renting at your facility</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add customer</Button>
          </DialogTrigger>
          <CustomerForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Customers</TabsTrigger>
          <TabsTrigger value="unlinked">Unlinked accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, phone or email" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Phone</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Linked</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Created</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                    )}
                    {!isLoading && (customers?.length ?? 0) === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No customers yet. Add your first one.</td></tr>
                    )}
                    {customers?.map((c) => (
                      <tr key={c.id} className="border-t hover:bg-secondary/30 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                        <td className="px-4 py-3 font-medium">{c.full_name}</td>
                        <td className="px-4 py-3">{c.phone}</td>
                        <td className="px-4 py-3">
                          {(c as any).primary_email ? (
                            <div className="space-y-0.5">
                              <div>{(c as any).primary_email} <span className="text-[10px] uppercase text-muted-foreground">primary</span></div>
                              {c.email && <div className="text-xs text-muted-foreground">{c.email} · secondary</div>}
                            </div>
                          ) : c.email ? (
                            <div>{c.email} <span className="text-[10px] uppercase text-muted-foreground">secondary</span></div>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.user_id ? (
                            <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> Linked</Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-muted-foreground"><Unlink className="h-3 w-3" /> Not linked</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={c.status === "active" ? "secondary" : c.status === "blacklisted" ? "destructive" : "outline"}>{c.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {isAdmin && !c.user_id && (
                              <>
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditCustomer(c); }} title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteCustomer(c); }} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
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
        </TabsContent>

        <TabsContent value="unlinked" className="space-y-4">
          <UnlinkedAccountsTab onOpenCustomer={setSelectedId} />
        </TabsContent>
      </Tabs>

      <CustomerDetailSheet customerId={selectedId} onClose={() => setSelectedId(null)} />

      <Dialog open={!!editCustomer} onOpenChange={(o) => !o && setEditCustomer(null)}>
        {editCustomer && (
          <CustomerForm
            customer={editCustomer}
            onDone={() => { setEditCustomer(null); qc.invalidateQueries({ queryKey: ["customers"] }); }}
          />
        )}
      </Dialog>

      <AlertDialog open={!!deleteCustomer} onOpenChange={(o) => !o && setDeleteCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium">{deleteCustomer?.full_name}</span> and any related rentals, payments, and documents. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnlinkedAccountsTab({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkProfile, setLinkProfile] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["unlinked-profiles"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: taken, error: tErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("customers").select("user_id").not("user_id", "is", null),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;
      if (rErr) throw rErr;
      const takenIds = new Set((taken ?? []).map((t: any) => t.user_id));
      // Only customer-role users who aren't linked to a customer record
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? []).filter((p: any) => {
        if (takenIds.has(p.id)) return false;
        const userRoles = rolesByUser.get(p.id) ?? [];
        // Exclude staff/admins; show customers or users with no role yet
        return userRoles.length === 0 || userRoles.includes("customer");
      });
    },
  });

  const filtered = (data ?? []).filter((p: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (p.full_name ?? "").toLowerCase().includes(s) || (p.phone ?? "").toLowerCase().includes(s);
  });

  async function createCustomerFromProfile(p: any) {
    setBusyId(p.id);
    const { data: auth } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        full_name: p.full_name ?? "Unnamed",
        phone: p.phone ?? "—",
        user_id: p.id,
        created_by: auth.user?.id,
      })
      .select("id")
      .single();
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Customer record created and linked");
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["unlinked-profiles"] });
    if (created?.id) onOpenCustomer(created.id);
  }

  return (
    <>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Phone</th>
                  <th className="text-left px-4 py-3">User ID</th>
                  <th className="text-left px-4 py-3">Signed up</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No unlinked accounts. Every signed-up customer is linked to a customer record.</td></tr>
                )}
                {filtered.map((p: any) => (
                  <tr key={p.id} className="border-t hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{p.full_name ?? "—"}</td>
                    <td className="px-4 py-3">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{p.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => setLinkProfile(p)}>
                          <Link2 className="h-4 w-4 mr-1" /> Link to existing
                        </Button>
                        <Button size="sm" disabled={busyId === p.id} onClick={() => createCustomerFromProfile(p)}>
                          <UserPlus className="h-4 w-4 mr-1" /> {busyId === p.id ? "Creating…" : "Create new"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <LinkExistingCustomerDialog
        profile={linkProfile}
        onClose={() => setLinkProfile(null)}
        onLinked={(customerId) => {
          setLinkProfile(null);
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["unlinked-profiles"] });
          onOpenCustomer(customerId);
        }}
      />
    </>
  );
}

function LinkExistingCustomerDialog({
  profile,
  onClose,
  onLinked,
}: {
  profile: any | null;
  onClose: () => void;
  onLinked: (customerId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const open = !!profile;

  const { data: results, isFetching } = useQuery({
    queryKey: ["unlinked-customers-search", search],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .is("user_id", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (search.trim()) {
        const s = search.trim();
        query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function link(customerId: string) {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("customers")
      .update({ user_id: profile.id })
      .eq("id", customerId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account linked to customer");
    onLinked(customerId);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link account to existing customer</DialogTitle>
        </DialogHeader>
        {profile && (
          <div className="space-y-3">
            <div className="rounded-md border bg-secondary/40 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Account to link</p>
              <p className="font-medium">{profile.full_name ?? "Unnamed"}</p>
              <p className="text-xs text-muted-foreground">{profile.phone ?? "—"}</p>
            </div>
            <Input
              placeholder="Search customers by name, phone or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="rounded-md border max-h-72 overflow-y-auto">
              {isFetching && <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>}
              {!isFetching && (results?.length ?? 0) === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No unlinked customers found.</p>
              )}
              {results?.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => link(c.id)}
                  className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b last:border-0 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.phone}{c.email ? ` • ${c.email}` : ""}
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetailSheet({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const open = !!customerId;

  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId],
    enabled: open,
    queryFn: async () => {
      const [c, rentals, payments, documents] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId!).maybeSingle(),
        supabase.from("rentals").select("*, storage_units(name, unit_code, size, dimensions)").eq("customer_id", customerId!).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("customer_id", customerId!).order("paid_at", { ascending: false }),
        supabase.from("documents").select("*").eq("customer_id", customerId!).order("created_at", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      let primaryEmail: string | null = null;
      if (c.data?.user_id) {
        const { data: prof } = await supabase.from("profiles").select("email").eq("id", c.data.user_id).maybeSingle();
        primaryEmail = prof?.email ?? null;
      }
      return {
        customer: c.data ? { ...c.data, primary_email: primaryEmail } : null,
        rentals: rentals.data ?? [],
        payments: payments.data ?? [],
        documents: documents.data ?? [],
      };
    },
  });

  const customer = data?.customer;
  const totalPaid = (data?.payments ?? []).filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const activeRentals = (data?.rentals ?? []).filter((r: any) => r.status === "active");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {customer?.full_name ?? "Customer"}
            {customer && (
              <Badge variant={customer.status === "active" ? "secondary" : customer.status === "blacklisted" ? "destructive" : "outline"} className="ml-2">{customer.status}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

        {customer && (
          <div className="space-y-6">
            {/* Contact & profile */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card><CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-xs uppercase text-muted-foreground">Contact</p>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}</div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="space-y-0.5">
                    {customer.primary_email ? (
                      <div>{customer.primary_email} <span className="text-[10px] uppercase text-muted-foreground">primary · login</span></div>
                    ) : (
                      <div className="text-muted-foreground italic text-xs">No login email yet</div>
                    )}
                    {customer.email && (
                      <div className="text-xs text-muted-foreground">{customer.email} · secondary</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><span>{customer.address ?? "—"}</span></div>
              </CardContent></Card>

              <Card><CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-xs uppercase text-muted-foreground">Identification</p>
                <div><span className="text-muted-foreground">Occupation:</span> {customer.occupation ?? "—"}</div>
                <div><span className="text-muted-foreground">ID:</span> {customer.id_type ?? "—"} {customer.id_number ?? ""}</div>
                <div><span className="text-muted-foreground">Joined:</span> {formatDate(customer.created_at)}</div>
              </CardContent></Card>

              <LinkedAccountCard customer={customer} />

              {(customer.emergency_name || customer.emergency_phone) && (
                <Card className="sm:col-span-2"><CardContent className="p-4 space-y-1 text-sm">
                  <p className="font-semibold text-xs uppercase text-muted-foreground">Next of kin</p>
                  <div>{customer.emergency_name} {customer.emergency_relationship && <span className="text-muted-foreground">({customer.emergency_relationship})</span>}</div>
                  <div className="text-muted-foreground">{customer.emergency_phone} {customer.emergency_email && `• ${customer.emergency_email}`}</div>
                </CardContent></Card>
              )}

              {customer.notes && (
                <Card className="sm:col-span-2"><CardContent className="p-4 text-sm">
                  <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Notes</p>
                  <p>{customer.notes}</p>
                </CardContent></Card>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Active rentals</p>
                <p className="text-2xl font-bold">{activeRentals.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Total rentals</p>
                <p className="text-2xl font-bold">{data?.rentals.length ?? 0}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Total paid</p>
                <p className="text-2xl font-bold">{formatMoney(totalPaid, "NGN")}</p>
              </CardContent></Card>
            </div>

            {/* Items / Units stored */}
            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Services ({data?.rentals.length ?? 0})</h3>
              <Card><CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                      <tr>
                        <th className="text-left px-3 py-2">Type</th>
                        <th className="text-left px-3 py-2">Details</th>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Rate</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.rentals.length ?? 0) === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No services.</td></tr>
                      )}
                      {data?.rentals.map((r: any) => (
                        <tr key={r.id} className="border-t align-top">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="capitalize">{r.service_type ?? "storage"}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            {r.service_type === "moving" ? (
                              <div className="space-y-0.5">
                                <div className="text-xs"><span className="text-muted-foreground">From:</span> {r.pickup_address}</div>
                                <div className="text-xs"><span className="text-muted-foreground">To:</span> {r.destination_address}</div>
                                {r.vehicle_type && <div className="text-xs text-muted-foreground">{r.vehicle_type}</div>}
                                {Array.isArray(r.inventory) && r.inventory.length > 0 && (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                      {r.inventory.length} item{r.inventory.length === 1 ? "" : "s"}
                                    </summary>
                                    <ul className="mt-1 ml-3 list-disc space-y-0.5">
                                      {r.inventory.map((it: any, i: number) => (
                                        <li key={i}>
                                          <span className="font-medium">{it.name}</span>
                                          {it.qty ? <span className="text-muted-foreground"> × {it.qty}</span> : null}
                                          {it.notes ? <span className="text-muted-foreground"> — {it.notes}</span> : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="font-medium">{r.storage_units?.name}</span>{" "}
                                <span className="text-muted-foreground">({r.storage_units?.unit_code})</span>
                                {r.storage_units?.dimensions && <div className="text-xs text-muted-foreground">{r.storage_units.dimensions}</div>}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {r.service_type === "moving"
                              ? (r.move_date ? formatDate(r.move_date) : "—")
                              : `${formatDate(r.start_date)} → ${formatDate(r.end_date)}`}
                          </td>
                          <td className="px-3 py-2">{formatMoney(r.rate, r.currency)}{r.service_type === "storage" && ` / ${r.billing_cycle}`}</td>
                          <td className="px-3 py-2"><Badge variant={r.status === "active" ? "secondary" : r.status === "overdue" ? "destructive" : "outline"}>{r.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            </section>

            {/* Stored items + releases */}
            <StoredItemsPanel
              customerId={customer.id}
              customerName={customer.full_name}
              rentals={data?.rentals ?? []}
            />

            {/* Payments */}
            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2"><Receipt className="h-4 w-4" /> Payment history ({data?.payments.length ?? 0})</h3>
              <Card><CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                      <tr>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Method</th>
                        <th className="text-left px-3 py-2">Reference</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.payments.length ?? 0) === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No payments yet.</td></tr>
                      )}
                      {data?.payments.map((p: any) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-2">{formatDate(p.paid_at)}</td>
                          <td className="px-3 py-2 font-medium">{formatMoney(p.amount, p.currency)}</td>
                          <td className="px-3 py-2 capitalize">{p.method}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.reference ?? "—"}</td>
                          <td className="px-3 py-2"><Badge variant={p.status === "paid" ? "secondary" : p.status === "pending_approval" ? "outline" : "destructive"}>{p.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            </section>

            {/* Documents */}
            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Documents ({data?.documents.length ?? 0})</h3>
              <Card><CardContent className="p-4">
                {(data?.documents.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data?.documents.map((d: any) => (
                      <li key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{d.title}</span>
                          <Badge variant="outline" className="text-xs">{d.kind}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
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

function CustomerForm({ onDone, customer }: { onDone: () => void; customer?: any }) {
  const isEdit = !!customer;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: customer?.full_name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    occupation: customer?.occupation ?? "",
    id_type: customer?.id_type ?? "",
    id_number: customer?.id_number ?? "",
    notes: customer?.notes ?? "",
    status: (customer?.status ?? "active") as "active" | "inactive" | "blacklisted",
    emergency_name: customer?.emergency_name ?? "",
    emergency_relationship: customer?.emergency_relationship ?? "",
    emergency_phone: customer?.emergency_phone ?? "",
    emergency_email: customer?.emergency_email ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let error;
    if (isEdit) {
      ({ error } = await supabase.from("customers").update(form).eq("id", customer.id));
    } else {
      const { data: auth } = await supabase.auth.getUser();
      ({ error } = await supabase.from("customers").insert({ ...form, created_by: auth.user?.id }));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Customer updated" : "Customer added");
    onDone();
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name *"><Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <Field label="Phone *"><Input required value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Secondary email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Used until customer creates account" />
          </Field>
          <Field label="Occupation"><Input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} /></Field>
          <Field label="ID type"><Input value={form.id_type} onChange={(e) => set("id_type", e.target.value)} placeholder="National ID, Passport…" /></Field>
          <Field label="ID number"><Input value={form.id_number} onChange={(e) => set("id_number", e.target.value)} /></Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>

        <div className="pt-2">
          <p className="text-sm font-medium mb-2">Next of kin / Emergency contact</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name"><Input value={form.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} /></Field>
            <Field label="Relationship"><Input value={form.emergency_relationship} onChange={(e) => set("emergency_relationship", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.emergency_email} onChange={(e) => set("emergency_email", e.target.value)} /></Field>
          </div>
        </div>

        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>

        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Save customer"}</Button>
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

function LinkedAccountCard({ customer }: { customer: any }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const linked = !!customer.user_id;

  const { data: linkedProfile } = useQuery({
    queryKey: ["profile-linked", customer.user_id],
    enabled: linked,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("id", customer.user_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: results, isFetching } = useQuery({
    queryKey: ["profile-search", search],
    enabled: !linked && search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      // Find profiles already taken by another customer to exclude
      const [{ data: profiles }, { data: taken }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone")
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,id.eq.${isUuid(q) ? q : "00000000-0000-0000-0000-000000000000"}`)
          .limit(10),
        supabase.from("customers").select("user_id").not("user_id", "is", null),
      ]);
      const takenIds = new Set((taken ?? []).map((t: any) => t.user_id));
      return (profiles ?? []).filter((p) => !takenIds.has(p.id));
    },
  });

  async function link(userId: string) {
    setBusy(true);
    const { error } = await supabase.from("customers").update({ user_id: userId }).eq("id", customer.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account linked");
    setSearch("");
    qc.invalidateQueries({ queryKey: ["customer-detail", customer.id] });
    qc.invalidateQueries({ queryKey: ["profile-linked"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["unlinked-profiles"] });
  }

  async function unlink() {
    setBusy(true);
    const { error } = await supabase.from("customers").update({ user_id: null }).eq("id", customer.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account unlinked");
    qc.invalidateQueries({ queryKey: ["customer-detail", customer.id] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["unlinked-profiles"] });
    qc.invalidateQueries({ queryKey: ["profile-linked"] });
  }

  return (
    <Card><CardContent className="p-4 space-y-3 text-sm">
      <p className="font-semibold text-xs uppercase text-muted-foreground flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5" /> Linked user account
      </p>
      {linked ? (
        <div className="space-y-2">
          <div className="rounded-md border bg-secondary/40 p-2.5">
            <div className="font-medium">{linkedProfile?.full_name ?? "Unknown user"}</div>
            <div className="text-xs text-muted-foreground">{linkedProfile?.phone ?? "—"}</div>
            {linkedProfile?.email && (
              <div className="text-xs text-muted-foreground">{linkedProfile.email} <span className="text-[10px] uppercase">primary</span></div>
            )}
            <div className="text-[10px] font-mono text-muted-foreground/80 break-all mt-1">{customer.user_id}</div>
          </div>
          <Button size="sm" variant="outline" onClick={unlink} disabled={busy}>
            <Unlink className="h-3.5 w-3.5 mr-1" /> Unlink
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <LinkCodeBlock customer={customer} />
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Or search and link this customer to an existing signed-up user.
            </p>
            <Input
              placeholder="Search by name, phone, or paste user ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim().length >= 2 && (
              <div className="rounded-md border max-h-48 overflow-y-auto">
                {isFetching && <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>}
                {!isFetching && (results?.length ?? 0) === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No matching unlinked accounts.</p>
                )}
                {results?.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => link(p.id)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b last:border-0 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.phone ?? p.id}</div>
                    </div>
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function LinkCodeBlock({ customer }: { customer: any }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(customer.link_code ?? null);

  async function generate() {
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("regenerate_customer_link_code", { _customer_id: customer.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCode(data as string);
    toast.success("Link code generated");
    qc.invalidateQueries({ queryKey: ["customer-detail", customer.id] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  function copy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  }

  return (
    <div className="rounded-md border bg-secondary/40 p-3 space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5" /> One-time link code
      </p>
      {code ? (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-base tracking-widest bg-background border rounded px-2 py-1.5 text-center">{code}</code>
            <Button size="sm" variant="outline" onClick={copy} title="Copy"><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={generate} disabled={busy} title="Regenerate"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Share with the customer. They enter it after signing up to auto-link their account. Code clears after use.
          </p>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Generate a one-time code so the customer can self-link from the portal.
          </p>
          <Button size="sm" onClick={generate} disabled={busy}>
            <KeyRound className="h-3.5 w-3.5 mr-1" /> {busy ? "Generating…" : "Generate code"}
          </Button>
        </>
      )}
    </div>
  );
}
