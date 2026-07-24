# Business Logic Inventory & Verification Checklist

Status legend: ✅ verified working · 🟡 implemented, not yet verified · 🔴 broken / incomplete · ⬜ not implemented

**Verification rule:** a row may only be marked ✅ after the flow has been exercised end-to-end
(request → DB state → notification/side-effects) — a compile pass is NOT verification.
When you verify a row, note the date and how it was tested.

## Identity & Access

| Flow | Status | Verified on | Notes |
|---|---|---|---|
| Company registration (creates company + admin user) | 🟡 | | |
| Login → JWT issued with roles/permissions | ✅ | 2026-07-07 API test | admin + employee login return token + roles + permissions; wrong password → 401 "Invalid email or password" |
| Multi-company switch (re-issues JWT for company) | ✅ | 2026-07-07 API test | `/auth/my-workspaces` returns workspaces; profile carries company |
| Role & permission read (access-control) | ✅ FIXED | 2026-07-07 fix+retest | Added `AbilitiesGuard` + `CheckAbilities` to all `/access-control/*` routes (read → `read access-control`, writes → `manage access-control`). Retest: employee `/roles` & `/permissions` now **403**; admin still 200. |
| Admin bypass | 🔴 | | Hardcoded email list on the FRONTEND only — server must be authority. Also still hardcoded in `finance.controller.ts`. |
| Password reset / change | 🟡 | | seed scripts exist; confirm user-facing flow |

## HR

| Flow | Status | Verified on | Notes |
|---|---|---|---|
| Employee CRUD + department/designation assignment | ✅ (read) | 2026-07-07 API test | list/count/departments/designations return data; employee correctly blocked from listing others ("You can only access your own employee record"); password hash correctly stripped here |
| Attendance check-in/check-out (day boundary, late marking) | 🟡 | | read paths verified (today/history/analytics 200); check-in/out writes not exercised (real DB) |
| Attendance alerts email (company.attendanceAlertEmails) | 🟡 | | |
| Leave request → approval/rejection → balance deduction | 🟡 | | verify balance math + overlapping-leave rejection |
| Leave approval notification (in-app + email) | 🟡 | | test-leave.ts scratch script exists |
| WFH request → approval flow | 🟡 | | |
| Overtime tracking | 🟡 | 2026-07-07 (code read) | working path lives in `attendance` (overtime computed on checkout); `modules/overtime/` is an abandoned stub (entity+service only, no module/controller) — delete or finish |

## Work Management

| Flow | Status | Verified on | Notes |
|---|---|---|---|
| Client CRUD | 🟡 | | |
| Project + task CRUD, assignment, status transitions | 🟡 | | two overlapping modules: `projects` and `project` (AllProject) — consolidate or document the split |
| Time-entry logging against tasks/projects | 🟡 | | |
| Recruitment: job posting → application → messaging | 🟡 | | |

## Finance

| Flow | Status | Verified on | Notes |
|---|---|---|---|
| Payroll list / read (access control) | ✅ FIXED | 2026-07-07 fix+retest | Non-privileged callers are now hard-scoped to their OWN records + finalized (sent/paid) only, `companyId` ignored; `user.password`/OTP stripped from all payroll responses (admin too). Retest: employee sees 10 rows, 1 distinct employee (self), statuses={sent}, **PASSWORD_LEAK=False**; admin sees 24 rows, PASSWORD_LEAK=False. |
| Payslip PDF access (`/payroll/:id/slip`) | ✅ FIXED | 2026-07-07 fix+retest | Was unauthenticated-by-ownership. Now only a payroll-privileged user or the owning employee can fetch. Retest: employee OWN slip 200 (1 MB PDF), OTHER employee's slip **403**, admin any slip 200. |
| Employee sees finalized payslip on dashboard | ✅ | 2026-07-07 | Employee dashboard now shows latest sent/paid payslip (net pay + status) with link to full list; drafts never shown (backend filters). |
| Payroll generation (salary computation) | 🟡 | | not exercised on live DB (would mutate real payroll); code-optimized this session (bulk queries) — needs number-parity check |
| Payslip PDF generation + email | 🟡 | | recent commits touched this ("payslip email update") |
| Expense recording & approval | ✅ (authz) | 2026-07-07 API test | employee correctly DENIED read (403 "Cannot execute read on expense"); admin read 200 (9 rows) |
| Invoice creation + PDF | 🟡 | | pdfkit/pdf-lib/puppeteer all present — should be ONE pdf pipeline |
| Company GST docs upload | 🟡 | | |

