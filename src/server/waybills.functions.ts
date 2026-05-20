import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const lineSchema = z.object({
  stored_item_id: z.string().uuid(),
  name: z.string(),
  qty: z.number().int().positive(),
  condition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const inputSchema = z.object({
  release_id: z.string().uuid(),
  rental_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  waybill_number: z.string(),
  recipient_name: z.string(),
  recipient_phone: z.string().optional().nullable(),
  recipient_id_type: z.string().optional().nullable(),
  recipient_id_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  condition_on_release: z.string().optional().nullable(),
  customer_name: z.string(),
  released_by_name: z.string(),
  released_at: z.string(),
  items: z.array(lineSchema),
});

export const generateWaybillPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
    // Authorization: admin or payment_approver only
    const { data: roles, error: rolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesErr) return { ok: false as const, error: `Role check failed: ${rolesErr.message}` };
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "payment_approver");
    if (!allowed) return { ok: false as const, error: "Not authorized to generate waybills" };

    // Company name for header
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("company_name")
      .eq("id", 1)
      .maybeSingle();
    const company = settings?.company_name ?? "MoveEasy";

    const pdf = await PDFDocument.create();
    let page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const draw = (text: string, opts: { x?: number; size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
      page.drawText(text, {
        x: opts.x ?? 40,
        y,
        size: opts.size ?? 10,
        font: opts.bold ? bold : font,
        color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.1),
      });
    };

    // Header
    draw(company, { size: 18, bold: true });
    y -= 22;
    draw("Item Release Waybill", { size: 13, bold: true, color: [0.3, 0.3, 0.3] });
    y -= 16;
    draw(`Waybill #: ${data.waybill_number}`, { size: 10 });
    draw(`Date: ${new Date(data.released_at).toLocaleString()}`, { x: 350, size: 10 });
    y -= 24;

    // Divider
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 18;

    // Parties
    draw("Released to (Recipient)", { bold: true, size: 11 });
    draw("Released by", { x: 320, bold: true, size: 11 });
    y -= 14;
    draw(data.recipient_name);
    draw(data.released_by_name, { x: 320 });
    y -= 12;
    if (data.recipient_phone) { draw(`Phone: ${data.recipient_phone}`); y -= 12; }
    if (data.recipient_id_type || data.recipient_id_number) {
      draw(`ID: ${data.recipient_id_type ?? ""} ${data.recipient_id_number ?? ""}`.trim());
      y -= 12;
    }
    y -= 6;
    draw(`Customer (owner): ${data.customer_name}`, { bold: true });
    y -= 22;

    // Items table header
    page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 18, color: rgb(0.93, 0.93, 0.95) });
    draw("Item", { bold: true, x: 46 });
    draw("Qty", { bold: true, x: 320 });
    draw("Condition / Notes", { bold: true, x: 380 });
    y -= 22;

    for (const it of data.items) {
      if (y < 140) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      draw(it.name, { x: 46 });
      draw(String(it.qty), { x: 320 });
      const meta = [it.condition, it.notes].filter(Boolean).join(" — ");
      draw(meta || "—", { x: 380 });
      y -= 14;
      page.drawLine({ start: { x: 40, y: y + 4 }, end: { x: 555, y: y + 4 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
    }

    y -= 14;
    if (data.condition_on_release) {
      draw("Condition on release:", { bold: true });
      y -= 12;
      draw(data.condition_on_release);
      y -= 18;
    }
    if (data.notes) {
      draw("Notes:", { bold: true });
      y -= 12;
      draw(data.notes);
      y -= 18;
    }

    // Signatures
    y = Math.min(y, 160);
    page.drawLine({ start: { x: 40, y }, end: { x: 250, y }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) });
    page.drawLine({ start: { x: 320, y }, end: { x: 540, y }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
    draw("Recipient signature & date", { x: 40, size: 9, color: [0.4, 0.4, 0.4] });
    draw("Authorized signature & date", { x: 320, size: 9, color: [0.4, 0.4, 0.4] });

    const bytes = await pdf.save();

    const path = `${data.customer_id}/${data.waybill_number}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("waybills")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return { ok: false as const, error: `Upload failed: ${upErr.message}` };

    const { error: updErr } = await supabaseAdmin
      .from("item_releases")
      .update({ waybill_url: path })
      .eq("id", data.release_id);
    if (updErr) return { ok: false as const, error: `DB update failed: ${updErr.message}` };

    return { ok: true as const, path };
    } catch (err: any) {
      console.error("[generateWaybillPdf] error:", err);
      return { ok: false as const, error: err?.message ?? "Waybill generation failed" };
    }
  });
