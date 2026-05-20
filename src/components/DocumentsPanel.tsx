import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, Trash2, History, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

type Kind = "contract" | "receipt" | "id" | "other";

type Props = {
  customerId?: string | null;
  rentalId?: string | null;
  paymentId?: string | null;
  /** When true, hides upload/delete (customer view). */
  readOnly?: boolean;
  title?: string;
};

export function DocumentsPanel({ customerId, rentalId, paymentId, readOnly = false, title = "Documents" }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("contract");
  const [docTitle, setDocTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [auditFor, setAuditFor] = useState<string | null>(null);

  const filterKey = ["documents", { customerId, rentalId, paymentId }];

  const { data: docs, isLoading } = useQuery({
    queryKey: filterKey,
    queryFn: async () => {
      let q = supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (customerId) q = q.eq("customer_id", customerId);
      if (rentalId) q = q.eq("rental_id", rentalId);
      if (paymentId) q = q.eq("payment_id", paymentId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function logAudit(documentId: string, action: string, meta: any = {}) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("document_audit").insert({
      document_id: documentId,
      action,
      actor: auth.user.id,
      meta,
    });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!customerId && !rentalId && !paymentId) {
      toast.error("Attach to a customer, rental, or payment first");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${customerId ?? "general"}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("documents")
        .insert({
          customer_id: customerId ?? null,
          rental_id: rentalId ?? null,
          payment_id: paymentId ?? null,
          kind,
          title: docTitle || file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      await logAudit(row.id, "uploaded", { filename: file.name, size: file.size });
      toast.success("Document uploaded");
      setDocTitle("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDownload(doc: any) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not generate link");
    await logAudit(doc.id, "downloaded");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function onDelete(doc: any) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    await logAudit(doc.id, "deleted", { title: doc.title });
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["documents"] });
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="grid sm:grid-cols-[160px_1fr_auto] gap-2 items-end rounded-md border p-3 bg-secondary/30">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="id">ID document</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title (optional)</Label>
              <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Signed contract — Jan 2026" />
            </div>
            <div>
              <input ref={fileRef} type="file" hidden onChange={onUpload}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" />
              <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> {busy ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (docs?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-2">Document</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Uploaded</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs!.map((d: any) => (
                  <tr key={d.id} className="border-t">
                    <td className="py-2 font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" /> {d.title}
                    </td>
                    <td className="py-2"><Badge variant="secondary" className="capitalize">{d.kind}</Badge></td>
                    <td className="py-2 text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="py-2 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => onDownload(d)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAuditFor(d.id)}>
                        <History className="h-4 w-4" />
                      </Button>
                      {!readOnly && (
                        <Button size="sm" variant="ghost" onClick={() => onDelete(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={!!auditFor} onOpenChange={(o) => !o && setAuditFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Audit history</DialogTitle></DialogHeader>
            {auditFor && <AuditList documentId={auditFor} />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function AuditList({ documentId }: { documentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_audit")
        .select("*, profiles:actor(full_name)")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y text-sm">
      {data.map((a: any) => (
        <li key={a.id} className="py-2 flex items-center justify-between">
          <div>
            <p className="font-medium capitalize">{a.action}</p>
            <p className="text-xs text-muted-foreground">{a.profiles?.full_name ?? "System"}</p>
          </div>
          <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
