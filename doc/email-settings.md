# Attendance & Attendance Warnings Email Settings

Dashflow allows organizations to turn check-in, late arrival warnings, or check-out email alerts on or off.

## 1. Database Fields on the `Company` Entity

The configurations are saved inside the `Company` entity (database table `company`):

| Column | Type | Default | Description |
|---|---|---|---|
| `enableCheckInEmailAlert` | `boolean` | `true` | When `true`, check-in emails are sent to employees and notification alerts are sent to admin alert email addresses. |
| `enableLateEmailAlert` | `boolean` | `true` | When `true`, warning alerts are sent to the employee if they check in past the late threshold limit. |
| `enableCheckOutEmailAlert` | `boolean` | `true` | When `true`, work summaries are emailed to employees and checked-out notifications are emailed to admins on checkout. |

---

## 2. API Endpoints

### Exposing settings to the Frontend

Settings are configured as part of the company profile fields and can be read or modified by sending requests to the following REST API:

#### 1. Fetch Company Settings
* **Endpoint**: `GET /api/system-company/id/:id`
* **Response Body (extract)**:
  ```json
  {
    "id": "1e96499e-c166-4234-93a4-29049f45d28e",
    "name": "Difmo",
    "enableCheckInEmailAlert": true,
    "enableLateEmailAlert": true,
    "enableCheckOutEmailAlert": true
  }
  ```

#### 2. Update Company settings
* **Endpoint**: `PATCH /api/system-company/:id`
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Request Body**:
  ```json
  {
    "enableCheckInEmailAlert": false,
    "enableLateEmailAlert": false,
    "enableCheckOutEmailAlert": true
  }
  ```
* **Response**: Returns the fully updated Company object.
