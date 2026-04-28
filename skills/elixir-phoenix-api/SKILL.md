---
name: elixir-phoenix-api
description: >
  Use when building RESTful API controllers in Phoenix, implementing JSON rendering,
  API authentication, API versioning, or OpenAPI documentation. Covers Phoenix
  controller patterns, JSON views, and token-based auth.
risk: medium
source: self-created
date_added: 2026-04-18
---

# Phoenix API Development Skills

## When to Use

- When building REST API endpoints in Phoenix
- When implementing API authentication (token-based)
- When structuring API controllers and views
- When handling API errors consistently
- When versioning an API

## API Controller Pattern

```elixir
defmodule MyAppWeb.Api.V1.VideoController do
  use MyAppWeb, :controller
  alias MyApp.Content
  alias MyApp.Content.Video

  action_fallback MyAppWeb.Api.FallbackController

  def index(conn, params) do
    videos = Content.list_videos(pagination_opts(params))
    render(conn, :index, videos: videos)
  end

  def show(conn, %{"id" => id}) do
    video = Content.get_video!(id)
    render(conn, :show, video: video)
  end

  def create(conn, %{"video" => video_params}) do
    with {:ok, %Video{} = video} <- Content.create_video(video_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/v1/videos/#{video}")
      |> render(:show, video: video)
    end
  end

  def update(conn, %{"id" => id, "video" => video_params}) do
    video = Content.get_video!(id)

    with {:ok, %Video{} = video} <- Content.update_video(video, video_params) do
      render(conn, :show, video: video)
    end
  end

  def delete(conn, %{"id" => id}) do
    video = Content.get_video!(id)
    {:ok, _video} = Content.delete_video(video)
    send_resp(conn, :no_content, "")
  end

  defp pagination_opts(%{"page" => page, "per_page" => per_page}) do
    %{page: String.to_integer(page), per_page: String.to_integer(per_page)}
  end
  defp pagination_opts(_), do: %{page: 1, per_page: 20}
end
```

## Fallback Controller

```elixir
defmodule MyAppWeb.Api.FallbackController do
  use MyAppWeb, :controller

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> put_view(json: MyAppWeb.Api.ErrorView)
    |> render("404.json", message: "Resource not found")
  end

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn
    |> put_status(:unprocessable_entity)
    |> put_view(json: MyAppWeb.Api.ErrorView)
    |> render("422.json", changeset: changeset)
  end

  def call(conn, {:error, :unauthorized}) do
    conn
    |> put_status(:forbidden)
    |> put_view(json: MyAppWeb.Api.ErrorView)
    |> render("403.json", message: "Unauthorized")
  end
end
```

## JSON Views (Phoenix 1.7+)

```elixir
# my_app_web/controllers/api/video_view.ex
defmodule MyAppWeb.Api.VideoView do
  use MyAppWeb, :view

  def render("index.json", %{videos: videos}) do
    %{data: Enum.map(videos, &video_json/1)}
  end

  def render("show.json", %{video: video}) do
    %{data: video_json(video)}
  end

  defp video_json(video) do
    %{
      id: video.id,
      title: video.title,
      description: video.description,
      duration: video.duration,
      status: video.status,
      user_id: video.user_id,
      inserted_at: video.inserted_at,
      updated_at: video.updated_at
    }
  end
end
```

```elixir
# my_app_web/controllers/api/error_view.ex
defmodule MyAppWeb.Api.ErrorView do
  use MyAppWeb, :view

  def render("404.json", %{message: message}) do
    %{error: %{code: "not_found", message: message}}
  end

  def render("422.json", %{changeset: changeset}) do
    %{
      error: %{
        code: "validation_error",
        message: "Invalid request parameters",
        details: translate_errors(changeset)
      }
    }
  end

  def render("403.json", %{message: message}) do
    %{error: %{code: "forbidden", message: message}}
  end

  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
```

## API Authentication (Token-based)

### Session/Password Auth

```elixir
# Plug in router
pipeline :api do
  plug :accepts, ["json"]
  plug MyAppWeb.Auth.API
end

# my_app_web/plugs/api_auth.ex
defmodule MyAppWeb.Auth.API do
  import Plug.Conn
  alias MyApp.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, user_id} <- MyApp.Token.verify(token) do
      assign(conn, :current_user, Accounts.get_user!(user_id))
    else
      _ -> conn |> halt() |> unauthorized()
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> put_view(json: MyAppWeb.Api.ErrorView)
    |> render("401.json", message: "Unauthorized")
  end
end
```

## API Routes

```elixir
# router.ex
scope "/api/v1", MyAppWeb.Api, as: :api do
  pipe_through [:api, :authenticate]

  resources "/videos", VideoController, except: [:new, :edit]
end

scope "/api/v1", MyAppWeb.Api do
  pipe_through [:api]

  post "/auth/login", AuthController, :login
end
```

## Rate Limiting

```elixir
defmodule MyAppWeb.Plugs.RateLimiter do
  @limit 100
  @window 60_000  # 1 minute in ms

  def init(opts), do: opts

  def call(conn, _opts) do
    key = "rate_limit:#{ip_address(conn)}"

    case ExRated.check_rate(key, @window, @limit) do
      :ok -> conn
      _ -> conn |> halt() |> too_many_requests()
    end
  end

  defp too_many_requests(conn) do
    conn
    |> put_status(:too_many_requests)
    |> put_view(json: MyAppWeb.Api.ErrorView)
    |> render("429.json", message: "Rate limit exceeded")
  end
end
```

## Best Practices

1. **Use `action_fallback Controller`**: Centralize error handling instead of repeating it
2. **Always return proper status codes**: `201 created`, `204 no_content`, `422 unprocessable_entity`, `404 not_found`
3. **Version your API in the URL**: `/api/v1/`, `/api/v2/`
4. **Validate with changesets, not manual checks**: Let your schema changesets do the heavy lifting
5. **Render only what the client needs**: Use separate JSON views for different responses
6. **Log API requests**: Use `logger` to log request/response for debugging
7. **Handle CORS**: Add `cors_plug` for cross-origin browser API access
8. **Return consistent error format**: Always `{:error, reason}`, never raw exceptions in JSON responses
