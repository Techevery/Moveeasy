import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, UserPlus, X, Search } from "lucide-react";

type AppRole = "super_admin" | "admin" | "staff" | "payment_approver" | "customer";
const ASSIGNABLE_ROLES: AppRole[] = ["super_admin", "admin", "staff", "payment_approver"];

const ROLE_META: Record<AppRole, { label: string; tone: string; desc: string }> = {
  super_admin: {
    label: "Super Admin",
    tone: "bg-primary/15 text-primary border-primary/30",
    desc: "Full access. Only role that can create or manage other admins.",
  },
  admin: {
    label: "Admin",
    tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    desc: "Manages operations. Cannot create or modify admin accounts.",
  },
  staff: {
    label: "Staff",
    tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    desc: "Manage units, customers, rentals, and payments.",
  },
  payment_approver: {
    label: "Payment Approver",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    desc: "Can approve or reject pending payment receipts.",
  },
  customer: {
    label: "Customer",
    tone: "bg-muted text-muted-foreground border-border",
    desc: "Default role for self-service customer portal.",
  },
};

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState({
    company_name: "MoveEasy",
    currency: "NGN",
    tax_rate: 0,
  });

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setS({
        company_name: data.company_name,
        currency: data.currency,
        tax_rate: Number(data.tax_rate),
      });
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("settings").update({
      company_name: s.company_name,
      currency: s.currency,
      tax_rate: s.tax_rate,
    }).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Configure your facility</p>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Company name</Label>
              <Input value={s.company_name} onChange={(e) => setS({ ...s, company_name: e.target.value })} disabled={!isAdmin} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Default currency</Label>
                <Input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} disabled={!isAdmin} placeholder="NGN, USD, EUR…" />
              </div>
              <div className="space-y-2">
                <Label>Tax rate (%)</Label>
                <Input type="number" step="0.01" value={s.tax_rate} onChange={(e) => setS({ ...s, tax_rate: Number(e.target.value) })} disabled={!isAdmin} />
              </div>
            </div>
            {isAdmin ? (
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
            ) : (
              <p className="text-xs text-muted-foreground">Only admins can edit company settings.</p>
            )}
          </form>
        </CardContent>
      </Card>

      {isSuperAdmin && <RolesManager />}
    </div>
  );
}

function RolesManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("staff");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["role-users"],
    queryFn: async () => {
      const [{ data: roles, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role"),
        supabase.from("profiles").select("id, full_name, phone"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const byUser = new Map<string, { user_id: string; full_name: string | null; phone: string | null; roles: { id: string; role: AppRole }[] }>();
      for (const p of profiles ?? []) {
        byUser.set(p.id, { user_id: p.id, full_name: p.full_name, phone: p.phone, roles: [] });
      }
      for (const r of roles ?? []) {
        const entry = byUser.get(r.user_id) ?? { user_id: r.user_id, full_name: null, phone: null, roles: [] };
        entry.roles.push({ id: r.id, role: r.role as AppRole });
        byUser.set(r.user_id, entry);
      }
      return Array.from(byUser.values())
        .filter((u) => u.roles.some((r) => r.role !== "customer"))
        .sort((a, b) =>
          (a.full_name ?? "").localeCompare(b.full_name ?? ""),
        );
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function assignRole(user_id: string, role: AppRole) {
    const key = `${user_id}:${role}:add`;
    setBusyKey(key);
    const { error } = await supabase.from("user_roles").insert({ user_id, role });
    setBusyKey(null);
    if (error) {
      if (error.code === "23505") return toast.info("User already has that role");
      return toast.error(error.message);
    }
    toast.success(`Granted ${ROLE_META[role].label}`);
    qc.invalidateQueries({ queryKey: ["role-users"] });
  }

  async function revokeRole(roleRowId: string, role: AppRole) {
    const key = `${roleRowId}:remove`;
    setBusyKey(key);
    const { error } = await supabase.from("user_roles").delete().eq("id", roleRowId);
    setBusyKey(null);
    if (error) return toast.error(error.message);
    toast.success(`Revoked ${ROLE_META[role].label}`);
    qc.invalidateQueries({ queryKey: ["role-users"] });
  }

  async function addByUserId() {
    const uid = addUserId.trim();
    if (!uid) return toast.error("Paste a user ID");
    await assignRole(uid, addRole);
    setAddUserId("");
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Roles & Permissions
            </CardTitle>
            <CardDescription>
              Grant team members access. Users sign up first, then you assign their role here.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {ASSIGNABLE_ROLES.map((r) => (
              <span key={r} className={`inline-flex items-center rounded-full border px-2 py-0.5 ${ROLE_META[r].tone}`}>
                {ROLE_META[r].label}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <Label className="text-xs">Quick assign by user ID</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Paste user UUID (from sign-up)"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="font-mono text-xs"
            />
            <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addByUserId} disabled={busyKey !== null}>
              <UserPlus className="h-4 w-4 mr-1" /> Grant
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: a user's ID appears in their profile row after they sign up.
          </p>
        </div>

        <div>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or ID"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-left px-3 py-2">Current roles</th>
                  <th className="text-right px-3 py-2">Grant role</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No users found.</td></tr>
                )}
                {filtered.map((u) => {
                  const visibleRoles = u.roles.filter((r) => r.role !== "customer");
                  const owned = new Set(visibleRoles.map((r) => r.role));
                  const grantable = ASSIGNABLE_ROLES.filter((r) => !owned.has(r));
                  return (
                    <tr key={u.user_id} className="border-t align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium">{u.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.phone ?? ""}</div>
                        <div className="text-[10px] font-mono text-muted-foreground/80 mt-1 break-all">{u.user_id}</div>
                      </td>
                      <td className="px-3 py-3">
                        {visibleRoles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {visibleRoles.map((r) => (
                              <Badge
                                key={r.id}
                                variant="outline"
                                className={`gap-1 ${ROLE_META[r.role].tone}`}
                              >
                                {ROLE_META[r.role].label}
                                <button
                                  type="button"
                                  onClick={() => revokeRole(r.id, r.role)}
                                  disabled={busyKey === `${r.id}:remove`}
                                  className="opacity-70 hover:opacity-100"
                                  title="Revoke"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {grantable.length === 0 ? (
                          <span className="text-xs text-muted-foreground">All assigned</span>
                        ) : (
                          <Select
                            value=""
                            onValueChange={(v) => assignRole(u.user_id, v as AppRole)}
                          >
                            <SelectTrigger className="h-8 w-44 ml-auto">
                              <SelectValue placeholder="+ Add role" />
                            </SelectTrigger>
                            <SelectContent>
                              {grantable.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_META[r].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
