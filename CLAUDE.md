# Company OS - Autonomous AI Company Framework

## Company Info
- **Company ID:** 189b5ac9-ca25-4421-b6de-359d2df98909
- **Issue Prefix:** COM
- **Status:** Active

## Vision
Build the first fully autonomous virtual company in Vietnam where AI agents operate like a real organization.

## Team (14 agents)
```
CEO (0d70bbe7-b566-4bd5-9b3b-58aae3d13d86) - idle
├── CTO Manager (2fd9f72b-f120-4833-89b5-ad1152543941) - idle
│   ├── Frontend Developer (afd58c7a-f2b6-490b-9191-dae78f1ea6b6) - idle
│   ├── Backend Developer (6ee471dd-09fa-4270-9f17-a0314723f586) - idle
│   ├── DevOps Engineer (e64df159-0752-4a9a-9e50-2f8d9794740a) - running
│   └── QA Engineer (f164d880-5d70-4f22-8724-1f8149bcb8c8) - idle
├── COO Manager (c0e81d24-c022-4b3a-8bc4-14df20f2ec08) - idle
│   ├── Data Analyst (6a8f8be8-4c12-486c-87c7-71146c9f4974) - idle
│   ├── HR/Admin (d8daa755-7ecb-4c39-942d-9a69ed5ff389) - idle
│   └── Customer Support (447b9950-309b-4880-8557-b312dad2cdb2) - idle
└── CMO Manager (6aaee95d-ce9e-423f-8d82-de1e144b1bde) - idle
    ├── Content Creator (23d19d3f-b9c0-4225-9ffd-8833ec7f9d27) - idle
    ├── Ads Manager (d982668e-a2b3-4d31-9ba7-f63660122da4) - idle
    └── SEO Specialist (392651e9-e428-45cb-b56a-b0936559f147) - idle
```

## MCP Servers
- Linear, Notion, Sentry, Supabase

## Current Goal
- COM-9: Company OS Platform - Phase 1 (APPROVED)

## Products
- Company OS Platform (MVP in progress)
- VAT Systems (as parent company)

## API
- Heartbeat: POST /api/agents/{agentId}/heartbeat/invoke

## After Completing Tasks
Sau khi hoàn thành task hoặc tạo file mới:
1. Chạy `bash scripts/auto-sync.sh` để sync lên GitHub
2. Script này tự động commit và push changes lên https://github.com/TungIT98/AIEmployee.vn