## Communication

| Flow | Status | Verified on | Notes |
|---|---|---|---|
| In-app notification list (history/mine/stats) | ✅ (read) | 2026-07-07 API test | admin history 200 (100), mine 200 (30), stats 200; employee mine 200 (30). Socket delivery not tested. |
| FCM push (token register, send, prune dead tokens) | 🟡 | | test-push.ts scratch script exists; send not exercised |
| Email templates CRUD + rendered sends | ✅ (read) | 2026-07-07 API test | list 200 (0 templates for this company) |
| Notification read/unread + list pagination | 🟡 | | mark-read not exercised (write) |

## Support

| Flow | Status | Verified on | Notes |
|---|---|---|---|
| Dashboard aggregates (per role) | ✅ | 2026-07-07 API test | metrics/charts/feed/financials all 200 for admin; employee metrics 200 with userId scope. Optimized queries from this session return correctly. |
| Work: projects/tasks/clients/time-tracking/jobs read | ✅ | 2026-07-07 API test | all 200 (projects 5, others empty for this company) |
| Audit log write on sensitive mutations | 🟡 | | confirm coverage: auth, finance, access-control at minimum |
| File upload → Cloudinary | 🟡 | | |

## 🔴 CRITICAL findings from 2026-07-07 live API test (39/41 endpoints pass)

Tested with real credentials (1 admin, 1 employee) against local backend + live DB.
Read-only; no writes performed. Two authorization failures — both confirmed:

1. **Payroll data exposure (CRITICAL).** `GET /finance/payroll?companyId=X` returns the
   entire company's payroll to any authenticated employee — all salaries — and leaks
   **bcrypt password hashes** + full company settings via the nested `employee.user` and
   `employee.company` relations. Three compounding causes, each worth fixing:
   - The **Employee role has `read payroll`** permission (check the permission seed / role config).
   - The payroll controller **does not scope an employee to their own records** when a
     `companyId` query param is supplied (it trusts the param over the caller's identity).
   - Payroll serialization **does not strip `user.password`** (the `/employees` and
     `/auth/profile` endpoints DO strip it correctly — payroll is the outlier).
   Fix: remove/scope the employee payroll permission; in the controller force
   `employeeId = req.user.employeeId` for non-privileged callers; add `select: false` on
   the password column or a class-transformer `@Exclude()` + serialization interceptor.

2. **Access-control endpoints unguarded (HIGH).** `/access-control/*` carries only
   `JwtAuthGuard` — no `AbilitiesGuard`/`CheckAbilities`. Any employee can `GET /roles`
   and `/permissions`; the `POST /roles`, `POST /permissions`, `POST /seed` writes appear
   equally unguarded (privilege escalation — not exercised, to avoid polluting the real DB).
   Fix: add `AbilitiesGuard` + `@CheckAbilities({ action: 'manage', subject: 'access-control' })`.

Everything else tested clean: auth (incl. wrong-password 401), dashboards, HR reads,
finance summary, work modules, notifications, and — importantly — the employee was
correctly denied `/employees` (403) and `/finance/expenses` (403), proving the ability
guard works where it's actually applied. The two failures above are missing/mis-scoped
guards, not a broken guard system.

## Known cross-cutting gaps (must fix before marking flows ✅)

1. **Authorization source of truth** — permission checks must be enforced server-side by guards on every mutating route; frontend checks are UX only.
2. **Overtime module not registered** in `app.module.ts` imports.
3. **Dead data layers** (Prisma schema empty, Mongoose unused, Supabase unused) — remove to prevent confusion.
4. **Duplicate project modules** (`projects` vs `project`).
5. Scratch/test files in repo root (`test-push.ts`, `scratch_upload*.js`, `src/test-email.ts`, `src/test-leave.ts`) — move under `scripts/` or delete.
