# AIEmployee.vn API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:3000/api`
**Content-Type:** `application/json`

---

## Overview

AIEmployee.vn API allows businesses to manage AI employees, tasks, subscriptions, and Vietnamese e-invoicing (TKP ACI integration). All requests require a valid subscription and return JSON responses.

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

Error responses follow the same structure with `success: false` and an `error` field.

---

## Resources

### Plans

#### List Available Plans
```
GET /plans
```
Returns all subscription plans.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan_001",
      "name": "Starter",
      "price": 490000,
      "employeeCount": 3,
      "features": ["Task Management", "Email Support"]
    }
  ]
}
```

#### Get Plan
```
GET /plans/:id
```

---

### Contacts

#### Submit Contact Form
```
POST /contacts
```

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Min 2 characters |
| company | string | Yes | Company name |
| email | string | Yes | Valid email address |
| phone | string | No | Phone number |
| plan | string | No | Interested plan ID |
| message | string | No | Additional message |

**Response:** `201 Created`

---

#### List Contacts
```
GET /contacts?status=new|contacted|qualified|converted|lost
```

#### Get Contact
```
GET /contacts/:id
```

#### Update Contact Status
```
PATCH /contacts/:id
```
**Body:** `{ "status": "contacted" }`

Valid statuses: `new`, `contacted`, `qualified`, `converted`, `lost`

---

### Subscriptions

#### Create Subscription
```
POST /subscriptions
```
**Body:**
```json
{
  "contactId": "uuid",
  "planId": "plan_001"
}
```

#### Get Subscription
```
GET /subscriptions/:id
```

---

### Employees

#### Create AI Employee
```
POST /employees
```
**Body:**
```json
{
  "subscriptionId": "uuid",
  "name": "Sales Bot",
  "role": "sales",
  "config": {}
}
```

**Employee Limits:** Based on subscribed plan.

#### List Employees
```
GET /employees
```

#### Get Employee
```
GET /employees/:id
```

#### Update Employee
```
PATCH /employees/:id
```
**Body:** `{ "name": "New Name", "role": "support", "status": "active", "config": {} }`

#### Delete Employee
```
DELETE /employees/:id
```

---

### Tasks

#### Create Task
```
POST /tasks
```
**Body:**
```json
{
  "employeeId": "uuid",
  "title": "Follow up with lead",
  "description": "Call the prospect within 24 hours",
  "priority": "high|medium|low"
}
```

#### List Tasks
```
GET /tasks?status=pending|in_progress|completed|cancelled&employeeId=uuid
```

#### Get Task
```
GET /tasks/:id
```

#### Update Task
```
PATCH /tasks/:id
```
**Body:** `{ "status": "completed", "title": "...", "priority": "high" }`

Valid statuses: `pending`, `in_progress`, `completed`, `cancelled`

---

### Metrics

#### System Metrics
```
GET /metrics
```
Returns aggregated counts for contacts, employees, and tasks with completion rate.

---

### E-Invoices (Vietnamese Tax Invoices)

#### Create E-Invoice
```
POST /invoices
```
**Body:**
```json
{
  "seller": {
    "taxCode": "0123456789",
    "name": "Công Ty TNHH AI Việt Nam",
    "address": "123 Nguyễn Trãi, Q1, HCM",
    "bankAccount": "1234567890"
  },
  "buyer": {
    "taxCode": "9876543210",
    "name": "Công Ty ABC",
    "address": "456 Lê Lợi, Q1, HCM"
  },
  "items": [
    {
      "name": "AIEmployee License",
      "quantity": 5,
      "unit": "license",
      "price": 490000,
      "total": 2450000
    }
  ],
  "paymentMethod": "bank_transfer",
  "dueDate": "2026-04-30"
}
```

#### List Invoices
```
GET /invoices?status=issued|failed&sellerTaxCode=...&buyerTaxCode=...
```

#### Get Invoice
```
GET /invoices/:id
```

#### Lookup Company by Tax Code
```
GET /invoices/lookup/taxcode/:taxCode
```

#### E-Invoice Webhook
```
POST /webhooks/einvoice-status
```
Receives status updates from TKP ACI portal.

**Body:**
```json
{
  "invoiceCode": "INV001",
  "status": "issued",
  "message": "Hóa đơn đã được phê duyệt",
  "timestamp": "2026-04-02T10:00:00Z"
}
```

---

### VAT Calculator

Vietnamese VAT calculation with multiple rate support and currency formatting.

#### Calculate VAT from Net Amount
```
POST /vat/calculate
```
**Body:**
```json
{
  "netAmount": 1000000,
  "vatRate": 10
}
```
Returns: `{ netAmount, vatAmount, grossAmount, amountInWords, formattedNet, formattedVat, formattedGross }`

#### Calculate VAT from Gross Amount
```
POST /vat/calculate-from-gross
```
**Body:**
```json
{
  "grossAmount": 1100000,
  "vatRate": 10
}
```

#### Calculate VAT for Multiple Items
```
POST /vat/calculate-multiple
```
**Body:**
```json
{
  "items": [
    { "description": "Item 1", "netAmount": 1000000, "vatRate": 10 },
    { "description": "Item 2", "netAmount": 500000, "vatRate": 8 }
  ]
}
```
Returns itemized breakdown plus totals.

#### Get Supported VAT Rates
```
GET /vat/rates
```
Returns supported VAT rates (0%, 5%, 8%, 10%).

#### Get VAT Rate by Category
```
GET /vat/rate/:category
```
Categories: `essential_goods` (5%), `normal` (10%), `luxury` (15%), `exempt` (0%).

---

### Invoice OCR

Extract data from invoice images and PDFs using OCR.

#### Process Invoice Image/PDF
```
POST /ocr/invoice
```
**Body:**
```json
{
  "fileData": "base64_encoded_or_url",
  "fileType": "jpeg|png|pdf",
  "options": {
    "language": "vi",
    "extractTables": true,
    "detectCurrency": true,
    "validateTaxCode": true
  }
}
```
Returns extracted invoice data including seller, buyer, items, and tax amounts.

#### Get OCR Templates
```
GET /ocr/templates
```
Returns preprocessing options and supported formats.

---

### Tax Compliance

Validate Vietnamese invoices against compliance rules (Circular 68).

#### Check Invoice Compliance
```
POST /compliance/check
```
**Body:**
```json
{
  "invoice": {
    "invoiceNumber": "INV001",
    "seller": { "taxCode": "0123456789", "name": "..." },
    "buyer": { "taxCode": "9876543210", "name": "..." },
    "items": [...],
    "vatRate": 10
  }
}
```
Returns compliance status and validation report.

#### Validate Vietnamese Tax Code (MST)
```
POST /compliance/validate-taxcode
```
**Body:**
```json
{
  "taxCode": "0123456789",
  "entityType": "Entity|Individual|Organization"
}
```
Returns validation result with check digit verification.

#### Get Compliance Rules
```
GET /compliance/rules
```
Returns Circular 68 rules, allowed VAT rates, timing rules, and tax code requirements.

---

### Data Quality (COM-102 / COM-200)

Validate, normalize, and check data quality including freshness and duplicates.

#### Validate Input Data
```
POST /quality/validate
```
**Body:**
```json
{
  "data": { "email": "  User@Example.com  ", "phone": "0909123456" },
  "rules": { "email": { "trim": true, "toLowerCase": true }, "phone": { "trim": true, "standardizePhone": true } }
}
```

#### Validate Against JSON Schema
```
POST /quality/validate/schema
```
**Body:**
```json
{
  "data": { "name": "Nguyễn Văn A", "age": 25 },
  "schema": { "type": "object", "properties": { "name": { "type": "string" }, "age": { "type": "number" } } }
}
```

#### Normalize Data
```
POST /quality/normalize
```
**Body:**
```json
{
  "data": { "email": "  User@Example.com  ", "phone": "0909123456" },
  "rules": { "email": { "trim": true, "toLowerCase": true }, "phone": { "trim": true, "standardizePhone": true } }
}
```

#### Check Data Freshness
```
POST /quality/freshness
```
**Body:**
```json
{
  "data": { "lastUpdated": "2026-04-01T10:00:00Z" },
  "options": { "maxAgeHours": 24 }
}
```

#### Batch Freshness Check
```
POST /quality/freshness/batch
```
**Body:**
```json
{
  "items": [
    { "id": "1", "lastUpdated": "2026-04-01T10:00:00Z" },
    { "id": "2", "lastUpdated": "2026-04-03T10:00:00Z" }
  ],
  "options": { "maxAgeHours": 24 }
}
```

#### Check for Duplicates
```
POST /quality/duplicate
```
**Body:**
```json
{
  "data": { "email": "user@example.com", "phone": "0909123456" },
  "keyFields": ["email", "phone"],
  "options": { "similarityThreshold": 0.9 }
}
```

#### Find Duplicates in Dataset
```
POST /quality/duplicate/find
```
**Body:**
```json
{
  "items": [
    { "id": "1", "email": "user@example.com" },
    { "id": "2", "email": "user@example.com" }
  ],
  "keyFields": ["email"]
}
```

#### Clear Duplicate Detection Cache
```
DELETE /quality/duplicate/cache
```

#### Get Data Quality Service Status
```
GET /quality/status
```

#### Get Supported Validation Types
```
GET /quality/types
```
Returns supported validation types and formats.

---

### Zalo Integration (COM-82)

Send notifications and messages via Zalo platform.

#### Get Zalo Service Status
```
GET /zalo/status
```

#### Get Available Templates
```
GET /zalo/templates
```

#### Send Message
```
POST /zalo/message
```
**Body:**
```json
{
  "userId": "zalo_user_id",
  "message": "Hello",
  "type": "text"
}
```

#### Send Text Message
```
POST /zalo/message/text
```
**Body:** `{ "userId": "...", "text": "..." }`

#### Send Template Message
```
POST /zalo/message/template
```
**Body:**
```json
{
  "userId": "...",
  "templateId": "template_id",
  "templateData": {}
}
```

#### Send Invoice Notification
```
POST /zalo/notification/invoice
```
**Body:** `{ "userId": "...", "invoice": {...} }`

#### Send Payment Confirmation
```
POST /zalo/notification/payment
```
**Body:** `{ "userId": "...", "payment": {...} }`

#### Send Payment Reminder
```
POST /zalo/notification/reminder
```
**Body:** `{ "userId": "...", "reminder": {...} }`

#### Process Zalo Webhook
```
POST /zalo/webhook
```

---

### Alerting (COM-201)

Create and manage alerts with acknowledgment, escalation, and webhook support.

#### Create Alert
```
POST /alerts
```
**Body:**
```json
{
  "title": "High CPU usage",
  "message": "Server CPU above 90%",
  "level": "critical|alert|warning",
  "source": "monitoring",
  "metadata": {},
  "tags": ["server", "cpu"]
}
```

#### List Alerts
```
GET /alerts?level=critical&status=active&source=monitoring&limit=20&offset=0
```

#### Get Alert Statistics
```
GET /alerts/stats
```

#### Get Active Alerts
```
GET /alerts/active
```

#### Get Alert by ID
```
GET /alerts/:id
```

#### Update Alert
```
PATCH /alerts/:id
```
**Body:** `{ "title": "...", "message": "...", "level": "warning" }`

#### Acknowledge Alert
```
POST /alerts/:id/acknowledge
```
**Body:** `{ "acknowledgedBy": "user@example.com" }`

#### Resolve Alert
```
POST /alerts/:id/resolve
```
**Body:** `{ "resolvedBy": "admin@example.com", "resolutionNote": "Restarted server" }`

#### Escalate Alert
```
POST /alerts/:id/escalate
```

#### Add Comment to Alert
```
POST /alerts/:id/comments
```
**Body:** `{ "comment": "Investigating...", "author": "admin@example.com" }`

#### Get Alert History
```
GET /alerts/:id/history
```

#### Delete Alert
```
DELETE /alerts/:id
```

#### Bulk Acknowledge
```
POST /alerts/bulk/acknowledge
```
**Body:** `{ "alertIds": ["id1", "id2"], "acknowledgedBy": "admin" }`

#### Bulk Resolve
```
POST /alerts/bulk/resolve
```
**Body:** `{ "alertIds": ["id1", "id2"], "resolvedBy": "admin", "resolutionNote": "Fixed" }`

#### Get Alert Levels
```
GET /alerts/levels
```

#### Export Alerts
```
GET /alerts/export?format=csv&level=critical&status=active
```

#### Register Webhook
```
POST /alerts/webhooks
```
**Body:** `{ "url": "https://example.com/webhook", "events": ["all"] }`

#### List Webhooks
```
GET /alerts/webhooks
```

#### Remove Webhook
```
DELETE /alerts/webhooks/:id
```

#### Cleanup Old Alerts
```
DELETE /alerts/cleanup
```
**Body:** `{ "olderThanDays": 30 }`

#### Get Alerting Service Status
```
GET /alerts/status
```

---

### Backup (COM-204)

3-2-1 Strategy: 3 copies, 2 media types, 1 offsite. Full, incremental, and differential backups.

#### Create Full Backup
```
POST /backups
```
**Body:** `{ "data": { ... }, "metadata": { "description": "Full backup" } }`

#### Create Incremental Backup
```
POST /backups/incremental
```
**Body:** `{ "data": { ... }, "baseBackupId": "backup_id", "metadata": {} }`

#### Create Differential Backup
```
POST /backups/differential
```
**Body:** `{ "data": { ... }, "baseBackupId": "backup_id", "metadata": {} }`

#### List Backups
```
GET /backups?type=full&status=completed&limit=20&offset=0
```

#### Get Backup Statistics
```
GET /backups/stats
```

#### Get Backup by ID
```
GET /backups/:id
```

#### Restore from Backup
```
POST /backups/:id/restore
```

#### Verify Backup Integrity
```
GET /backups/:id/verify
```

#### Delete Backup
```
DELETE /backups/:id
```

#### Cleanup Expired Backups
```
POST /backups/cleanup
```

#### Get Backup Schedule
```
GET /backups/schedule
```

#### Get Backup Configuration
```
GET /backups/config
```

#### Update Backup Configuration
```
PATCH /backups/config
```
**Body:** `{ "retention": { "days": 30 }, "schedule": "0 2 * * *", "compression": true }`

#### Get Backup Service Status
```
GET /backups/status
```

---

### Dashboard Analytics (COM-111)

KPI aggregation endpoints for dashboard visualizations.

#### Get Dashboard Overview
```
GET /dashboard/overview
```
Returns full dashboard with KPIs, revenue, customers, and charts.

#### Get KPI Cards
```
GET /dashboard/kpis
```
Returns KPI cards for dashboard display.

#### Get MRR (Monthly Recurring Revenue)
```
GET /dashboard/mrr
```
Returns MRR calculation and trends.

#### Get Active Customers
```
GET /dashboard/customers
```
Returns active customer count and list.

#### Get Task Metrics
```
GET /dashboard/tasks
```
Returns task completion rates and metrics.

#### Get Plan Distribution
```
GET /dashboard/plans
```
Returns subscription plan distribution.

#### Get Contact Funnel
```
GET /dashboard/funnel
```
Returns sales funnel with conversion rates.

#### Get Revenue Trends
```
GET /dashboard/revenue-trends?days=7
```
Returns revenue trends over specified period.

#### Get Employee Utilization
```
GET /dashboard/employees
```
Returns AI employee utilization metrics.

#### Get Chart Data
```
GET /dashboard/charts
```
Returns chart data for visualizations.

#### Clear Dashboard Cache
```
DELETE /dashboard/cache
```

#### Get Dashboard Service Status
```
GET /dashboard/status
```

---

### Status

#### Service Status
```
GET /status
```
Returns service health and version.

---

## Error Codes

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 400 | Validation error | Invalid request body |
| 404 | Not found | Resource does not exist |
| 500 | Server error | Internal error |

---

## Rate Limits

Currently no rate limits in MVP. Production will enforce per-plan limits.

---

## Getting Started

1. **Sign up** via `POST /contacts`
2. **Choose a plan** from `GET /plans`
3. **Subscribe** via `POST /subscriptions`
4. **Create employees** via `POST /employees`
5. **Assign tasks** via `POST /tasks`
