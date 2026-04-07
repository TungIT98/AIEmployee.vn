# AIEmployee.vn - EmDash CMS Migration

Migrated from static HTML + Express API to EmDash CMS on Cloudflare Pages.

## Tech Stack

- **Frontend**: Astro 5 + Tailwind CSS
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Deployment**: Cloudflare Pages

## Features

- Landing page with pricing plans
- VAT Calculator (client-side)
- Invoice OCR upload (Tesseract.js)
- Compliance checker (Thông tư 68/2019)
- Contact form with API
- Subscription management
- Employee & Task management
- Zalo integration (mock)

## Project Structure

```
emdash-aiemployee/
├── src/
│   ├── layouts/
│   │   └── Base.astro         # Base layout with header/footer
│   ├── lib/
│   │   └── schema.ts          # Drizzle D1 schema
│   └── pages/
│       ├── index.astro        # Landing page
│       ├── api/               # API routes
│       │   ├── contacts.ts
│       │   ├── employees.ts
│       │   ├── invoices.ts
│       │   ├── metrics.ts
│       │   ├── plans.ts
│       │   ├── status.ts
│       │   ├── subscriptions.ts
│       │   ├── tasks.ts
│       │   ├── compliance/
│       │   │   └── check.ts
│       │   ├── vat/
│       │   │   └── calculate.ts
│       │   └── zalo/
│       │       └── status.ts
│       └── tools/
│           ├── vat-calculator.astro
│           ├── invoice-upload.astro
│           └── compliance.astro
├── scripts/
│   └── n8n_tiktok_workflow.json
├── astro.config.mjs
├── drizzle.config.ts
├── emdash.config.ts
├── wrangler.toml
└── package.json
```

## Setup

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/contacts | Submit contact form |
| GET | /api/plans | List pricing plans |
| POST | /api/subscriptions | Create subscription |
| POST | /api/employees | Create employee |
| GET | /api/employees | List employees |
| POST | /api/tasks | Create task |
| GET | /api/tasks | List tasks |
| PATCH | /api/tasks | Update task |
| POST | /api/invoices | Create invoice |
| GET | /api/invoices | List invoices |
| POST | /api/vat/calculate | Calculate VAT |
| POST | /api/compliance/check | Check invoice compliance |
| GET | /api/metrics | System metrics |
| GET | /api/status | Service status |

## D1 Database Setup

```bash
# Create D1 database
wrangler d1 create aiemployee-db

# Update wrangler.toml with database_id

# Run migrations
wrangler d1 migrations apply aiemployee-db --local
wrangler d1 migrations apply aiemployee-db --remote
```

## URL Redirects

| Old Path | New Path |
|----------|----------|
| / | / |
| /vat-calculator.html | /tools/vat-calculator |
| /invoice-upload.html | /tools/invoice-upload |
| /compliance-dashboard.html | /tools/compliance |

## Environment Variables

```env
EMDASH_AUTH_SECRET=your-secret
EMDASH_PREVIEW_SECRET=your-preview-secret
```

## VAT Rates (Vietnam)

- 0% - Exempt (food, healthcare, education, books)
- 5% - Reduced (essential goods and services)
- 8% - Reduced (construction, transportation - pre-2024)
- 10% - Standard rate (default)

## License

© 2026 AIEmployee.vn. All rights reserved.
