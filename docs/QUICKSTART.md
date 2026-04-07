# AIEmployee.vn Quick Start Guide

**For Businesses Ready to Scale with AI Employees**

---

## What is AIEmployee.vn?

AIEmployee.vn lets you hire AI agents like real employees — each with a specific role, responsibilities, and tasks. Manage your AI workforce through a simple REST API.

### Key Concepts

- **AI Employee**: An AI agent configured for a specific role (sales, support, analyst, etc.)
- **Subscription**: Your service plan determines how many AI employees you can hire
- **Task**: Work assigned to an AI employee with priority and status tracking
- **Contact**: Your business profile in our system

---

## Setup in 5 Minutes

### Step 1: Submit Contact Form

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nguyễn Văn Minh",
    "company": "Công Ty TNHH Minh Anh",
    "email": "minh@minhanh.vn",
    "phone": "0909123456",
    "plan": "starter"
  }'
```

Save the returned `contactId` for next step.

### Step 2: Choose and Subscribe to a Plan

```bash
# First, see available plans
curl http://localhost:3000/api/plans

# Subscribe to a plan
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "YOUR_CONTACT_ID",
    "planId": "plan_001"
  }'
```

Save the returned `subscriptionId`.

### Step 3: Hire Your First AI Employee

```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "YOUR_SUBSCRIPTION_ID",
    "name": "Sales Bot",
    "role": "sales",
    "config": {}
  }'
```

Save the returned `employeeId`.

### Step 4: Assign Tasks

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "YOUR_EMPLOYEE_ID",
    "title": "Follow up with lead #1234",
    "description": "Call within 24 hours",
    "priority": "high"
  }'
```

---

## Managing Tasks

### Update Task Status
```bash
# Mark as in progress
curl -X PATCH http://localhost:3000/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# Mark as completed
curl -X PATCH http://localhost:3000/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

### List Tasks
```bash
# All tasks
curl "http://localhost:3000/api/tasks"

# Tasks by employee
curl "http://localhost:3000/api/tasks?employeeId=YOUR_EMPLOYEE_ID"

# Tasks by status
curl "http://localhost:3000/api/tasks?status=pending"
```

---

## Monitoring

### Check System Metrics
```bash
curl http://localhost:3000/api/metrics
```

Returns:
- Total contacts and new leads
- Total AI employees
- Task counts with completion rate

### Check Service Status
```bash
curl http://localhost:3000/api/status
```

---

## E-Invoicing (TKP ACI Integration)

AIEmployee.vn supports Vietnamese e-invoice generation and submission to TKP ACI tax portal.

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "seller": {
      "taxCode": "0123456789",
      "name": "Công Ty TNHH AI Việt Nam",
      "address": "123 Nguyễn Trãi, Q1, HCM"
    },
    "buyer": {
      "taxCode": "9876543210",
      "name": "Công Ty ABC",
      "address": "456 Lê Lợi, Q1, HCM"
    },
    "items": [{
      "name": "AIEmployee License",
      "quantity": 5,
      "unit": "license",
      "price": 490000,
      "total": 2450000
    }],
    "paymentMethod": "bank_transfer"
  }'
```

---

## Common Use Cases

### Use Case 1: Sales Lead Follow-up
1. Create a sales-role AI employee
2. Assign follow-up tasks as leads come in
3. Employee processes each lead according to your workflow

### Use Case 2: Customer Support Triage
1. Create support-role AI employees
2. Route incoming tickets as tasks
3. Track resolution status and completion rates

### Use Case 3: Business Reporting
1. Create analyst-role AI employees
2. Assign periodic reporting tasks
3. Use `/metrics` endpoint to track KPIs

---

## Plan Comparison

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| AI Employees | 3 | 10 | Unlimited |
| API Access | Yes | Yes | Yes |
| E-Invoicing | No | Yes | Yes |
| Priority Support | No | No | Yes |

---

## Need Help?

- **API Docs**: See `docs/API.md`
- **Deployment Guide**: See `docs/DEPLOYMENT.md`
- **Company Overview**: See `COMPANY.md`
- **Role Definitions**: See `ROLES.md`
