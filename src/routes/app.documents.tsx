import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DocumentsPanel } from "@/components/DocumentsPanel";

export const Route = createFileRoute("/app/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const [customerId, setCustomerId] = useState<string>("");

  const { data: customers } = useQuery({
    queryKey: ["customers-doc-list"],
    queryFn: async () =>
      (await supabase.from("customers").select("id, full_name").order("full_name")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
        <p className="text-sm text-muted-foreground">Contracts, receipts and IDs — securely stored with audit history</p>
      </div>

      <div className="max-w-sm space-y-1.5">
        <Label className="text-xs">Filter by customer</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="All customers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DocumentsPanel
        customerId={customerId && customerId !== "all" ? customerId : undefined}
        title={customerId && customerId !== "all" ? "Customer documents" : "All documents"}
      />
    </div>
  );
}
