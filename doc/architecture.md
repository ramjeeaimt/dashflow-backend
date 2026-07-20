# Architecture Overview

This document outlines the main modules and directory structure of the Dashflow codebase.

## 1. Directory Structure

```
src/
├── app.controller.ts            # Root controller
├── app.module.ts                # Main application module containing TypeORM and feature imports
├── app.service.ts                # Root service
├── main.ts                       # Application bootstrap (local server)
├── serverless.ts                 # Serverless launcher for Vercel
├── setup.ts                      # Common app configuration (CORS, Pipes, Swagger)
├── common/                       # Shared interceptors, middleware, filters, guards
└── modules/                      # Business logic divided into feature modules
    ├── access-control/           # RBAC (Role/Permission entities and services)
    ├── attendance/               # Daily check-in/out records, location checking, WFH status
    ├── auth/                     # JWT Authentication (login, registration, password resets)
    ├── clients/                  # Client billing details, invoicing, Puppeteer PDF generators
    ├── companies/                # Company profile and attendance/payroll policies
    ├── departments/              # Organization departments
    ├── designations/             # Designation seeding and mapping
    ├── email-templates/          # Custom handlebars email bodies
    ├── employees/                # Employee directories and contract metadata
    ├── finance/                  # Payroll generation and expense tracking
    ├── mail/                     # Nodemailer configuration and email template routing
    └── notifications/            # Push, socket-io, email unified notification router
```

## 2. Core Workflows

### Authentication
* Users login via `POST /api/auth/login`.
* The server validates passwords using `bcrypt` and returns a signed JWT containing basic session details (`userId`, `companyId`, `loginRole`).
* All secure routes use `JwtAuthGuard` to populate `req.user` for CASL authorization check.

### Attendance
* Check-in (`POST /api/attendance/check-in`) verifies WFH request status and logs either `present`, `early_checkin` or `late`.
* Based on company settings, check-in alerts are dispatched to configured administrators.
* Check-out (`POST /api/attendance/check-out`) updates the daily record, calculates total work and overtime hours, and optional email alerts are generated.
