---
name: elixir-testing
description: >
  Use when writing ExUnit unit tests, mocking external dependencies with Mox, building
  test factories with ExMachina, or writing integration tests with Phoenix.ConnTest.
  Covers test structure, mocking strategies, and factory patterns.
risk: low
source: self-created
date_added: 2026-04-18
---

# Elixir Testing Skills

## When to Use

- When writing unit tests for Elixir modules
- When mocking external services or adapters
- When building test data factories
- When writing Phoenix integration tests
- When testing GenServers and OTP components

## ExUnit Basics

```elixir
defmodule MyApp.AccountsTest do
  use MyApp.DataCase, async: true

  alias MyApp.Accounts
  alias MyApp.Accounts.User

  describe "create_user/1" do
    test "creates a user with valid attrs" do
      attrs = %{email: "test@example.com", password: "SecurePass123"}
      assert {:ok, %User{} = user} = Accounts.create_user(attrs)
      assert user.email == "test@example.com"
      refute user.hashed_password == attrs.password
    end

    test "returns error with invalid email" do
      attrs = %{email: "not-an-email", password: "SecurePass123"}
      assert {:error, %Ecto.Changeset{}} = Accounts.create_user(attrs)
    end

    test "returns error when email already exists" do
      attrs = %{email: "taken@example.com", password: "SecurePass123"}
      Accounts.create_user(attrs)
      assert {:error, %Ecto.Changeset{} = changeset} = Accounts.create_user(attrs)
      assert "has already been taken" in errors_on(changeset).email
    end
  end
end
```

## DataCase (Shared Setup)

```elixir
defmodule MyApp.DataCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      alias MyApp.Repo
      import Ecto
      import Ecto.Changeset
      import MyApp.DataCase
    end
  end

  setup tags do
    MyApp.DataCase.setup_sandbox(tags)
    :ok
  end

  def setup_sandbox(tags) do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(MyApp.Repo, shared: not tags[:async])
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  end
end
```

## Mox Mocking (Behaviours)

```elixir
# 1. Define the behaviour
defmodule MyApp.Notifiers.Notifier do
  @callback send_email(to :: String.t(), subject :: String.t(), body :: String.t()) ::
              :ok | {:error, term()}
end

# 2. Implement the behaviour in production
defmodule MyApp.Notifiers.EmailNotifier do
  @behaviour MyApp.Notifiers.Notifier

  @impl true
  def send_email(to, subject, body) do
    MyApp.Mailer.deliver(to, subject, body)
  end
end

# 3. Configure in dev/prod
# config/dev.exs
config :my_app, MyApp.Notifiers.Notifier, MyApp.Notifiers.EmailNotifier

# 4. Define Mox in test
defmodule MyApp.Notifiers.Mox do
  defmacro __using__(_) do
    quote do
      import Mox

      setup :set_mox_from_context
      setup :verify_on_exit!
    end
  end
end

# 5. Use in tests
defmodule MyApp.Notifiers.NotifierTest do
  use MyApp.DataCase
  import MyApp.Notifiers.Mox

  alias MyApp.Notifiers.Notifier

  setup do
    stub(Notifier, :send_email, fn _, _, _ -> :ok end)
    :ok
  end

  test "sends welcome email" do
    assert :ok = Notifier.send_email("user@test.com", "Welcome!", "Hello")
    assert_called(Notifier.send_email("user@test.com", "Welcome!", "Hello"))
  end
end
```

## ExMachina Factory Pattern

```elixir
# test/support/factories.ex
defmodule MyApp.Factory do
  use ExMachina.Ecto, repo: MyApp.Repo

  def user_factory do
    %MyApp.Accounts.User{
      email: sequence(:email, &"user#{&1}@example.com"),
      hashed_password: Bcrypt.hash_pwd_salt("password123")
    }
  end

  def video_factory do
    %MyApp.Content.Video{
      title: sequence("Video ", &"Title #{&1}"),
      description: "A great video",
      duration: 300,
      status: :draft,
      user: build(:user)
    }
  end

  def published_video_factory do
    %__MODULE__.video_factory{}
    |> Map.put(:status, :published)
    |> Map.put(:published_at, DateTime.utc_now())
  end
end
```

```elixir
# In test
defmodule MyApp.ContentTest do
  use MyApp.DataCase
  alias MyApp.Factory

  test "list_videos returns published videos" do
    _draft = Factory.insert(:video)
    published = Factory.insert(:published_video)

    assert [%MyApp.Content.Video{}] = MyApp.Content.list_videos()
  end
end
```

## Phoenix Integration Tests

```elixir
defmodule MyAppWeb.VideoControllerTest do
  use MyAppWeb.ConnCase
  alias MyApp.Factory

  describe "POST /videos" do
    test "creates video and redirects", %{conn: conn} do
      user = Factory.insert(:user)
      conn = conn |> log_in_user(user) |> post("/videos", %{video: %{title: "New Video"}})

      assert %{status: 302, halted: false} = conn
      assert Phoenix.ConnTest.redirected_to(conn) =~ "/videos/"
    end

    test "renders errors for invalid data", %{conn: conn} do
      user = Factory.insert(:user)
      conn = conn |> log_in_user(user) |> post("/videos", %{video: %{title: ""}})

      assert html_response(conn, 200) =~ "can't be blank"
    end
  end
end
```

```elixir
defmodule MyAppWeb.ConnCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      import MyAppWeb.ConnCase
      import MyApp.Factory
    end
  end

  defp log_in_user(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |>put_session(:user_id, user.id)
  end
end
```

## LiveView Testing

```elixir
defmodule MyAppWeb.VideoLiveTest do
  use MyAppWeb.ConnCase
  import Phoenix.LiveViewTest

  test "shows video list", %{conn: conn} do
    video = Factory.insert(:published_video)

    {:ok, _view, html} = live(conn, "/videos")

    assert html =~ video.title
  end
end
```

## Best Practices

1. **`async: true`**: Enable async tests for embarrassingly parallel unit tests
2. **Test behaviour, not implementation**: Test context public API, not internal helpers
3. **Use factories over fixtures**: Factories with ExMachina produce cleaner, reusable test data
4. **Mox at behaviour boundaries**: Mock at the behaviour level, not directly on modules
5. **Shared setup in `DataCase`/`ConnCase`**: Keep setup DRY with shared case templates
6. **Name test functions descriptively**: `test "create_user/1 returns error with duplicate email"`
7. **Keep tests fast**: Mock slow external services; use in-memory SQLite for quick DB tests
8. **Test happy and sad paths**: Success, validation errors, not-found, and authorization cases
