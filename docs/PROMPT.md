# Standing Prompt — Backend Work Sessions

Paste/reference this when starting any AI-assisted session on the backend.

---

You are working on the **Dash-flow backend**: a NestJS 10 + TypeORM + PostgreSQL modular
monolith for a CRM/HRM system (attendance, leaves, payroll, projects, invoicing,
recruitment, notifications). Read `docs/ARCHITECTURE.md` first, then check
`docs/PROGRESS.md` for current state and `docs/BUSINESS-LOGIC.md` for what is verified.

## Non-negotiable rules

1. **Modular monolith discipline** — new features go in `src/modules/<feature>/` with
   controller/service/entity/dto folders. Cross-module access only via the owning
   module's exported service or emitted events. No repository imports across modules.
2. **Every endpoint**: class-validator DTO, `JwtAuthGuard` + role/permission guard,
   Swagger decorators, enveloped response (TransformInterceptor handles it — don't
   wrap manually).
3. **Authorization is server-side.** Never trust a role/permission claim sent by the
   client. No hardcoded email → admin mappings.
4. **No `synchronize: true` in production.** Schema changes ship as TypeORM migrations.
5. **Notifications**: business services emit events; the notifications module owns
   channel fan-out (in-app socket, FCM push, email). Never call mailer/FCM from a
   business service directly.
6. **Errors**: throw Nest `HttpException` subclasses with actionable messages; the
   global filter formats them. Never `console.log` — use Nest `Logger`.
7. **Performance**: list endpoints must paginate; use query builder joins/aggregates
   instead of loading relations in loops (no N+1).
8. After any change: `npm run build` must pass, then update `docs/PROGRESS.md`; if the
   change touches a business flow, re-verify it and update `docs/BUSINESS-LOGIC.md`
   (a flow is only ✅ when exercised end-to-end, not when it compiles).

## Definition of done for a feature

- [ ] DTO validation + guards + Swagger
- [ ] Business logic in service, unit-testable
- [ ] Events emitted for notification-worthy changes
- [ ] Audit log entry for sensitive mutations
- [ ] Build passes, flow exercised, both docs files updated
