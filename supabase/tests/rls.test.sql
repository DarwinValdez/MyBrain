-- Ownership-isolation and indexing tests for the NEXUS schema.
-- Run with scripts/test-db.sh (plain PostgreSQL + pgvector + local-shim.sql).
-- Any failed assertion raises an exception and aborts the run.

\set ON_ERROR_STOP on

create or replace function pg_temp.assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

create or replace function pg_temp.vec(first real)
returns text language sql as $$
  select '[' || first::text || ',' || array_to_string(array_fill(0.01::real, array[1023]), ',') || ']'
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}');

select pg_temp.assert((select count(*) from public.profiles) = 2, 'profiles created by signup trigger');

-- ---------------------------------------------------------------- Alice writes
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into public.projects (id, name) values ('10000000-0000-0000-0000-00000000000a', 'Alice project');
insert into public.memories (id, title, content, type, tags, project_id, content_hash) values
  ('20000000-0000-0000-0000-00000000000a', 'Alice secret', 'The launch codeword is heliotrope', 'fact',
   array['launch'], '10000000-0000-0000-0000-00000000000a', 'hash-a1'),
  ('20000000-0000-0000-0000-0000000000a2', 'Alice idea', 'Use heliotrope as a theme colour', 'idea',
   array['design'], null, 'hash-a2');

select pg_temp.assert(
  (select owner_id from public.memories where id = '20000000-0000-0000-0000-00000000000a')
    = '00000000-0000-0000-0000-00000000000a',
  'owner_id defaults to auth.uid()');

select pg_temp.assert(
  public.replace_memory_chunks('20000000-0000-0000-0000-00000000000a', 'hash-a1',
    jsonb_build_array(jsonb_build_object('chunk_index', 0, 'content', 'The launch codeword is heliotrope', 'embedding', pg_temp.vec(0.9)))),
  'owner can index own memory');
select pg_temp.assert(
  public.replace_memory_chunks('20000000-0000-0000-0000-0000000000a2', 'hash-a2',
    jsonb_build_array(jsonb_build_object('chunk_index', 0, 'content', 'Use heliotrope as a theme colour', 'embedding', pg_temp.vec(0.8)))),
  'owner can index second memory');
select pg_temp.assert(
  (select index_status from public.memories where id = '20000000-0000-0000-0000-00000000000a') = 'indexed',
  'index status becomes indexed');
select pg_temp.assert(
  not public.replace_memory_chunks('20000000-0000-0000-0000-00000000000a', 'stale-hash', '[]'::jsonb),
  'stale content hash is rejected');

select pg_temp.assert(
  (select count(*) from public.match_memory_chunks(pg_temp.vec(0.9)::extensions.vector, 5)) = 2,
  'owner semantic search sees own chunks');
select pg_temp.assert(
  (select count(*) from public.match_memory_chunks(pg_temp.vec(0.9)::extensions.vector, 5,
     '10000000-0000-0000-0000-00000000000a')) = 1,
  'project filter restricts semantic search');
select pg_temp.assert(
  (select count(*) from public.keyword_search_memories('heliotrope', 5)) = 2,
  'owner keyword search sees own memories');
select pg_temp.assert(
  (select memory_id from public.keyword_search_memories('What was the launch codeword I picked?', 5) limit 1)
    = '20000000-0000-0000-0000-00000000000a',
  'keyword search matches any term of a natural-language question, best match first');
select pg_temp.assert(
  (select count(*) from public.keyword_search_memories('the and of', 5)) = 0,
  'stop-word-only queries return nothing instead of erroring');
select pg_temp.assert(
  (select count(*) from public.keyword_search_memories($q$it's "quoted" & (weird) | !chars:*$q$, 5)) >= 0,
  'punctuation in queries cannot break the tsquery');
select pg_temp.assert(
  (select count(*) from public.similar_memories('20000000-0000-0000-0000-00000000000a', 5, 0.1)) = 1,
  'similar_memories finds the other memory');

insert into public.memory_relationships (source_memory_id, target_memory_id, status, origin)
values ('20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a2', 'suggested', 'ai');

insert into public.conversations (id, title) values ('30000000-0000-0000-0000-00000000000a', 'Alice chat');
insert into public.conversation_messages (conversation_id, role, content)
values ('30000000-0000-0000-0000-00000000000a', 'user', 'What is the codeword?');

-- Editing content invalidates the index and removes stale chunks.
update public.memories set content = 'Changed', content_hash = 'hash-a1-v2'
where id = '20000000-0000-0000-0000-00000000000a';
select pg_temp.assert(
  (select index_status from public.memories where id = '20000000-0000-0000-0000-00000000000a') = 'pending',
  'content change resets index status');
select pg_temp.assert(
  (select count(*) from public.memory_chunks where memory_id = '20000000-0000-0000-0000-00000000000a') = 0,
  'content change removes stale chunks');
-- Re-index for the remaining tests.
select public.replace_memory_chunks('20000000-0000-0000-0000-00000000000a', 'hash-a1-v2',
  jsonb_build_array(jsonb_build_object('chunk_index', 0, 'content', 'Changed', 'embedding', pg_temp.vec(0.9))));

-- ------------------------------------------------------------------ Bob reads
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);

select pg_temp.assert((select count(*) from public.memories) = 0, 'bob cannot read alice memories');
select pg_temp.assert((select count(*) from public.projects) = 0, 'bob cannot read alice projects');
select pg_temp.assert((select count(*) from public.memory_chunks) = 0, 'bob cannot read alice chunks');
select pg_temp.assert((select count(*) from public.memory_relationships) = 0, 'bob cannot read alice relationships');
select pg_temp.assert((select count(*) from public.conversations) = 0, 'bob cannot read alice conversations');
select pg_temp.assert((select count(*) from public.conversation_messages) = 0, 'bob cannot read alice messages');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'bob only sees his own profile');
select pg_temp.assert(
  (select count(*) from public.match_memory_chunks(pg_temp.vec(0.9)::extensions.vector, 50)) = 0,
  'bob semantic search returns nothing of alice');
