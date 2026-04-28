# Elixir Developer Skills Summary

**Date created:** 2026-04-18
**Agent:** elixir-dev
**Status:** Ready

---

## Skills Created

| # | Skill Name | File | Purpose |
|---|-----------|------|---------|
| 1 | `elixir-phoenix-architecture` | `elixir-phoenix-architecture/SKILL.md` | Context pattern, folder structure, naming conventions |
| 2 | `elixir-ecto-patterns` | `elixir-ecto-patterns/SKILL.md` | Schema design, migrations, queries, changesets, preloads |
| 3 | `elixir-otp-concurrency` | `elixir-otp-concurrency/SKILL.md` | GenServer, Supervisor strategies, ETS, Registry, Task |
| 4 | `elixir-oban-jobs` | `elixir-oban-jobs/SKILL.md` | Background job scheduling, retries, unique jobs, cron |
| 5 | `elixir-testing` | `elixir-testing/SKILL.md` | ExUnit, Mox mocking, ExMachina factories, integration tests |
| 6 | `elixir-phoenix-api` | `elixir-phoenix-api/SKILL.md` | REST API controllers, JSON views, token auth, versioning |
| 7 | `elixir-liveview` | `elixir-liveview/SKILL.md` | LiveView lifecycle, assigns, pub/sub, function components |
| 8 | `elixir-error-handling` | `elixir-error-handling/SKILL.md` | Tagged tuples, rescue/raise, logging, circuit breakers |

---

## Skill Details

### 1. elixir-phoenix-architecture
**When to use:** Starting a new project, organizing modules into contexts, applying naming conventions.

**Key patterns:**
- Context boundary encapsulation (`Accounts.create_user`, not `create(Accounts.User)`)
- Folder structure: `lib/app_name/context_name/` + `lib/app_name_web/`
- Error tuples: `{:ok, result}`, `{:error, :not_found}`, `{:error, changeset}`
- Thin controllers: controllers call contexts, never Repo directly

### 2. elixir-ecto-patterns
**When to use:** Defining schemas, writing migrations, building queries, validating input.

**Key patterns:**
- Composable schema queries: `Video.published() |> Video.for_user(user_id)`
- Changeset validation with `cast/4` + `validate_required`, `validate_length`, `unique_constraint`
- N+1 prevention via `preload` and batch preload
- Transactions with `Repo.transaction/1`

### 3. elixir-otp-concurrency
**When to use:** Stateful server processes, fault-tolerant supervision, caching.

**Key patterns:**
- GenServer `handle_call` (sync) vs `handle_cast` (async)
- Supervisor strategies: `one_for_one` (default), `rest_for_one`, `one_for_all`
- DynamicSupervisor for on-demand children
- ETS named tables with `read_concurrency: true` for caching
- Registry for process lookup by key

### 4. elixir-oban-jobs
**When to use:** Offloading slow work, recurring scheduled jobs, deduplication.

**Key patterns:**
- Worker: `use Oban.Worker, queue: :default, max_attempts: 5`
- Unique jobs: `unique: [period: 60, states: [:available, :scheduled]]`
- Cron: `{"@daily", MyApp.Jobs.CleanupJob}` in config
- Return `:ok` on success; `{:discard, reason}` for permanent failures

### 5. elixir-testing
**When to use:** Writing unit tests, mocking, building test factories.

**Key patterns:**
- ExMachina factories: `Factory.insert(:user)`, `build(:video)`
- Mox mocking at behaviour boundaries (not module-level)
- `async: true` for parallel unit tests
- `DataCase` / `ConnCase` shared setup with Ecto.Adapters.SQL.Sandbox

### 6. elixir-phoenix-api
**When to use:** Building REST APIs, JSON rendering, API auth, versioning.

**Key patterns:**
- `action_fallback Controller` for centralized error handling
- JSON views render maps, not Ecto structs
- Token auth: `Authorization: Bearer <token>` in header
- API versioning in URL: `/api/v1/`, `/api/v2/`
- Consistent error format: `{:error, %{code: "...", message: "..."}}`

### 7. elixir-liveview
**When to use:** Real-time pages, interactive forms, pub/sub updates.

**Key patterns:**
- `mount/3` → `render/1` → `handle_event/3` lifecycle
- `phx-change` for validation, `phx-submit` for final save
- `Phoenix.Component` function components for reusable UI
- `LiveComponent` for isolated stateful components
- `connected?(socket)` guard before `subscribe`

### 8. elixir-error-handling
**When to use:** Consistent error handling, logging, fault tolerance.

**Key patterns:**
- Tagged tuples `{:ok, _}` / `{:error, _}` for expected failures
- `raise` only for truly exceptional / programmer errors
- `with` for sequential operations that may fail
- Custom exceptions via `defexception`
- Structured logging with `Logger.info/warning/error`

---

## Usage Instructions

To use these skills, elixir-dev should invoke them when working on relevant tasks:

1. **Phoenix project design** → `elixir-phoenix-architecture`
2. **Database schemas, queries, migrations** → `elixir-ecto-patterns`
3. **Stateful workers, supervision trees** → `elixir-otp-concurrency`
4. **Background job processing** → `elixir-oban-jobs`
5. **Writing tests** → `elixir-testing`
6. **REST API development** → `elixir-phoenix-api`
7. **Real-time interactive pages** → `elixir-liveview`
8. **Error handling, logging** → `elixir-error-handling`

---

## Installation

These skills are located in:
```
workspaces/company-os/skills/
├── elixir-phoenix-architecture/SKILL.md
├── elixir-ecto-patterns/SKILL.md
├── elixir-otp-concurrency/SKILL.md
├── elixir-oban-jobs/SKILL.md
├── elixir-testing/SKILL.md
├── elixir-phoenix-api/SKILL.md
├── elixir-liveview/SKILL.md
├── elixir-error-handling/SKILL.md
└── ELIXIR_DEV_SKILLS_SUMMARY.md
```

To make available to elixir-dev, sync them via the company skills API:
```bash
POST /api/companies/{companyId}/skills/import
```
Then assign to elixir-dev agent via:
```bash
POST /api/agents/{elixirDevAgentId}/skills/sync
```
