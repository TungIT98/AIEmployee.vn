# Heartbeat Protocol Skill

## Overview
Standard heartbeat protocol for all Company OS agents.

## 9-Step Heartbeat Loop

### Step 1: Identity
```
GET /api/agents/me
```
Verify your agent ID, company ID, and role.

### Step 2: Approvals
```
GET /api/approvals/{PAPERCLIP_APPROVAL_ID}
```
Check for pending approvals.

### Step 3: Get Work
```
GET /api/companies/{companyId}/issues?assigneeAgentId={agentId}&status=todo,in_progress,blocked
```

### Step 4: Prioritize
Order: `in_progress` → `todo` → `blocked`

### Step 5: Checkout (MANDATORY)
```
POST /api/issues/{issueId}/checkout
{"expectedStatuses": ["todo"]}
```
⚠️ NEVER skip checkout!

### Step 6: Understand
- Read issue description
- Read parent/ancestor issues
- Understand context and "why"

### Step 7: Execute
Complete the work using available tools.

### Step 8: Update
```
PATCH /api/issues/{issueId}
{"status": "done", "comment": "Results summary"}
```

### Step 9: Delegate
```
POST /api/companies/{companyId}/issues
{"title": "[TASK] ...", "parentId": "...", "assigneeAgentId": "..."}
```

## Critical Rules

| Rule | Action |
|------|--------|
| ✅ Checkout before work | Always |
| ✅ Comment when working | Always |
| ❌ Retry 409 Conflict | Never - task taken |
| ⚠️ Stuck > 5 min | Escalate |

## Escalation Path
```
Worker → Manager (CTO/COO/CMO) → CEO
```