select pg_temp.assert(
  (select count(*) from public.keyword_search_memories('heliotrope', 50)) = 0,
  'bob keyword search returns nothing of alice');
select pg_temp.assert(
  (select count(*) from public.similar_memories('20000000-0000-0000-0000-00000000000a', 5, 0.0)) = 0,
  'bob cannot use alice memory as a similarity probe');
select pg_temp.assert(
  not public.replace_memory_chunks('20000000-0000-0000-0000-00000000000a', 'hash-a1-v2', '[]'::jsonb),
  'bob cannot replace alice chunks');

update public.memories set title = 'pwned' where id = '20000000-0000-0000-0000-00000000000a';
delete from public.memories where id = '20000000-0000-0000-0000-00000000000a';
delete from public.projects where id = '10000000-0000-0000-0000-00000000000a';

-- Bob cannot write rows owned by Alice …
do $$
begin
  insert into public.memories (title, content_hash, owner_id)
  values ('forged', 'x', '00000000-0000-0000-0000-00000000000a');
  raise exception 'ASSERTION FAILED: bob inserted a memory owned by alice';
exception when insufficient_privilege then null;
end;
$$;

-- … nor attach his memory to Alice's project …
do $$
begin
  insert into public.memories (title, content_hash, project_id)
  values ('sneaky', 'x', '10000000-0000-0000-0000-00000000000a');
  raise exception 'ASSERTION FAILED: bob linked to alice project';
exception when foreign_key_violation then null;
end;
$$;

-- … nor post into Alice's conversation …
do $$
begin
  insert into public.conversation_messages (conversation_id, role, content)
  values ('30000000-0000-0000-0000-00000000000a', 'user', 'hi');
  raise exception 'ASSERTION FAILED: bob wrote into alice conversation';
exception when foreign_key_violation then null;
end;
$$;

-- … nor link his memory to hers.
insert into public.memories (id, title, content_hash) values ('20000000-0000-0000-0000-00000000000b', 'Bob note', 'hash-b');
do $$
begin
  insert into public.memory_relationships (source_memory_id, target_memory_id)
  values ('20000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000a');
  raise exception 'ASSERTION FAILED: bob linked to alice memory';
exception when foreign_key_violation then null;
end;
$$;

-- --------------------------------------------------------------- anon role
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  perform count(*) from public.memories;
  raise exception 'ASSERTION FAILED: anon could query memories';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform public.delete_own_account();
  raise exception 'ASSERTION FAILED: anon could call delete_own_account';
exception when insufficient_privilege then null;
end;
$$;

-- ------------------------------------------- Alice's data survived Bob's attempts
reset role;
select pg_temp.assert(
  (select title from public.memories where id = '20000000-0000-0000-0000-00000000000a') = 'Alice secret',
  'alice memory unchanged by bob');
select pg_temp.assert(
  (select count(*) from public.projects where id = '10000000-0000-0000-0000-00000000000a') = 1,
  'alice project not deleted by bob');

-- ------------------------------------------------------------ deletion cascade
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
delete from public.memories where id = '20000000-0000-0000-0000-0000000000a2';
select pg_temp.assert(
  (select count(*) from public.memory_chunks where memory_id = '20000000-0000-0000-0000-0000000000a2') = 0,
  'deleting a memory removes its chunks');
select pg_temp.assert((select count(*) from public.memory_relationships) = 0,
  'deleting a memory removes its relationships');

delete from public.projects where id = '10000000-0000-0000-0000-00000000000a';
select pg_temp.assert(
  (select project_id from public.memories where id = '20000000-0000-0000-0000-00000000000a') is null,
  'deleting a project keeps its memories and clears the link');

select public.delete_own_account();
reset role;
select pg_temp.assert(
  not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'),
  'account deleted');
select pg_temp.assert(
  (select count(*) from public.memories where owner_id = '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from public.memory_chunks where owner_id = '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from public.conversations where owner_id = '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from public.conversation_messages where owner_id = '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0,
  'account deletion cascades to every table');
select pg_temp.assert(
  (select count(*) from public.memories where owner_id = '00000000-0000-0000-0000-00000000000b') = 1,
  'other accounts are untouched by account deletion');

\echo 'All database tests passed.'
