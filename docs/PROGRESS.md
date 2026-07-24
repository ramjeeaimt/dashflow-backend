# Backend Progress Tracker

> Update this file at the end of every work session. Newest session on top.
> Overall completion is a judgement call — tie it to `BUSINESS-LOGIC.md` verification counts.

**Overall: ~60% — structure solid, most flows implemented but unverified; hardening in progress.**

## Workstream status

| Workstream | Status | Notes |
|---|---|---|
| Modular folder structure | ✅ done | 26 modules, controller/service/entity per module |
| Global validation (whitelist/transform) | ✅ done | 2026-07-07 |
| Uniform response/error envelope | ✅ done | TransformInterceptor + HttpExceptionFilter |
| Security headers + compression | ✅ done | helmet + compression, 2026-07-07 |
| CORS lockdown | ✅ done | strict allowlist in production, 2026-07-07 |
| Health endpoint | ✅ done | GET /api/health with DB probe, 2026-07-07 |
| Crash handling + graceful shutdown | ✅ done | process handlers + enableShutdownHooks, 2026-07-07 |
| DB migrations (replace synchronize) | ⬜ todo | HIGH PRIORITY before prod schema changes |
| Server-side permission enforcement audit | ⬜ todo | verify guards on every mutating route |
| Notification event-driven refactor | 🟡 partial | gateway+FCM+email exist; fan-out rules need consolidation |
| Business-logic verification pass | 🟡 in progress | see BUSINESS-LOGIC.md — most rows 🟡 |
| Dead dependency removal (prisma/mongoose/supabase/sqlite3) | ⬜ todo | verify no imports first, then uninstall |
| Overtime module registration | ⬜ todo | module exists but not imported in app.module.ts |
| Duplicate project modules consolidation | ⬜ todo | `projects` vs `project` |
| Rate limiting (@nestjs/throttler) | ⬜ todo | at least on /auth/* |
| Caching for dashboard aggregates | ⬜ todo | |
| Test suite (unit for services w/ money math) | ⬜ todo | payroll, leave balance first |

## Session log

### 2026-07-07 (security fixes + features) — verified against live DB
- **Payroll exposure (CRITICAL) FIXED**: non-privileged callers hard-scoped to own +
  finalized records in `finance.controller.ts`; `user.password`/OTP stripped in
  `finance.service.findAllPayroll`; payslip PDF endpoint now checks ownership
  (`isPayrollOwnedBy`). Added `isPayrollPrivileged` helper (role- or permission-based,
  not hardcoded emails).
- **Access-control unguarded (HIGH) FIXED**: `AbilitiesGuard` + `CheckAbilities` on every
  `/access-control/*` route.
- **Pagination**: payroll endpoint accepts `page`/`limit` (in-memory slice after de-dup).
- Retested with real admin+employee creds: employee payroll scoped to self+sent, no
  password leak, `/roles` 403; admin unaffected; cross-employee payslip 403.
- Root cause noted for follow-up: `ability.factory.ts` grants `can(Read,'payroll')` to
  EVERY user unconditionally — controller scoping now defends against it, but the factory
  grant should be tightened to `{ employeeId: user.id }` too (defense in depth).

### 2026-07-07 (later) — Response-time optimization pass (Claude session)
Same business logic, fewer/lighter queries:
- **JWT strategy**: per-request 6-relation user lookup now cached in-memory for
  `AUTH_USER_CACHE_TTL_MS` (default 30s) — this ran on EVERY authenticated request.
- **Dashboard `getMetrics`**: employee list load → SQL `COUNT`.
- **Dashboard `getChartData`**: 7 per-day attendance loads (3 joins each) → 1 grouped
  COUNT query (`AttendanceService.countByDate`).
- **Dashboard `getFeedData`**: leaves + pending approvals now company-scoped in SQL
  (previously loaded ALL companies' leaves and filtered in JS); audit logs via new
  `findRecentForCompany` (joined+limited in SQL — the old JS filter silently matched
  nothing because `user.company` wasn't loaded, so audit items now correctly appear
  in the feed); employee-view no longer runs the unused pending-leaves query; user's
  approved leaves filtered in SQL.
- **Notifications**: FCM token fetch per recipient → one `IN()` query.
- **Payroll generation**: 2 queries per employee (existing payroll + full attendance
  history) → 2 bulk queries total; month filtering unchanged (JS) so results identical.
- Verified: `npm run build` passes. Runtime verification against a live DB still pending.

### 2026-07-07 — Hardening + docs baseline (Claude session)
- Created `docs/` (ARCHITECTURE, BUSINESS-LOGIC checklist, PROMPT, PROGRESS).
- Audited stack: TypeORM+PG is the real data layer; Prisma schema empty, Mongoose/Supabase unused.
- Hardening: strict ValidationPipe, helmet, compression, strict prod CORS, health endpoint,
  crash handlers, graceful shutdown, prod synchronize guard.
- Verified: `npm run build` passes. (see BUSINESS-LOGIC.md for flow-level status)
