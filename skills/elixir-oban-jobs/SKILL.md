---
name: elixir-oban-jobs
description: >
  Use when implementing background job processing with Oban. Covers worker creation,
  job scheduling, unique job deduplication, retry configuration, cron jobs, and
  error handling patterns.
risk: medium
source: self-created
date_added: 2026-04-18
---

# Oban Background Jobs Skills

## When to Use

- When offloading slow operations (video processing, emails, API calls)
- When scheduling recurring jobs (cleanup, reports, sync)
- When preventing duplicate job execution
- When handling job retries gracefully
- When testing Oban jobs

## Worker Pattern

```elixir
defmodule MyApp.Jobs.VideoEncodingJob do
  use Oban.Worker, queue: :video_encoding, max_attempts: 5

  @impl true
  def perform(%Oban.Job{args: %{"video_id" => video_id}}) do
    case MyApp.Content.get_video(video_id) do
      nil ->
        {:error, :video_not_found}

      video ->
        MyApp.VideoProcessor.encode(video)
        :ok
    end
  end
end
```

## Scheduling Jobs

```elixir
# Enqueue immediately
MyApp.Jobs.VideoEncodingJob.new(%{video_id: video.id})
|> Oban.insert()

# With options
MyApp.Jobs.VideoEncodingJob.new(%{video_id: video.id}, schedule_in: 60)
|> Oban.insert()

# Or use the shorthand
MyApp.Jobs.VideoEncodingJob.insert(%{video_id: video.id})
```

## Unique Jobs (Deduplication)

```elixir
defmodule MyApp.Jobs.SendWelcomeEmailJob do
  use Oban.Worker,
    queue: :notifications,
    max_attempts: 3,
    unique: [period: 60, states: [:available, :scheduled]]

  @impl true
  def perform(%Oban.Job{args: %{"user_id" => user_id}}) do
    user = MyApp.Accounts.get_user!(user_id)
    MyApp.Mailer.send_welcome_email(user)
    :ok
  end
end
```

## Retry Configuration

```elixir
# In config/config.exs
config :my_app, Oban,
  repo: MyApp.Repo,
  queues: [
    default: 10,
    video_encoding: 5,
    notifications: 20,
    exports: 2
  ],
  plugins: [
    # Retry with exponential backoff
    {Oban.Plugins.RepoPruner, interval: :timer.minutes(10)},
    {Oban.Plugins.Stager, interval: :timer.seconds(5)}
  ]

# Custom backoff (exponential: 1s, 2s, 4s, 8s, 16s)
defmodule MyApp.Jobs.VideoEncodingJob do
  use Oban.Worker,
    queue: :video_encoding,
    max_attempts: 7,
    backoff: &Oban.Backoff.Exponential.init/1
end
```

## Cron Jobs

```elixir
# config/config.exs
config :my_app, Oban,
  plugins: [
    {Oban.Plugins.Cron,
     crontab: [
       # Every hour
       {"0 * * * *", MyApp.Jobs.CleanupExpiredSessionsJob},

       # Every day at midnight
       {"@daily", MyApp.Jobs.DailyReportJob},

       # Every Monday at 9am
       {"0 9 * * 1", MyApp.Jobs.WeeklyDigestJob},

       # Every 5 minutes
       {"*/5 * * * *", MyApp.Jobs.SyncExternalDataJob}
     ]}
  ]
```

## Error Handling in Jobs

```elixir
@impl true
def perform(%Oban.Job{attempt: attempt, max_attempts: max_attempts} = job) do
  try do
    do_perform(job.args)
    :ok
  rescue
    e in SomeError ->
      if attempt < max_attempts do
        {:error, inspect(e)}
      else
        # Final attempt failed — log and potentially notify
        MyApp.Logger.error("Job failed permanently", job_id: job.id, error: inspect(e))
        :ok   # Return :ok so the job is marked complete (not retried)
      end
  end
end
```

## Discarding Jobs (No Retry)

```elixir
def perform(%Oban.Job{args: %{"user_id" => user_id}}) do
  case MyApp.Accounts.get_user(user_id) do
    nil ->
      # User deleted, nothing to do — discard (no retry)
      {:discard, :user_not_found}

    user ->
      process_user(user)
      :ok
  end
end
```

## Testing Jobs

```elixir
defmodule MyApp.Jobs.VideoEncodingJobTest do
  use MyApp.DataCase
  use Oban.Testing, repo: MyApp.Repo

  describe "VideoEncodingJob" do
    test "encodes video successfully" do
      video = video_fixture()

      assert :ok = perform_job(MyApp.Jobs.VideoEncodingJob, %{video_id: video.id})

      updated_video = MyApp.Repo.get(MyApp.Content.Video, video.id)
      assert updated_video.status == :encoded
    end

    test "returns error when video not found" do
      assert {:error, :video_not_found} = perform_job(
        MyApp.Jobs.VideoEncodingJob,
        %{video_id: 999_999_999}
      )
    end
  end
end
```

## Job Lifecycle

```
available → scheduled → executing → completed / discarded / retryable
                                ↘ (failed + attempts < max) → scheduled (retry)
```

## Best Practices

1. **Return `:ok` on success** from `perform/1` — anything else is treated as failure
2. **Use unique constraints** to prevent duplicate enqueues on button clicks or API calls
3. **Separate queues by priority**: critical work (`notifications: 20`) vs. slow batch (`exports: 2`)
4. **Keep jobs idempotent**: same job may run twice if the first attempt crashes before completion
5. **Use `discard` for permanent failures** (user deleted, invalid state) — don't retry
6. **Max attempts**: 3 for fast/simple jobs, 5-7 for complex jobs like video processing
7. **Never call `System.halt/1`** inside a job
8. **Schedule in the future** for non-urgent work: `schedule_in: 3600` (1 hour)
