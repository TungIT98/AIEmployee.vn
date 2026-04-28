---
name: elixir-phoenix-architecture
description: >
  Use when designing Elixir/Phoenix application structure, organizing modules into
  contexts, or applying Phoenix conventions. Covers folder structure, naming,
  context boundaries, and architectural patterns.
risk: medium
source: self-created
date_added: 2026-04-18
---

# Elixir/Phoenix Architecture Skills

## When to Use

- When starting a new Phoenix project
- When organizing code by domain/context
- When applying conventions to new modules
- When splitting or merging contexts
- When designing module boundaries

## Phoenix Folder Structure

```
lib/
├── my_app/
│   ├── accounts/           # User management context
│   │   ├── user.ex
│   │   ├── user_notifier.ex
│   │   └── accounts.ex    # Context module (public API)
│   ├── billing/            # Payment/subscription context
│   │   ├── subscription.ex
│   │   └── billing.ex
│   ├── content/            # Content management context
│   │   ├── video.ex
│   │   ├── video_generator.ex
│   │   └── content.ex
│   └── repo.ex             # Ecto repository (root of data layer)
├── my_app_web/
│   ├── controllers/        # HTTP controllers
│   ├── components/        # HEEX components (Phoenix 1.7+)
│   ├── channels/           # WebSocket channels
│   ├── live/               # LiveView views
│   ├── plugs/               # Plugs/middleware
│   └── endpoint.ex
└── my_app.ex              # Application module
```

## Naming Conventions

| Element          | Convention        | Example                        |
|------------------|------------------|--------------------------------|
| Modules          | PascalCase       | `MyApp.UserController`         |
| Functions        | snake_case       | `create_user/1`                |
| Variables        | snake_case       | `user_id`, `video_count`       |
| Database columns | snake_case       | `inserted_at`, `user_id`       |
| URLs             | kebab-case       | `/user-profiles`               |
| Tests            | `*_test.exs`     | `user_test.exs`                |
| Context files    | `*.ex`           | `accounts.ex` (singular)       |

## Context Pattern (Core Principle)

**Contexts are the boundary between your business logic and the web layer.**

```elixir
# GOOD: Strong encapsulation via context
defmodule MyApp.Content do
  alias MyApp.Repo
  alias MyApp.Content.Video

  def list_videos(opts \\\\ []) do
    from(v in Video, where: v.active, order_by: [desc: v.inserted_at])
    |> Repo.all()
  end

  def get_video!(id), do: Repo.get!(Video, id)

  def create_video(attrs \\\\ %{}) do
    %Video{}
    |> Video.changeset(attrs)
    |> Repo.insert()
  end

  def delete_video(video), do: Repo.delete(video)
end
```

```elixir
# BAD: Leaking schema details to web layer
defmodule MyAppWeb.VideoController do
  def index(conn, _params) do
    # Exposes Video schema directly!
    videos = Repo.all(Video)
    render(conn, :index, videos: videos)
  end
end
```

## Error Handling Tuple Pattern

Always return tagged tuples from context functions:

```elixir
{:ok, result}              # Success
{:error, :not_found}       # Not found
{:error, %Ecto.Changeset{}} # Validation error
{:error, :unauthorized}    # Authorization error
{:error, :forbidden}       # Permission denied
```

## Struct Pattern

```elixir
defmodule MyApp.Accounts do
  def create_user(attrs \\\\ %{}) do
    case Repo.insert(User.changeset(%User{}, attrs)) do
      {:ok, user} -> {:ok, user}
      {:error, changeset} -> {:error, changeset}
    end
  end
end
```

## Best Practices

1. **Context prefix rule**: Context modules include their domain prefix (`Accounts.create_user`, not `Accounts.create(Accounts.User)`)
2. **Schema is data only**: Schemas define data structure, NOT business logic
3. **Use changesets**: Always validate with changesets at the boundary
4. **Explicit errors**: Never silently swallow errors; always return `{:error, reason}`
5. **Thin controllers**: Move all logic to contexts; controllers should only call contexts and render
6. **Separate reads from writes**: Use `get_` prefix for single-resource lookups, `list_` for collections
7. **Test contexts, not schemas**: Write integration tests against context public API

## When to Split a Context

- When two domains share no data or operations
- When the context has more than 15-20 functions
- When the context name is too generic (`Lib1`, `Helper`)
- When unrelated features share the same context file

## Supervision Tree Integration

Add contexts to the supervision tree via the Application module:

```elixir
defmodule MyApp.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      MyApp.Repo,
      MyAppWeb.Endpoint,
      # Add other workers/supervisors here
    ]

    opts = [strategy: :one_for_one, name: MyApp.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
```
