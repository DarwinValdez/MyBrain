-- NEXUS — initial schema
--
-- Every user-owned table carries owner_id, has Row Level Security enabled and
-- only grants access to rows where owner_id = auth.uid(). Cross-table
-- references use composite (id, owner_id) foreign keys so a row can never point
-- at another account's data, even if application code is buggy.
--
-- Embedding dimension: 1024. Both supported embedding providers are configured
-- to emit 1024-dimensional vectors (Voyage `output_dimension`, OpenAI
-- `dimensions`). If you change it, change EMBEDDING_DIMENSIONS in
-- src/lib/ai/config.ts and every vector(1024) below.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  goals text not null default '' check (char_length(goals) <= 4000),
  next_steps text not null default '' check (char_length(next_steps) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- memories
-- ---------------------------------------------------------------------------

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '' check (char_length(content) <= 50000),
  type text not null default 'note'
    check (type in ('idea', 'note', 'fact', 'decision', 'research', 'reflection', 'meeting', 'reference')),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  source_url text check (source_url is null or (char_length(source_url) <= 2048 and source_url ~* '^https?://')),
  source_notes text not null default '' check (char_length(source_notes) <= 2000),
  -- Sharing is outside the MVP: every memory is private. The column exists so a
  -- future, explicitly authorized sharing feature has an obvious place to live.
  visibility text not null default 'private' check (visibility = 'private'),
  -- sha256 of title + content, maintained by the application. Indexing only
  -- writes chunks when the hash still matches, so a slow embedding job can never
  -- overwrite newer content with stale vectors.
  content_hash text not null,
  index_status text not null default 'pending'
    check (index_status in ('pending', 'indexed', 'failed')),
  index_error text check (char_length(index_error) <= 500),
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored,
  unique (id, owner_id),
  foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id)
);

create index memories_owner_created_idx on public.memories (owner_id, created_at desc);
create index memories_owner_updated_idx on public.memories (owner_id, updated_at desc);
create index memories_owner_project_idx on public.memories (owner_id, project_id);
create index memories_owner_type_idx on public.memories (owner_id, type);
create index memories_owner_status_idx on public.memories (owner_id, index_status);
create index memories_tags_idx on public.memories using gin (tags);
create index memories_fts_idx on public.memories using gin (fts);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

-- When the text changes, mark the memory for re-indexing and drop its old
-- chunks immediately, so stale text is never retrieved as context.
create or replace function public.memories_invalidate_index()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content_hash is distinct from old.content_hash then
    new.index_status = 'pending';
    new.index_error = null;
    new.indexed_at = null;
    delete from public.memory_chunks where memory_id = new.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- memory_chunks (embeddings)
-- ---------------------------------------------------------------------------

create table public.memory_chunks (
  id bigint generated always as identity primary key,
  memory_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) <= 8000),
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  unique (memory_id, chunk_index),
  foreign key (memory_id, owner_id)
    references public.memories (id, owner_id) on delete cascade
);

create index memory_chunks_owner_idx on public.memory_chunks (owner_id);
create index memory_chunks_embedding_idx on public.memory_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create trigger memories_invalidate_index
  before update of title, content, content_hash on public.memories
  for each row execute function public.memories_invalidate_index();

-- ---------------------------------------------------------------------------
-- memory_relationships
-- ---------------------------------------------------------------------------

create table public.memory_relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_memory_id uuid not null,
  target_memory_id uuid not null,
  relation_type text not null default 'related'
    check (relation_type in ('related', 'supports', 'contradicts', 'follows', 'inspired_by')),
  -- 'suggested' rows come from AI similarity and are NOT facts until accepted.
  status text not null default 'accepted' check (status in ('accepted', 'suggested', 'rejected')),
  origin text not null default 'user' check (origin in ('user', 'ai')),
  reason text not null default '' check (char_length(reason) <= 500),
  score real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_memory_id <> target_memory_id),
  foreign key (source_memory_id, owner_id)
    references public.memories (id, owner_id) on delete cascade,
  foreign key (target_memory_id, owner_id)
    references public.memories (id, owner_id) on delete cascade
);

-- One relationship per unordered pair.
create unique index memory_relationships_pair_idx on public.memory_relationships (
  owner_id,
  least(source_memory_id, target_memory_id),
  greatest(source_memory_id, target_memory_id)
);
create index memory_relationships_source_idx on public.memory_relationships (source_memory_id);
create index memory_relationships_target_idx on public.memory_relationships (target_memory_id);

create trigger memory_relationships_set_updated_at
  before update on public.memory_relationships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null default 'New conversation' check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id)
);

create index conversations_owner_updated_idx on public.conversations (owner_id, updated_at desc);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 40000),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, owner_id)
    references public.conversations (id, owner_id) on delete cascade
);

create index conversation_messages_conversation_idx
  on public.conversation_messages (conversation_id, created_at);
