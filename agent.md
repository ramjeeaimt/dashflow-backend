# Dashflow Developer & Agent Guidelines

This document defines the architectural overview, guidelines, and constraints for modifying and extending the Dashflow backend application.

## 1. Project Overview & Tech Stack

Dashflow is an enterprise CRM and HRMS platform designed to manage attendance, payroll, projects, clients, leaves, and notifications.

- **Framework**: NestJS (v10)
- **Database ORM**: TypeORM (v0.3) connecting to PostgreSQL (Supabase / Neon)
- **Email Dispatcher**: Nodemailer using Gmail SMTP
- **Real-time Notifications**: Socket.io for live alerts + Firestore Sync for client-side notifications
- **PDF Generation**: Puppeteer / Chromium to render premium PDFs for invoices and payroll slips

---

## 2. Configuration & Environment Settings

The backend configuration is managed via `@nestjs/config`. Key configuration environment variables include:

* `DATABASE_URL_PROD`: Main connection string for production database (Supabase).
* `DATABASE_URL_DEV`: Staging database URL.
* `JWT_SECRET`: Secret key used for signing JWT login tokens.
* `DB_SYNCHRONIZE`: Boolean indicating whether database schemas should be auto-synchronized.
* SMTP variables (`MAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`) to configure Nodemailer.

---

## 3. Core Database Models

* **Company**: Holds company profile, policies (work days, hours, thresholds), and global email alert configurations.
* **User**: Represents registered accounts containing email, hashed password, primary company, extra companies list, permissions, and roles.
* **Employee**: Detail about an active employee (linked to a User), designation, department, salary, WFH status, check-in schedules, and leaves.
* **Attendance**: Records daily check-in/out logs, working hours, locations (Office, WFH), notes, and check-in statuses (present, late, early_checkin, wfh).

---

## 4. Newly Added Settings for Email Alerts

To let administrators decide whether check-in, late warnings, or check-out emails are dispatched, the following columns are exposed in the `Company` entity:

1. `enableCheckInEmailAlert` (`boolean`, default: `true`): Controls whether employee and admin check-in emails are sent.
2. `enableLateEmailAlert` (`boolean`, default: `true`): Controls whether warning emails for late arrivals are sent to employees.
3. `enableCheckOutEmailAlert` (`boolean`, default: `true`): Controls whether employee and admin check-out summary emails are sent.

To modify these, send a PATCH request to the company settings endpoint:
* **Route**: `PATCH /api/system-company/:id`
* **Payload**:
  ```json
  {
    "enableCheckInEmailAlert": false,
    "enableCheckOutEmailAlert": true,
    "enableLateEmailAlert": false
  }
  ```

---

## 5. Coding & Contribution Rules

1. **Keep Type Definitions Strict**: Avoid using `any` unless absolutely necessary.
2. **Schema Safety**: If modifying database entities, ensure columns are documented and default values are set.
3. **SMTP / Mail Template Safety**: Ensure template handlebars variables match those configured in `/src/modules/mail/mail.service.ts` or corresponding `.hbs` templates.
4. **Bootstrap Consistency**: All bootstrap/startup scripts (such as seeders) must run properly against both Dev and Prod databases using configuration loaders.
