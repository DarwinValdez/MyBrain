-- Paste this into Supabase → SQL Editor → Run (project "My-brain").
-- These three functions are part of supabase/migrations/20261023000000_nexus_init.sql;
-- they were not applied automatically because they contain DELETE statements.

-- 1) Editing a memory's text invalidates its old embeddings.
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

drop trigger if exists memories_invalidate_index on public.memories;
create trigger memories_invalidate_index
  before update of title, content, content_hash on public.memories
  for each row execute function public.memories_invalidate_index();

-- 2) Atomically replace a memory's embeddings (used when indexing).
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

-- 3) "Delete account" in Settings: removes only the caller's own account (and,
--    via ON DELETE CASCADE, all of their data).
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
  public.replace_memory_chunks(uuid, text, jsonb),
  public.delete_own_account()
from public, anon;

grant execute on function
  public.replace_memory_chunks(uuid, text, jsonb),
  public.delete_own_account()
to authenticated;
