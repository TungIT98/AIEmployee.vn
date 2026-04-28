---
name: elixir-liveview
description: >
  Use when building Phoenix LiveView pages, implementing real-time features, managing
  LiveView state, composing with function components, or handling LiveView form
  patterns. Covers LiveView lifecycle, assigns, pub/sub, and component composition.
risk: medium
source: self-created
date_added: 2026-04-18
---

# Phoenix LiveView Skills

## When to Use

- When building real-time interactive pages
- When managing server-rendered state on the client
- When composing reusable UI with function components
- When handling multi-step form flows
- When subscribing to real-time updates via pub/sub

## LiveView Module Structure

```elixir
defmodule MyAppWeb.VideoLive.Index do
  use MyAppWeb, :live_view
  alias MyApp.Content
  alias MyAppWeb.VideoComponents

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :videos, Content.list_videos())}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :index, _params) do
    assign(socket, :page_title, "All Videos")
  end

  defp apply_action(socket, :new, _params) do
    assign(socket, :page_title, "New Video", video: %Video{})
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="video-list">
      <.live_component module={VideoComponents} id="header" />
      <%= for video <- @videos do %>
        <.video_card video={video} />
      <% end %>
    </div>
    """
  end

  # Event handlers
  @impl true
  def handle_event("delete_video", %{"id" => id}, socket) do
    video = Content.get_video!(id)
    {:ok, _} = Content.delete_video(video)

    {:noreply, assign(socket, :videos, Content.list_videos())}
  end
end
```

## Function Components

```elixir
# my_app_web/components/video_components.ex
defmodule MyAppWeb.VideoComponents do
  use Phoenix.Component

  def video_card(assigns) do
    ~H"""
    <div class="video-card" id={"video-#{@video.id}"}>
      <h3><%= @video.title %></h3>
      <p><%= @video.description %></p>
      <span class="badge"><%= @video.status %></span>
      <button phx-click="delete_video" phx-value-id={@video.id}>
        Delete
      </button>
    </div>
    """
  end

  def status_badge(assigns) do
    ~H"""
    <span class={"badge badge-#{@status}"}>
      <%= @status %>
    </span>
    """
  end
end
```

## LiveComponent (Stateful)

Use for isolated stateful UI sections:

```elixir
defmodule MyAppWeb.VideoLive.CommentSection do
  use Phoenix.LiveComponent

  def mount(socket) do
    {:ok, assign(socket, :comments, [])}
  end

  def update(assigns, socket) do
    {:ok, assign(socket, :video_id, assigns.video_id)}
  end

  def render(assigns) do
    ~H"""
    <div id={"comments-#{@video_id}"}>
      <%= for comment <- @comments do %>
        <p><%= comment.body %></p>
      <% end %>

      <form phx-submit="add_comment" phx-target={@myself}>
        <input name="body" placeholder="Add a comment..." />
        <button>Post</button>
      </form>
    </div>
    """
  end

  def handle_event("add_comment", %{"body" => body}, socket) do
    {:ok, comment} = MyApp.Content.add_comment(socket.assigns.video_id, %{body: body})
    {:noreply, assign(socket, :comments, socket.assigns.comments ++ [comment])}
  end
end
```

## Form Handling with change/add_pattern

```elixir
defmodule MyAppWeb.VideoLive.Form do
  use MyAppWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, changeset: Content.change_video(%Video{}))}
  end

  def render(assigns) do
    ~H"""
    <.form let={f} for={@changeset} phx-change="validate" phx-submit="save">
      <%= text_input f, :title %>
      <%= error_tag f, :title %>

      <%= textarea f, :description %>
      <%= error_tag f, :description %>

      <%= number_input f, :duration %>
      <%= error_tag f, :duration %>

      <%= submit "Save", phx_disable_with: "Saving..." %>
    </.form>
    """
  end

  def handle_event("validate", %{"video" => video_params}, socket) do
    changeset =
      %Video{}
      |> Content.change_video(video_params)
      |> Map.put(:action, :insert)

    {:noreply, assign(socket, changeset: changeset)}
  end

  def handle_event("save", %{"video" => video_params}, socket) do
    case Content.create_video(video_params) do
      {:ok, _video} ->
        {:noreply,
         socket
         |> put_flash(:info, "Video created")
         |> push_navigate(to: "/videos")}

      {:error, changeset} ->
        {:noreply, assign(socket, changeset: changeset)}
    end
  end
end
```

## Pub/Sub for Real-Time Updates

### Broadcasting from Context

```elixir
defmodule MyApp.Content do
  def create_video(attrs \\\\ %{}) do
    case Repo.insert(Video.changeset(%Video{}, attrs)) do
      {:ok, video} ->
        MyAppWeb.Endpoint.broadcast("videos", "video:created", %{video: video})
        {:ok, video}

      {:error, changeset} ->
        {:error, changeset}
    end
  end
end
```

### Subscribing in LiveView

```elixir
@impl true
def mount(_params, _session, socket) do
  if connected?(socket) do
    MyAppWeb.Endpoint.subscribe("videos")
  end

  {:ok, assign(socket, :videos, Content.list_videos())}
end

@impl true
def handle_info(%{event: "video:created", payload: %{video: video}}, socket) do
  {:noreply, update(socket, :videos, fn videos -> [video | videos] end)}
end
```

## Best Practices

1. **Keep LiveViews focused**: One LiveView per page/screen, delegate to components
2. **Use `phx-change` for validation, `phx-submit` for final save**: Don't call the same handler for both
3. **Always handle `mount` errors**: `{:error, reason}` redirects to a fallback page
4. **`connected?` check**: Only subscribe to pub/sub after the socket connects
5. **Minimize assigns**: Only assign what you need; too many assigns causes re-renders
6. **Use LiveComponents for isolated state**: Don't put all state in the parent LiveView
7. **Progressively enhance**: Start with server-rendered HTML, add interactivity with `phx-*`
8. **Graceful degradation**: Use `live_link` for URL changes that work without JS when possible
