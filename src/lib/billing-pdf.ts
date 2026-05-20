import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

type DocKind = "receipt" | "invoice";

interface BillingDoc {
  kind: DocKind;
  number: string;
  date: string; // ISO
  company: { name: string; logoUrl?: string | null };
  customer: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  lines: { description: string; qty?: number; unit_price?: number; amount: number }[];
  currency: string;
  subtotal: number;
  discount?: number;
  total: number;
  amountPaid?: number;
  balance?: number;
  method?: string;
  reference?: string | null;
  notes?: string | null;
}

function fmtMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function buildBillingPdf(doc: BillingDoc): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(doc.company.name, margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  const title = doc.kind === "receipt" ? "RECEIPT" : "INVOICE";
  pdf.text(title, pageW - margin, y, { align: "right" });
  y += 24;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  pdf.text(`# ${doc.number}`, pageW - margin, y, { align: "right" });
  y += 14;
  pdf.text(`Date: ${new Date(doc.date).toLocaleDateString()}`, pageW - margin, y, { align: "right" });
  pdf.setTextColor(0);
  y += 30;

  // Bill to
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Bill to", margin, y);
  y += 14;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(doc.customer.full_name, margin, y);
  y += 12;
  if (doc.customer.email) { pdf.text(doc.customer.email, margin, y); y += 12; }
  if (doc.customer.phone) { pdf.text(doc.customer.phone, margin, y); y += 12; }
  if (doc.customer.address) {
    const lines = pdf.splitTextToSize(doc.customer.address, pageW - margin * 2);
    pdf.text(lines, margin, y);
    y += lines.length * 12;
  }
  y += 16;

  // Line items table
  const colX = { desc: margin, qty: 320, price: 380, amount: pageW - margin };
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, y - 12, pageW - margin * 2, 20, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Description", colX.desc + 4, y);
  pdf.text("Qty", colX.qty, y, { align: "right" });
  pdf.text("Unit", colX.price, y, { align: "right" });
  pdf.text("Amount", colX.amount, y, { align: "right" });
  y += 18;

  pdf.setFont("helvetica", "normal");
  for (const ln of doc.lines) {
    const descLines = pdf.splitTextToSize(ln.description, 270);
    pdf.text(descLines, colX.desc + 4, y);
    pdf.text(ln.qty != null ? String(ln.qty) : "—", colX.qty, y, { align: "right" });
    pdf.text(ln.unit_price != null ? fmtMoney(ln.unit_price, doc.currency) : "—", colX.price, y, { align: "right" });
    pdf.text(fmtMoney(ln.amount, doc.currency), colX.amount, y, { align: "right" });
    y += Math.max(descLines.length, 1) * 14;
  }
  y += 6;
  pdf.setDrawColor(220);
  pdf.line(margin, y, pageW - margin, y);
  y += 16;

  // Totals
  const labelX = pageW - margin - 140;
  const valX = pageW - margin;
  const row = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(label, labelX, y);
    pdf.text(value, valX, y, { align: "right" });
    y += 16;
  };
  row("Subtotal", fmtMoney(doc.subtotal, doc.currency));
  if (doc.discount) row("Discount", `-${fmtMoney(doc.discount, doc.currency)}`);
  pdf.setDrawColor(220);
  pdf.line(labelX, y - 6, valX, y - 6);
  row("Total", fmtMoney(doc.total, doc.currency), true);

  if (doc.kind === "receipt") {
    y += 4;
    if (doc.amountPaid != null) row("Amount paid", fmtMoney(doc.amountPaid, doc.currency), true);
    if (doc.balance != null && doc.balance !== 0) row("Balance", fmtMoney(doc.balance, doc.currency));
    if (doc.method) row("Method", doc.method);
    if (doc.reference) row("Reference", doc.reference);
  }

  y += 24;
  if (doc.notes) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Notes", margin, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    const notesLines = pdf.splitTextToSize(doc.notes, pageW - margin * 2);
    pdf.text(notesLines, margin, y);
    y += notesLines.length * 12;
  }

  // Footer
  const footerY = pdf.internal.pageSize.getHeight() - 30;
  pdf.setFontSize(9);
  pdf.setTextColor(140);
  pdf.text(
    doc.kind === "receipt"
      ? "This receipt confirms payment received. Thank you for your business."
      : "Please remit payment by the due date. Thank you for your business.",
    pageW / 2,
    footerY,
    { align: "center" },
  );

  return pdf.output("blob");
}

