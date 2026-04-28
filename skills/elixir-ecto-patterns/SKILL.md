---
name: elixir-ecto-patterns
description: >
  Use when defining Ecto schemas, writing database migrations, building queries,
  validating changesets, or preventing N+1 queries. Covers schema design, migration
  patterns, query building, preloads, and transactions.
risk: medium
source: self-created
date_added: 2026-04-18
---

# Ecto Patterns Skills

## When to Use

- When defining database schemas
- When writing migrations
- When building complex queries
- When validating input with changesets
- When loading associated data efficiently
- When using database transactions

## Schema Definition

```elixir
defmodule MyApp.Content.Video do
  use Ecto.Schema
  import Ecto.Changeset

  schema "videos" do
    field :title, :string
    field :description, :string
    field :duration, :integer            # seconds
    field :status, Ecto.Enum, values: [:draft, :published, :archived]
    field :published_at, :utc_datetime

    belongs_to :user, MyApp.Accounts.User
    has_many :comments, MyApp.Content.Comment
    many_to_many :tags, MyApp.Content.Tag, join_through: "video_tags"

    timestamps type: :utc_datetime
  end

  def changeset(video, attrs) do
    video
    |> cast(attrs, [:title, :description, :duration, :status, :published_at, :user_id])
    |> validate_required([:title, :user_id])
    |> validate_length(:title, min: 1, max: 255)
    |> validate_number(:duration, greater_than: 0)
    |> unique_constraint(:title)
    |> foreign_key_constraint(:user_id)
  end

  def published_changeset(video, attrs) do
    video
    |> changeset(attrs)
    |> put_change(:status, :published)
    |> put_change(:published_at, DateTime.utc_now())
  end
end
```

## Migration Patterns

### Create Table

```elixir
defmodule MyApp.Repo.Migrations.CreateVideos do
  use Ecto.Migration

  def change do
    create table(:videos) do
      add :title, :string, null: false
      add :description, :text
      add :duration, :integer
      add :status, :string, default: "draft"
      add :user_id, references(:users, on_delete: :delete_all)
      add :published_at, :utc_datetime

      timestamps type: :utc_datetime
    end

    create index(:videos, [:user_id])
    create index(:videos, [:status])
    create index(:videos, [:published_at])
  end
end
```

### Add Index with Conflict Target (PostgreSQL)

```elixir
def change do
  create index(:videos, [:user_id, :status],
    name: :videos_user_status_idx
  )
end
```

## Query Building Patterns

### Module-level Queries

```elixir
defmodule MyApp.Content.Video do
  # Query for all published videos, newest first
  def published(query \\ __MODULE__) do
    from v in query,
      where: v.status == :published,
      order_by: [desc: v.published_at]
  end

  # Query for videos by user
  def for_user(query \\ __MODULE__, user_id) do
    from v in query,
      where: v.user_id == ^user_id
  end

  # Search by title
  def search(query \\ __MODULE__, term) do
    from v in query,
      where: ilike(v.title, ^"%#{term}%")
  end
end
```

### Composing Queries

```elixir
# Use in context
def list_published_for_user(user_id) do
  Video
  |> Video.published()
  |> Video.for_user(user_id)
  |> Repo.all()
end
```

### Joins

```elixir
def with_authors(query \\ __MODULE__) do
  from v in query,
    join: u in assoc(v, :user),
    preload: [user: u]
end

def with_comments(query \\ __MODULE__) do
  from v in query,
    left_join: c in assoc(v, :comments),
    preload: [comments: c]
end
```

## Preload Patterns (N+1 Prevention)

```elixir
# Always preload associations when loading multiple records
def list_videos do
  Repo.all(from v in Video, preload: [:user, :tags])
end

# Or use subquery preload for large datasets
def list_videos_with_comments do
  videos = Repo.all(Video)

  videos
  |> Repo.preload(comments: [:author])
end

# Batch preload (avoids N+1)
def list_videos do
  videos = Repo.all(Video)
  user_ids = Enum.map(videos, & &1.user_id)

  users = Repo.all(from u in User, where: u.id in ^user_ids) |> Enum.into(%{}, &{&1.id, &1})

  videos
  |> Enum.map(fn video -> %{video | user: users[video.user_id]} end)
end
```

## Changeset Validation Patterns

```elixir
defmodule MyApp.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :password, :string, virtual: true
    field :hashed_password, :string
    field :role, :string
    timestamps type: :utc_datetime
  end

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password])
    |> validate_email()
    |> validate_password()
    |> put_hash_password()
  end

  defp validate_email(changeset) do
    changeset
    |> validate_required([:email])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/)
    |> validate_length(:email, max: 255)
    |> unique_constraint(:email)
  end

  defp validate_password(changeset) do
    changeset
    |> validate_required([:password])
    |> validate_length(:password, min: 8, max: 72)
    |> validate_format(:password, ~r/[A-Z]/, message: "must contain an uppercase letter")
    |> validate_format(:password, ~r/[a-z]/, message: "must contain a lowercase letter")
    |> validate_format(:password, ~r/[0-9]/, message: "must contain a number")
  end

  defp put_hash_password(changeset) do
    case changeset do
      %Ecto.Changeset{valid?: true, changes: %{password: password}} ->
        put_change(changeset, :hashed_password, Bcrypt.hash_pwd_salt(password))
      _ ->
        changeset
    end
  end
end
```

## Transactions

```elixir
def create_video_with_tag(video_attrs, tag_names) do
  Repo.transaction(fn ->
    with {:ok, video} <- create_video(video_attrs),
         {:ok, _tag_assoc} <- add_tags(video, tag_names) do
      {:ok, Repo.preload(video, [:user, :tags])}
    else
      {:error, changeset} -> Repo.rollback(changeset)
    end
  end)
end
```

## Best Practices

1. **Always use `cast/4`** for external input, never directly assign
2. **Composable queries**: Define query functions on the schema module
3. **Preload explicitly**: Never assume associations are loaded
4. **Unique constraints at DB level** plus application-level validation
5. **Use virtual fields** for passwords, tokens — never store raw secrets
6. **Idempotent migrations**: Use `change` with `up`/`down` only when necessary
7. **Avoid `Ecto.Adapters.SQL` raw queries** unless absolutely needed
8. **Always define `timestamps`** on every schema
