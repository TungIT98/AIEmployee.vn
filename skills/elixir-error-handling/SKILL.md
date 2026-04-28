---
name: elixir-error-handling
description: >
  Use when handling errors in Elixir, implementing rescue/raise patterns, using tagged
  tuples for error propagation, logging errors, or implementing circuit breakers.
  Covers Elixir error mechanisms, graceful degradation, and logging patterns.
risk: medium
source: self-created
date_added: 2026-04-18
---

# Elixir Error Handling Skills

## When to Use

- When handling errors gracefully across system layers
- When implementing consistent error return patterns
- When logging errors for observability
- When designing fault-tolerant systems
- When working with exceptions vs errors

## The Elixir Error Philosophy

> "Elixir errors are for the unexpected. Tagged tuples are for the expected."

**Use `{:ok, result}` / `{:error, reason}` for expected failures.**
**Use `raise` / `rescue` for truly exceptional situations.**

## Tagged Tuple Pattern (Preferred)

```elixir
# Context returns tagged tuples
defmodule MyApp.Content do
  def get_video(id) do
    case Repo.get(Video, id) do
      nil -> {:error, :not_found}
      video -> {:ok, video}
    end
  end

  def create_video(attrs) do
    %Video{}
    |> Video.changeset(attrs)
    |> Repo.insert()
  end
end

# Caller handles both cases
case MyApp.Content.get_video(video_id) do
  {:ok, video} -> render(conn, "show.html", video: video)
  {:error, :not_found} -> conn |> put_status(404) |> render("404.html")
end
```

## The with Special Form

```elixir
def create_video_and_notify(user_id, video_attrs) do
  with {:ok, video} <- MyApp.Content.create_video(video_attrs),
       {:ok, _} <- MyApp.Notifiers.send_upload_email(user_id, video) do
    {:ok, video}
  end
  # If any clause fails, the error is returned automatically
end
```

## Raising Exceptions

```elixir
# Use raise for programming errors / truly exceptional cases
def get_video!(id) do
  case Repo.get(Video, id) do
    nil -> raise "Video #{id} not found"
    video -> video
  end
end

# Custom exceptions
defmodule MyApp.NotFoundError do
  defexception [:message, :resource, :id]

  def exception(opts) do
    resource = Keyword.fetch!(opts, :resource)
    id = Keyword.fetch!(opts, :id)
    %__MODULE__{message: "#{resource} #{id} not found", resource: resource, id: id}
  end
end

raise MyApp.NotFoundError, resource: "Video", id: 42
```

## try/rescue (Rarely Needed)

```elixir
try do
  risky_operation()
rescue
  e in RuntimeError ->
    Logger.error("Operation failed: #{inspect(e)}")
    # Re-raise or handle
    {:error, :operation_failed}

  e in MyApp.CustomError ->
    {:error, {:custom, e.message}}
after
  # Always runs, even if no exception
  cleanup_resources()
end
```

## Pattern Matching on Function Clauses

```elixir
# Preferred over if/else chains
def process_status(:draft), do: :ignore
def process_status(:published), do: do_publish()
def process_status(:archived), do: :ignore
def process_status(status), do: {:error, {:unknown_status, status}}
```

## Swoosh Email Error Handling

```elixir
defmodule MyApp.Notifiers do
  def send_welcome_email(user) do
    email =
      NewUserEmail.welcome(user)
      |> MyApp.Mailer.deliver()

    case email do
      {:ok, _metadata} -> :ok
      {:error, reason} ->
        Logger.error("Failed to send welcome email to #{user.email}: #{inspect(reason)}")
        {:error, :email_failed}
    end
  end
end
```

## Plug Error Handling

```elixir
# config/prod.exs
config :my_app, MyAppWeb.Endpoint,
  render_errors: [layouts: [root: MyAppWeb.ErrorView],
                  format: JsonErrorView]
```

```elixir
defmodule MyAppWeb.ErrorJSON do
  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end
```

## Structured Logging

```elixir
require Logger

def create_video(attrs) do
  case Repo.insert(Video.changeset(%Video{}, attrs)) do
    {:ok, video} ->
      Logger.info("Video created", video_id: video.id, user_id: video.user_id)
      {:ok, video}

    {:error, changeset} ->
      Logger.warning("Video creation failed",
        reason: :validation_error,
        errors: inspect(changeset.errors)
      )
      {:error, changeset}
  end
end
```

## Circuit Breaker Pattern (Oban)

```elixir
# Wrap external API calls in retry logic
def fetch_from_external_api(url) do
  HTTPoison.get(url, [], recv_timeout: 30_000)
rescue
  e in HTTPoison.Error ->
    Logger.error("External API call failed", url: url, error: inspect(e))
    {:error, :external_api_unavailable}
end
```

## Best Practices

1. **Prefer tagged tuples over exceptions** for expected failure modes (not found, invalid input)
2. **Raise for programmer errors**: Contract violations, impossible states, "this should never happen"
3. **Let it crash**: In GenServers, let errors propagate to the supervisor rather than swallowing them
4. **Always log errors** with structured context (IDs, stack traces) for debugging
5. **Use `with` for sequential operations** where any step might fail
6. **Define custom exception types** for domain-specific errors (`NotFoundError`, `ValidationError`)
7. **Never silently swallow errors**: Even if you can't recover, log it
8. **Use `Logger.failures/1`** to track recurring failures without crashing the process
