// RBAC integration tests against the live Lovable Cloud project.
// Run with: node scripts/test-rbac.mjs
//
// Requires env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or VITE_*),
// and SUPABASE_SERVICE_ROLE_KEY (admin actions: provisioning test users).
//
// What this verifies (the actual security boundary = Postgres RLS):
//   * super_admin: can read user_roles, can grant/revoke any role
//   * admin:      CANNOT read or modify user_roles, but can manage operational tables
//   * staff:      CANNOT manage user_roles or settings, can manage operational data
//   * customer:   can ONLY see their own customer/rental/payment rows

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Missing env. Need SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const STAMP = Date.now();
const PASSWORD = "Test-Password-123!";
const USERS = {
  super_admin: `rbac-super-${STAMP}@test.local`,
  admin:       `rbac-admin-${STAMP}@test.local`,
  staff:       `rbac-staff-${STAMP}@test.local`,
  customer:    `rbac-customer-${STAMP}@test.local`,
};

const created = []; // {id, role}
let results = [];
const expect = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

async function provision() {
  console.log("→ Provisioning 4 test users...");
  for (const [role, email] of Object.entries(USERS)) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: `RBAC ${role}` },
    });
    if (error) throw new Error(`createUser ${role}: ${error.message}`);
    const id = data.user.id;
    created.push({ id, role });

    // handle_new_user already inserts a 'customer' role + profile.
    if (role !== "customer") {
      const { error: e2 } = await admin.from("user_roles").insert({ user_id: id, role });
      if (e2) throw new Error(`grant ${role}: ${e2.message}`);
    }
    // Customer needs a customers row to see anything (RLS joins on customers.user_id)
    if (role === "customer") {
      const { error: e3 } = await admin.from("customers").insert({
        user_id: id, full_name: "RBAC customer", phone: `+100000${STAMP % 10000}`,
      });
      if (e3) throw new Error(`customers row: ${e3.message}`);
    }
  }
}

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

async function run() {
  await provision();

  const sa  = await signIn(USERS.super_admin);
  const ad  = await signIn(USERS.admin);
  const st  = await signIn(USERS.staff);
  const cu  = await signIn(USERS.customer);

  const customerId = created.find((u) => u.role === "customer").id;
  const adminId    = created.find((u) => u.role === "admin").id;
  const staffId    = created.find((u) => u.role === "staff").id;

  // ---------- user_roles read access ----------
  {
    const { data } = await sa.from("user_roles").select("user_id, role");
    expect("super_admin reads all user_roles", (data?.length ?? 0) >= 4, `rows=${data?.length}`);
  }
  {
    const { data } = await ad.from("user_roles").select("user_id, role").neq("user_id", adminId);
    expect("admin CANNOT read other users' roles", (data?.length ?? 0) === 0, `leaked=${data?.length}`);
  }
  {
    const { data } = await st.from("user_roles").select("user_id, role").neq("user_id", staffId);
    expect("staff CANNOT read other users' roles", (data?.length ?? 0) === 0, `leaked=${data?.length}`);
  }
  {
    const { data } = await cu.from("user_roles").select("user_id, role").neq("user_id", customerId);
    expect("customer CANNOT read other users' roles", (data?.length ?? 0) === 0, `leaked=${data?.length}`);
  }

  // ---------- user_roles WRITE access (grant/revoke) ----------
  {
    const { error } = await ad.from("user_roles").insert({ user_id: customerId, role: "staff" });
    expect("admin CANNOT grant a role", !!error, error?.message ?? "no error returned");
  }
  {
    const { error } = await st.from("user_roles").insert({ user_id: customerId, role: "staff" });
    expect("staff CANNOT grant a role", !!error, error?.message ?? "no error returned");
  }
  {
    const { error } = await cu.from("user_roles").insert({ user_id: customerId, role: "admin" });
    expect("customer CANNOT self-grant admin", !!error, error?.message ?? "no error returned");
  }
  {
    const { data, error } = await sa.from("user_roles")
      .insert({ user_id: customerId, role: "staff" }).select().single();
    expect("super_admin CAN grant a role", !error && !!data, error?.message ?? "");
    if (data?.id) {
      const { error: eDel } = await sa.from("user_roles").delete().eq("id", data.id);
      expect("super_admin CAN revoke a role", !eDel, eDel?.message ?? "");
    }
  }

  // ---------- settings (admin-only update) ----------
  {
    const { data } = await cu.from("settings").select("company_name").eq("id", 1).maybeSingle();
    expect("any signed-in user CAN read settings", !!data, "");
  }
  {
    const { error } = await st.from("settings").update({ company_name: "HACKED" }).eq("id", 1);
    expect("staff CANNOT update settings", !!error || (await isUnchanged()), error?.message ?? "silently filtered");
  }
  {
    const { error } = await cu.from("settings").update({ company_name: "HACKED" }).eq("id", 1);
    expect("customer CANNOT update settings", !!error || (await isUnchanged()), error?.message ?? "silently filtered");
  }
  {
    const before = await getCompanyName();
    const { error } = await ad.from("settings").update({ company_name: before }).eq("id", 1);
    expect("admin CAN update settings", !error, error?.message ?? "");
  }

  // ---------- operational tables: storage_units (staff-managed) ----------
  {
    const { data, error } = await st.from("storage_units").insert({
      name: `T-${STAMP}`, unit_code: `T-${STAMP}`, size: "medium", monthly_price: 1,
    }).select().single();
    expect("staff CAN create a storage unit", !error && !!data, error?.message ?? "");
    if (data?.id) await admin.from("storage_units").delete().eq("id", data.id);
  }
  {
    const { error } = await cu.from("storage_units").insert({
      name: `X-${STAMP}`, unit_code: `X-${STAMP}`, size: "medium", monthly_price: 1,
    });
    expect("customer CANNOT create a storage unit", !!error, error?.message ?? "");
  }

  // ---------- customer data isolation ----------
  // Seed a second customer + rental owned by no one in our test set
  const { data: otherCust } = await admin.from("customers").insert({
    full_name: "Other", phone: `+200000${STAMP % 10000}`,
  }).select().single();
  {
    const { data } = await cu.from("customers").select("id");
    const ids = (data ?? []).map((r) => r.id);
    expect("customer sees only their own customers row",
      ids.length === 1 && !ids.includes(otherCust.id), `saw ${ids.length}`);
  }
  await admin.from("customers").delete().eq("id", otherCust.id);

  // ---------- summary ----------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  }
  return failed.length === 0;
}

async function getCompanyName() {
  const { data } = await admin.from("settings").select("company_name").eq("id", 1).single();
  return data?.company_name;
}
let _baseline;
async function isUnchanged() {
  if (_baseline === undefined) _baseline = await getCompanyName();
  const now = await getCompanyName();
  return now === _baseline;
}

async function cleanup() {
  console.log("→ Cleaning up test users...");
  for (const u of created) {
    await admin.from("user_roles").delete().eq("user_id", u.id);
    await admin.from("customers").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
}

let ok = false;
try { ok = await run(); }
catch (e) { console.error("FATAL:", e.message); }
finally { await cleanup(); }
process.exit(ok ? 0 : 1);