-- Also serves the per-user Recall rate limit (questions in the last minute).
create index conversation_messages_owner_created_idx
  on public.conversation_messages (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.memories enable row level security;
alter table public.memory_chunks enable row level security;
alter table public.memory_relationships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- Nothing in NEXUS is readable without signing in.
revoke all on table
  public.profiles, public.projects, public.memories, public.memory_chunks,
  public.memory_relationships, public.conversations, public.conversation_messages
from anon;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner can update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Generic owner policies for the remaining tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'memories', 'memory_chunks', 'memory_relationships',
    'conversations', 'conversation_messages'
  ] loop
    execute format(
      'create policy "%1$s: owner can read" on public.%1$I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner can insert" on public.%1$I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner can update" on public.%1$I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner can delete" on public.%1$I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: semantic search
--
-- SECURITY INVOKER, so RLS applies, and ownership is also checked explicitly in
-- the query. Authorization never depends on the model or the caller's filters.
-- ---------------------------------------------------------------------------

create or replace function public.match_memory_chunks(
  query_embedding extensions.vector(1024),
  match_count integer default 8,
  filter_project_id uuid default null,
  min_similarity double precision default 0.0
)
returns table (
  chunk_id bigint,
  memory_id uuid,
  chunk_index integer,
  content text,
  similarity double precision,
  title text,
  type text,
  tags text[],
  project_id uuid,
  memory_created_at timestamptz,
  memory_updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- pgvector >= 0.8: keep scanning the HNSW index until enough rows survive the
  -- owner filter. Older pgvector versions don't have the setting; ignore that.
  begin
    perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  exception when others then
    null;
  end;

  return query
  select
    c.id,
    c.memory_id,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity,
    m.title,
    m.type,
    m.tags,
    m.project_id,
    m.created_at,
    m.updated_at
  from public.memory_chunks c
  join public.memories m on m.id = c.memory_id and m.owner_id = uid
  where c.owner_id = uid
    and (filter_project_id is null or m.project_id = filter_project_id)
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
end;
$$;

-- Keyword (full-text) search over the caller's memories. Natural-language
-- questions rarely contain every word of a note, so this matches ANY
-- meaningful term (stop words removed, English stemming) and ranks memories
-- that match more terms higher.
create or replace function public.keyword_search_memories(
  query_text text,
  match_count integer default 8,
  filter_project_id uuid default null
)
returns table (
  memory_id uuid,
  title text,
  content text,
  type text,
  tags text[],
  project_id uuid,
  rank real,
  memory_created_at timestamptz,
  memory_updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with terms as (
    select string_agg(quote_literal(lexeme), ' | ') as expr
    from unnest(to_tsvector('english', left(query_text, 500)))
  ),
  q as (
    select to_tsquery('simple', expr) as query from terms where expr is not null
  )
  select m.id, m.title, m.content, m.type, m.tags, m.project_id,
         ts_rank_cd(m.fts, q.query) as rank, m.created_at, m.updated_at
  from public.memories m, q
  where m.owner_id = auth.uid()
    and m.fts @@ q.query
    and (filter_project_id is null or m.project_id = filter_project_id)
  order by rank desc, m.updated_at desc
  limit least(greatest(match_count, 1), 50);
$$;

-- Memories semantically close to a given memory (used for AI-suggested links).
create or replace function public.similar_memories(
  p_memory_id uuid,
  match_count integer default 5,
  min_similarity double precision default 0.5
)
returns table (memory_id uuid, title text, type text, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with source as (
    select c.embedding
    from public.memory_chunks c
    where c.memory_id = p_memory_id and c.owner_id = auth.uid()
    order by c.chunk_index
    limit 1
  ),
  scored as (
    select c.memory_id, max(1 - (c.embedding <=> s.embedding)) as similarity
    from public.memory_chunks c, source s
    where c.owner_id = auth.uid() and c.memory_id <> p_memory_id
    group by c.memory_id
  )
  select m.id, m.title, m.type, sc.similarity::double precision
  from scored sc
  join public.memories m on m.id = sc.memory_id and m.owner_id = auth.uid()
  where sc.similarity >= min_similarity
  order by sc.similarity desc
  limit least(greatest(match_count, 1), 20);
$$;

-- Atomically replace a memory's chunks. Returns false (and writes nothing) if
-- the memory doesn't belong to the caller or its content changed since the
-- embeddings were computed.
create or replace function public.replace_memory_chunks(
  p_memory_id uuid,
  p_content_hash text,
  p_chunks jsonb
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  current_hash text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) > 200 then
    raise exception 'invalid chunks payload' using errcode = '22023';
  end if;

  select m.content_hash into current_hash
  from public.memories m
  where m.id = p_memory_id and m.owner_id = uid
  for update;

  if current_hash is null or current_hash <> p_content_hash then
    return false;
  end if;

  delete from public.memory_chunks where memory_id = p_memory_id and owner_id = uid;

  insert into public.memory_chunks (memory_id, owner_id, chunk_index, content, embedding)
  select p_memory_id, uid, x.chunk_index, x.content, x.embedding::extensions.vector(1024)
  from jsonb_to_recordset(p_chunks) as x(chunk_index integer, content text, embedding text);

  update public.memories
  set index_status = 'indexed', index_error = null, indexed_at = now()
  where id = p_memory_id and owner_id = uid;

  return true;
end;
$$;

-- Permanently delete the caller's account. Every user-owned table references
-- auth.users with ON DELETE CASCADE, so this removes profiles, projects,
-- memories, embeddings, relationships and conversations in one transaction.
create or replace function public.delete_own_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function
  public.match_memory_chunks(extensions.vector, integer, uuid, double precision),
  public.keyword_search_memories(text, integer, uuid),
  public.similar_memories(uuid, integer, double precision),
  public.replace_memory_chunks(uuid, text, jsonb),
  public.delete_own_account(),
  public.handle_new_user()
from public, anon;

grant execute on function
  public.match_memory_chunks(extensions.vector, integer, uuid, double precision),
  public.keyword_search_memories(text, integer, uuid),
  public.similar_memories(uuid, integer, double precision),
  public.replace_memory_chunks(uuid, text, jsonb),
  public.delete_own_account()
to authenticated;
