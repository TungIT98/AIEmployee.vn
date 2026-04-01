# COMPANY OS - Specification

**Version:** 1.0
**Date:** 2026-04-01
**Status:** MVP Baseline (Frozen)

---

## 1. Concept

**Company OS** là nền tảng quản lý doanh nghiệp ảo bằng AI agents, nơi mỗi cấp bậc trong công ty (CEO, Manager, Worker) được đại diện bởi AI agent có suy nghĩ và quyết định rõ ràng.

**Khác với Claude Code:**
- Claude Code = 1 AI helper cho 1 user
- Company OS = CẢ CÔNG TY bằng AI agents

---

## 2. Architecture

### 2.1 Central Knowledge Base (Persistent Memory)

```
company-os/
├── COMPANY.md           # Vision, Mission, Values
├── ROLES.md             # Job descriptions cho từng agent
├── OKR.md               # Objectives & Key Results
├── DECISIONS.md         # Log mọi quyết định + lý do
├── TASKS.md             # Kanban board
├── REPORTS.md          # Daily standup logs
└── METRICS.md          # KPIs
```

### 2.2 Agent Hierarchy

```
CEO AGENT
├── MANAGER: Technology (CTO)
│   ├── WORKER: Frontend Developer
│   ├── WORKER: Backend Developer
│   ├── WORKER: DevOps Engineer
│   └── WORKER: QA Engineer
│
├── MANAGER: Operations (COO)
│   ├── WORKER: Data Analyst
│   ├── WORKER: HR/Admin
│   └── WORKER: Customer Support
│
└── MANAGER: Marketing (CMO)
    ├── WORKER: Content Creator
    ├── WORKER: Ads Manager
    └── WORKER: SEO Specialist
```

### 2.3 Communication Flow

```
USER (Founder)
    │
    ▼
CEO AGENT
    │ "Analyze market, set strategy"
    ▼
MANAGER AGENT
    │ "Break down tasks, assign workers"
    ▼
WORKER AGENT(S)
    │ "Execute tasks"
    ▼
CENTRAL KNOWLEDGE BASE
    │ (Store decisions, progress, reports)
    ▼
MANAGER → CEO: "Report progress/blockers"
CEO → USER: "Request approvals, show progress"
```

---

## 3. Agent Specifications

### 3.1 CEO Agent

**Role:** Strategic leader, decision maker

**Responsibilities:**
- Understand company vision and mission
- Set OKRs (Objectives & Key Results)
- Allocate resources (budget, time, agents)
- Approve major decisions
- Report to founder (user)

**Decision Rights:**
- Strategy direction
- Budget allocation above threshold
- New product/market entry
- Hiring/firing agents

**Tools:**
- Market analysis
- Financial planning
- Resource allocation
- Strategy formulation

### 3.2 Manager Agents (CTO/COO/CMO)

**Role:** Team leaders, execution drivers

**Responsibilities:**
- Receive tasks from CEO
- Break down into actionable items
- Assign to appropriate workers
- Monitor progress
- Resolve blockers
- Report to CEO

**Decision Rights:**
- Task prioritization
- Worker assignment
- Daily operations
- Technical decisions (CTO)
- Marketing tactics (CMO)
- Process optimization (COO)

**Tools:**
- Task management
- Team coordination
- Progress tracking
- Problem escalation

### 3.3 Worker Agents

**Role:** Execute specific tasks

**Responsibilities:**
- Receive specific tasks from manager
- Execute and complete
- Report status to manager
- Document work in knowledge base

**Decision Rights:**
- How to accomplish task
- Technical approach
- Time management

---

## 4. Communication Protocol

### 4.1 Task Assignment

```
CEO → Manager:
"Manager [Name], priority [HIGH/MED/LOW]: [Task description]
Deadline: [date]
Success criteria: [specific metrics]"

Manager → Worker:
"Worker [Name], task: [specific deliverable]
Context: [relevant background]
Deadline: [date]
Acceptance: [what "done" means]"
```

### 4.2 Status Reporting

```
Worker → Manager:
"Task [ID] status: [IN_PROGRESS/COMPLETED/BLOCKED]
Progress: [X%]
Blockers: [none/list issues]
Next update: [time]"

Manager → CEO:
"Tasks in my team: [summary]
Completed: [X]
In progress: [Y]
Blocked: [Z] - [explain]
Recommendation: [if any]"
```

### 4.3 Decision Escalation

```
Worker → Manager:
"I need decision on: [issue]
Option A: [pros/cons]
Option B: [pros/cons]
My recommendation: [X]"

Manager → CEO:
"Blocked on: [issue]
Impact: [business impact]
Options considered: [A vs B]
Recommendation: [X]
Awaiting: [your decision]"
```

---

## 5. Knowledge Base Structure

### 5.1 COMPANY.md

```markdown
# Company Name: [Tên công ty]

## Vision
[Mô tả vision dài hạn]

## Mission
[Nhiệm vụ hiện tại]

## Values
- [Value 1]
- [Value 2]

## Current Focus (Q1 2026)
[3-5 initiatives chính]
```

### 5.2 ROLES.md

```markdown
# Role Definitions

## CEO Agent
- Reports to: Founder (Human User)
- Direct reports: CTO, COO, CMO Managers
- Decision scope: Strategic

## CTO Manager
- Reports to: CEO
- Direct reports: FE, BE, DevOps, QA Workers
- Decision scope: Technical

## [Tương tự cho các role khác...]
```

### 5.3 TASKS.md

```markdown
# Task Board

## BACKLOG
- [Task ID] | [Title] | [Priority] | [Assigned to]

## IN PROGRESS
- [Task ID] | [Title] | [Progress %] | [Assigned to]

## REVIEW
- [Task ID] | [Title] | [Reviewer] | [Status]

## DONE
- [Task ID] | [Title] | [Completed date] | [Assignee]
```

### 5.4 DECISIONS.md

```markdown
# Decision Log

## [DATE] - [Decision Title]
- **Context:** [Why this decision was needed]
- **Options considered:** [A, B, C]
- **Decision made:** [Chosen option]
- **Rationale:** [Why this was chosen]
- **Made by:** [Agent name]
- **Approved by:** [CEO or Human if escalated]

## [Next decision entry...]
```

---

## 6. Implementation Plan

### Phase 1: Core CEO Agent
- [ ] Setup Paperclip company structure
- [ ] Create CEO agent with role definition
- [ ] Implement knowledge base (file-based)
- [ ] Basic task assignment flow

### Phase 2: First Manager
- [ ] CTO Manager agent
- [ ] 2-3 Worker agents
- [ ] Task board system

### Phase 3: Communication Protocol
- [ ] Status reporting
- [ ] Decision escalation
- [ ] Approval workflow

### Phase 4: Full System
- [ ] COO, CMO managers
- [ ] All worker roles
- [ ] Metrics & reporting

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Human decisions required/day | < 5 |
| Tasks completed by agents/day | > 20 |
| Agent-to-agent handoffs | > 80% |
| Knowledge base accuracy | > 95% |
| User satisfaction | > 4/5 |

---

## 8. Technical Notes

### Paperclip Integration
- Each agent = Paperclip agent ID
- Company ID = company-os
- Communication via heartbeat + resume

### Persistence
- All knowledge in Markdown files
- Git-style versioning for decisions
- Auto-backup every 4 hours

### Scalability
- Add more managers as company grows
- Spawn temporary workers for spikes
- Cross-company knowledge sharing (future)
