# Dash-flow Backend — Architecture

> Stack: **NestJS 10 · TypeORM 0.3 · PostgreSQL** (SQLite fallback in dev) · Socket.IO · Firebase Admin (FCM push) · Nodemailer/Handlebars (email) · Cloudinary (files) · Swagger.

## Design: Modular Monolith

Every business capability lives in its own NestJS module under `src/modules/<name>/`.
Each module owns its **controller → service → entity/DTOs** and communicates with other
modules through injected services or events (`@nestjs/event-emitter`) — never by reaching
into another module's repository directly. This keeps each module extractable into a
microservice later: its boundary is already its public service API + emitted events.

```
src/
├── main.ts                # bootstrap, crash handling, graceful shutdown
├── setup.ts               # global pipes/filters/interceptors, CORS, Swagger
├── app.module.ts          # module registry + TypeORM connection
├── common/                # cross-cutting concerns (shared kernel)
│   ├── decorators/        # @Roles(), @CurrentUser(), ...
│   ├── dto/               # shared DTOs (pagination, ...)
│   ├── filters/           # HttpExceptionFilter (uniform error envelope)
│   ├── guards/            # JwtAuthGuard, RolesGuard
│   ├── interceptors/      # TransformInterceptor (uniform success envelope)
│   └── middleware/        # request logger
├── config/                # configuration helpers
└── modules/               # one folder per business capability (see below)
```

## Module map (26 modules)

| Domain | Modules |
|---|---|
| Identity & access | `auth`, `users`, `access-control` (roles/permissions), `companies` |
| HR | `employees`, `departments`, `designations`, `attendance`, `leaves`, `wfh-requests`, `overtime` |
| Work | `projects` (projects+tasks), `project` (AllProject portfolio), `clients`, `time-tracking`, `jobs` (recruitment) |
| Money | `finance` (payroll+expenses), `invoices`, `companyGstDocs` |
| Communication | `notifications` (in-app + WebSocket gateway + FCM), `mail`, `email-templates` |
| Support | `dashboard` (aggregation), `audit-logs`, `upload`, `cloudinary` |

## Request lifecycle

1. `LoggerMiddleware` — request log.
2. Guards — `JwtAuthGuard` (Passport JWT) then role/permission guards.
3. `ValidationPipe` (global, whitelist + transform) — every body/query validated by class-validator DTOs. Unknown properties are stripped; bad payloads → 400 before hitting business logic.
4. Controller → Service (business logic) → TypeORM repository.
5. `TransformInterceptor` wraps success as `{ statusCode, message, data }`.
6. `HttpExceptionFilter` wraps failures in a matching error envelope.

**Contract: every response is enveloped.** The frontend unwraps `response.data.data`.

## Data layer

- TypeORM with `synchronize` enabled **only in development** (`DB_SYNCHRONIZE=true` override). Production must use migrations — never auto-sync.
- Connection selection: `DATABASE_URL_PROD` / `DATABASE_URL_DEV` / `DATABASE_URL` by `NODE_ENV`; falls back to SQLite in dev when unset.
- Pool: max 20, SSL relaxed for hosted PG.
- ⚠️ `prisma/`, `mongoose`, `@supabase/supabase-js`, `sqlite3` (when PG in use) are **legacy/unused** — do not build on them. Candidates for removal (tracked in PROGRESS.md).

## Notifications architecture

One capability, three channels, all fanned out from `notifications.service.ts`:

- **In-app**: `Notification` entity persisted, delivered live over Socket.IO (`notifications.gateway.ts`, room per user).
- **Push**: Firebase Admin → FCM tokens stored per device in `FcmToken` entity.
- **Email**: `mail` module (Nodemailer + Handlebars templates in `email-templates/`).

Rule: business modules **emit events** (e.g. `leave.approved`); the notifications module listens and decides channels. Business services must not call mail/FCM directly.

## Environments & ops

- Deployed on Vercel serverless (`serverless.ts` entry) and runnable as a long-lived Node process (`main.ts`).
- Health probe: `GET /api/health` (uptime, DB connectivity).
- Crash handling: `unhandledRejection` / `uncaughtException` are logged; shutdown hooks close the DB pool and HTTP server gracefully.

## Conventions

- One module = one folder; controller thin, service owns logic; DTO per endpoint.
- Cross-module writes go through the owning module's service.
- All new endpoints require: DTO validation, guard coverage, Swagger decorators, and an entry in `docs/BUSINESS-LOGIC.md`.
