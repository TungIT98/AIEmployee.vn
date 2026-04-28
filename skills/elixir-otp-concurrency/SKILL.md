---
name: elixir-otp-concurrency
description: >
  Use when implementing GenServer stateful processes, designing supervisor trees,
  using ETS for caching, or managing concurrent tasks. Covers GenServer callbacks,
  Supervisor strategies, Registry, ETS, and Task usage.
risk: medium
source: self-created
date_added: 2026-04-18
---

# OTP Concurrency Skills

## When to Use

- When building stateful server processes
- When designing fault-tolerant supervision trees
- When caching data with ETS
- When running concurrent background tasks
- When using Registry for named processes

## GenServer Patterns

### Minimal GenServer

```elixir
defmodule MyApp.Cache do
  use GenServer

  # Client API
  def start_link(default \\ %{}) do
    GenServer.start_link(__MODULE__, default, name: __MODULE__)
  end

  def get(key), do: GenServer.call(__MODULE__, {:get, key})
  def put(key, value), do: GenServer.call(__MODULE__, {:put, key, value})
  def delete(key), do: GenServer.call(__MODULE__, {:delete, key})

  # Server Implementation
  @impl true
  def init(args) do
    {:ok, args}
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    {:reply, Map.get(state, key), state}
  end

  @impl true
  def handle_call({:put, key, value}, _from, state) do
    {:reply, :ok, Map.put(state, key, value)}
  end

  @impl true
  def handle_call({:delete, key}, _from, state) do
    {:reply, :ok, Map.delete(state, key)}
  end
end
```

### Async GenServer (cast)

```elixir
defmodule MyApp.VideoProcessor do
  use GenServer

  def start_link(video_id) do
    GenServer.start_link(__MODULE__, video_id)
  end

  def process_async(video_id, opts \\ []) do
    GenServer.cast(__MODULE__, {:process, video_id, opts})
  end

  @impl true
  def init(video_id) do
    {:ok, %{video_id: video_id, status: :pending}}
  end

  @impl true
  def handle_cast({:process, video_id, opts}, state) do
    result = do_process(video_id, opts)
    {:noreply, %{state | status: :completed, result: result}}
  end

  defp do_process(_video_id, _opts), do: :ok
end
```

## Supervisor Strategies

### one_for_one

Each child is independent. If one crashes, only it restarts.

```elixir
defmodule MyApp.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      MyApp.Repo,
      {MyAppWeb.Endpoint, []},
      {Registry, keys: :unique, name: MyApp.Registry},
      MyApp.Cache
    ]

    opts = [strategy: :one_for_one, name: MyApp.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
```

### rest_for_one

If a child crashes, all children started after it are terminated and restarted.

```elixir
children = [
  MyApp.Repo,
  MyApp.Content.Supervisor,   # Content context with its workers
  MyAppWeb.Endpoint
]

Supervisor.start_link(children, strategy: :rest_for_one, name: MyApp.Supervisor)
```

### one_for_all

If any child crashes, ALL children are terminated and restarted.

```elixir
Supervisor.start_link(children, strategy: :one_for_all, name: MyApp.Supervisor)
```

### Dynamic Supervisor (for on-demand children)

```elixir
defmodule MyApp.VideoProcessor.Supervisor do
  use DynamicSupervisor

  def start_link(arg) do
    DynamicSupervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  def start_worker(video_id) do
    spec = {MyApp.VideoProcessor.Worker, video_id}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end

  @impl true
  def init(_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
```

## Registry Pattern

```elixir
# Start registry
{Registry, keys: :unique, name: MyApp.Registry}

# Register a process
Registry.register(MyApp.Registry, {:video, video_id}, nil)

# Look up a process
case Registry.lookup(MyApp.Registry, {:video, video_id}) do
  [{pid, _}] -> GenServer.cast(pid, :process)
  [] -> {:error, :not_found}
end
```

## ETS (Erlang Term Storage)

```elixir
defmodule MyApp ETSCache do
  def start_link do
    :ets.new(__MODULE__, [:named_table, :public, read_concurrency: true])
    Agent.start_link(fn -> :ets.new(__MODULE__, [:named_table, :public, read_concurrency: true]) end, name: __MODULE__)
  end

  def put(key, value) do
    :ets.insert(__MODULE__, {key, value})
  end

  def get(key) do
    case :ets.lookup(__MODULE__, key) do
      [{^key, value}] -> {:ok, value}
      [] -> {:error, :not_found}
    end
  end

  def delete(key) do
    :ets.delete(__MODULE__, key)
  end

  def clear do
    :ets.delete_all_objects(__MODULE__)
  end
end
```

## Task.async / Task.await

```elixir
# Parallel work
defmodule MyApp.ReportGenerator do
  def generate(user_id) do
    user_task = Task.async(fn -> MyApp.Accounts.get_user!(user_id) end)
    stats_task = Task.async(fn -> MyApp.Analytics.user_stats(user_id) end)

    user = Task.await(user_task)
    stats = Task.await(stats_task)

    %{user: user, stats: stats}
  end
end
```

## Best Practices

1. **Name processes consistently**: Use `name: __MODULE__` for singletons, Registry for dynamic
2. **Always return `{:ok, state}` or `{:stop, reason, state}`** from `init/1`
3. **Use `handle_cast` for fire-and-forget** (no response needed), `handle_call` for request/response
4. **Supervisor strategy**: Use `one_for_one` for independent workers; `rest_for_one` for ordered dependencies
5. **Limit restarts**: Set `:max_restarts` and `:max_seconds` on Supervisor to prevent crash loops
6. **ETS**: Use `:public` only when cross-process sharing is needed; prefer named tables with `read_concurrency: true`
7. **GenServer timeouts**: Always consider `:infinity` for long-running operations or use `Process.send_after` for recurring work
8. **Don't trap exits in workers**: Only supervisors handle crashes — let GenServers crash naturally so supervisors can restart them