async function nextNumber(kind: DocKind): Promise<string> {
  const prefix = kind === "receipt" ? "RCP" : "INV";
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("documents")
    .select("doc_number")
    .like("doc_number", `${prefix}-${year}-%`)
    .order("doc_number", { ascending: false })
    .limit(1);
  let next = 1;
  const last = data?.[0]?.doc_number as string | undefined;
  if (last) {
    const tail = parseInt(last.split("-").pop() || "0", 10);
    if (Number.isFinite(tail)) next = tail + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

async function loadCompany() {
  const { data } = await supabase.from("settings").select("company_name, company_logo_url").eq("id", 1).maybeSingle();
  return { name: data?.company_name ?? "MoveEasy", logoUrl: data?.company_logo_url ?? null };
}

async function loadCustomer(customer_id: string) {
  const { data: c } = await supabase.from("customers").select("*").eq("id", customer_id).maybeSingle();
  let primary: string | null = null;
  if (c?.user_id) {
    const { data: p } = await supabase.from("profiles").select("email").eq("id", c.user_id).maybeSingle();
    primary = p?.email ?? null;
  }
  return {
    full_name: c?.full_name ?? "Customer",
    email: primary ?? c?.email ?? null,
    phone: c?.phone ?? null,
    address: c?.address ?? null,
  };
}

interface SaveResult {
  documentId: string;
  storagePath: string;
  number: string;
  blob: Blob;
}

async function saveDocument(opts: {
  kind: DocKind;
  number: string;
  blob: Blob;
  customer_id: string;
  rental_id?: string | null;
  payment_id?: string | null;
  title: string;
}): Promise<SaveResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const path = `${uid}/${opts.kind}s/${opts.number}.pdf`;
  const up = await supabase.storage.from("receipts").upload(path, opts.blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (up.error) throw up.error;

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      kind: opts.kind,
      title: opts.title,
      doc_number: opts.number,
      storage_path: path,
      mime_type: "application/pdf",
      size_bytes: opts.blob.size,
      uploaded_by: uid,
      customer_id: opts.customer_id,
      rental_id: opts.rental_id ?? null,
      payment_id: opts.payment_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { documentId: doc!.id, storagePath: path, number: opts.number, blob: opts.blob };
}

export async function generateReceiptForPayment(paymentId: string): Promise<SaveResult> {
  const { data: p, error } = await supabase
    .from("payments")
    .select("*, rentals(rate, currency, billing_cycle, storage_units(name, unit_code))")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !p) throw error ?? new Error("Payment not found");

  const company = await loadCompany();
  const customer = await loadCustomer(p.customer_id);
  const number = await nextNumber("receipt");

  const total = Number(p.amount);
  const discount = Number(p.discount ?? 0);
  const subtotal = total + discount;
  const desc = p.rentals?.storage_units
    ? `Storage rental — ${p.rentals.storage_units.name} (${p.rentals.storage_units.unit_code})`
    : "Service payment";

  const blob = buildBillingPdf({
    kind: "receipt",
    number,
    date: p.paid_at,
    company,
    customer,
    lines: [{ description: desc, qty: 1, unit_price: subtotal, amount: subtotal }],
    currency: p.currency,
    subtotal,
    discount: discount || undefined,
    total,
    amountPaid: total,
    balance: Number(p.balance ?? 0) || undefined,
    method: String(p.method).replace("_", " "),
    reference: p.reference,
    notes: p.notes,
  });

  return saveDocument({
    kind: "receipt",
    number,
    blob,
    customer_id: p.customer_id,
    rental_id: p.rental_id,
    payment_id: p.id,
    title: `Receipt ${number}`,
  });
}

export async function generateInvoiceForRental(rentalId: string): Promise<SaveResult> {
  const { data: r, error } = await supabase
    .from("rentals")
    .select("*, storage_units(name, unit_code, dimensions)")
    .eq("id", rentalId)
    .maybeSingle();
  if (error || !r) throw error ?? new Error("Rental not found");

  const company = await loadCompany();
  const customer = await loadCustomer(r.customer_id);
  const number = await nextNumber("invoice");

  const lines: BillingDoc["lines"] = [];
  if (r.service_type === "storage") {
    const desc = `Storage — ${r.storage_units?.name ?? ""} (${r.storage_units?.unit_code ?? ""}) · ${r.billing_cycle}`;
    lines.push({ description: desc, qty: 1, unit_price: Number(r.rate), amount: Number(r.rate) });
  } else {
    lines.push({
      description: `Moving service — ${r.pickup_address ?? ""} → ${r.destination_address ?? ""}`,
      qty: 1,
      unit_price: Number(r.rate),
      amount: Number(r.rate),
    });
  }
  if (Number(r.security_deposit) > 0) {
    lines.push({
      description: "Security deposit (refundable)",
      qty: 1,
      unit_price: Number(r.security_deposit),
      amount: Number(r.security_deposit),
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);

  const blob = buildBillingPdf({
    kind: "invoice",
    number,
    date: new Date().toISOString(),
    company,
    customer,
    lines,
    currency: r.currency,
    subtotal,
    total: subtotal,
    notes: r.service_notes,
  });

  return saveDocument({
    kind: "invoice",
    number,
    blob,
    customer_id: r.customer_id,
    rental_id: r.id,
    title: `Invoice ${number}`,
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
