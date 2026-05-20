# Role-Based Access — Manual QA Checklist

Companion to `scripts/test-rbac.mjs` (which verifies the database/RLS layer).
This checklist verifies the **UI layer**: that the right people see the right
buttons, pages, and menu items.

Run the automated suite first:
```
node scripts/test-rbac.mjs
```

## Test accounts to prepare

Create one user per role. After signup (which seeds `customer`), grant the
extra role from `Settings → Roles & Permissions` while signed in as a super
admin.

| Email                     | Role(s)                |
| ------------------------- | ---------------------- |
| qa-super@example.com      | super_admin            |
| qa-admin@example.com      | admin                  |
| qa-staff@example.com      | staff                  |
| qa-customer@example.com   | customer (default)     |

## Sign-in routing

- [ ] super_admin signs in → lands on `/app`
- [ ] admin signs in → lands on `/app`
- [ ] staff signs in → lands on `/app`
- [ ] customer signs in → lands on `/portal` (NOT `/app`)
- [ ] Visiting `/app` while signed in as customer → redirected/denied

## Settings page (`/app/settings`)

- [ ] super_admin: sees **Company settings** form AND **Roles & Permissions** card
- [ ] admin: sees **Company settings** form, **Roles & Permissions** card is HIDDEN
- [ ] staff: page loads but Company settings save is disabled / errors; Roles card HIDDEN
- [ ] customer: cannot reach `/app/settings` at all

## Roles & Permissions (super_admin only)

Signed in as **super_admin**:
- [ ] User list loads with all known users
- [ ] "Grant role" select shows: Super Admin, Admin, Staff, Payment Approver, Customer
- [ ] Grant `staff` to qa-customer → toast "Granted Staff", badge appears
- [ ] Revoke that staff badge → toast "Revoked Staff", badge disappears
- [ ] Quick-assign by user ID also works
- [ ] Cannot revoke own super_admin badge (DB policy blocks; toast surfaces error)

Signed in as **admin**:
- [ ] Navigating directly to `/app/settings` does NOT render the Roles card
- [ ] If you call `supabase.from('user_roles').insert(...)` from devtools, it returns an RLS error

## Operational pages (admin + staff)

- [ ] admin & staff: can open `/app/customers`, `/app/units`, `/app/rentals`, `/app/payments`
- [ ] admin & staff: can create a storage unit
- [ ] customer: cannot reach any `/app/*` route

## Payment approvals

- [ ] staff records a payment → status defaults to `pending_approval`
- [ ] payment_approver (or super_admin) approves → status flips to `paid`
- [ ] staff CANNOT approve (UI button hidden / DB trigger rejects)

## Customer portal (`/portal`)

Signed in as **customer**:
- [ ] Sees only their own active rentals, payments, and documents
- [ ] Stat cards show their own counts (not global)
- [ ] No access to other customers' data via direct URL guessing

## Sign-out

- [ ] Sign-out from any role returns to `/auth` and clears session
- [ ] Refreshing a protected page after sign-out redirects to `/auth`

---

If anything in this checklist fails, capture: the role, the URL, the action,
and the network response (status + body). RLS errors look like
`new row violates row-level security policy for table "X"` — that's the
database correctly refusing the request, not a bug.
