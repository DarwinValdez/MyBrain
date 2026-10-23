# NEXUS — your personal digital brain

> Everything you learn, think, and build, connected and available when you need it.

NEXUS is a private, single-user knowledge system. You capture ideas, notes, decisions, research and references; NEXUS stores them in PostgreSQL, indexes them for semantic search with pgvector, and lets you ask questions in natural language. Answers are generated from **your** saved memories and cite the exact memories they used.

- **Stack:** Next.js 16 (App Router, Cache Components, TypeScript strict) · Tailwind CSS 4 · Supabase Auth + Postgres + pgvector · Anthropic Claude (answers) · Voyage AI or OpenAI (embeddings) · Zod · React Flow · Vitest
- **Private by default:** every table has Row Level Security; every server query is also filtered by the signed-in user's id. There is no sharing feature.

---

## Features

| Area | What it does |
| --- | --- |
| **Auth** | Email/password sign-up (with email confirmation), sign-in, sign-out, password reset, session refresh in `src/proxy.ts`, and server-side checks on every page, server action and API route. |
| **Memories** | Create, edit, delete (with confirmation), view. Title, content, type (idea, note, fact, decision, research, personal reflection, meeting, reference), tags, optional project, source URL, source notes, private visibility, timestamps. Full-text search, filters by type/tag/project, sort by created/updated date, pagination. |
| **Quick capture** | Press <kbd>C</kbd> anywhere (or the Quick capture button) to save a thought in seconds. |
| **AI Recall** | RAG chat over your memories with inline `[n]` citations that link to the source memory. Hybrid retrieval (pgvector + Postgres full-text), project-scoped questions, persistent conversations, delete one or all conversations. |
| **Embeddings** | Memories are chunked, embedded (1024-d), and stored in `memory_chunks`. Index status per memory (`pending` / `indexed` / `failed`) with retry. Editing a memory invalidates and re-indexes it; deleting cascades to its chunks. |
| **Projects** | Name, description, status, goals, next steps; chronological memory timeline; associate/disassociate memories; "Ask about this project". |
| **Knowledge Graph** | Interactive React Flow graph of memories, projects and shared-tag concepts. Edges come from project membership, shared tags and user-confirmed links. AI-suggested links (embedding similarity) are dashed, labelled “AI suggestion”, and must be accepted or rejected. Zoom/pan, selection, details panel, filters by project and type. |
| **Settings** | Display name, password reset, AI configuration status (no secrets shown), plain-language explanation of what is sent to AI providers, JSON export, delete all conversations, delete all memories, delete account. |

---

## Project structure

```
.
├── src/
│   ├── proxy.ts                    # Next 16 "proxy" (middleware): session refresh + optimistic redirects
│   ├── app/
│   │   ├── page.tsx                # Public landing page
│   │   ├── setup/                  # Shown when Supabase env vars are missing
│   │   ├── (auth)/                 # login, signup, forgot-password, reset-password
│   │   ├── auth/confirm/route.ts   # Email-link handler (PKCE code or token_hash)
│   │   ├── (app)/                  # Signed-in shell: overview, memories, recall, graph, projects, settings
│   │   ├── actions/                # Server actions (auth, memories, projects, relationships, account)
│   │   └── api/                    # recall (POST), export (GET)
│   ├── components/                 # ui/ design system, shell/, memories/, projects/, recall/, graph/, …
│   └── lib/
│       ├── ai/                     # config, chunking, embeddings, retrieval, prompt, citations, generate
│       ├── data/                   # Server-only data access (always filtered by owner)
│       ├── supabase/               # Server client + proxy session helper
│       ├── auth.ts                 # getAuthContext / requireUser (verified session)
│       ├── indexing.ts             # Embedding pipeline with failure tracking + retry
│       ├── recall.ts               # RAG orchestration
│       ├── validation.ts           # Zod schemas for every input
│       └── database.types.ts       # TypeScript types matching the SQL schema
├── supabase/
│   ├── migrations/20261023000000_nexus_init.sql   # Schema, indexes, RLS, RPCs
│   └── tests/                      # RLS/ownership tests (plain Postgres + pgvector)
├── tests/                          # Vitest unit/integration tests
├── scripts/test-db.sh              # Runs the database tests
└── .env.example
```

### How AI Recall works

1. `POST /api/recall` verifies the session (`getClaims()`), validates the body with Zod, and enforces a per-user rate limit (10 questions/minute, counted in the database so it works across serverless instances).
2. The question is embedded (`input_type: query`) and `match_memory_chunks` (SECURITY INVOKER RPC, explicit `owner_id = auth.uid()` + RLS, optional project filter) returns the closest chunks. `keyword_search_memories` runs full-text search in parallel. Results are fused with reciprocal-rank fusion, grouped per memory, and capped (8 memories, ~16k characters) — the model never sees your whole database.
3. The prompt wraps excerpts in an escaped `<memories>` block and instructs the model to treat them as untrusted data, cite with `[n]`, separate saved facts from inference, say when context is insufficient, use dates carefully, not treat similarity as causation, and never claim perfect memory.
4. Claude (`AI_MODEL`, default `claude-opus-5-5`) answers via the official Anthropic SDK (streamed internally). Server-side refusal fallback (`fallbacks: "default"`) is enabled for models that support it.
5. `[n]` markers are mapped back to the memories that were actually provided; markers pointing anywhere else are removed. The question, answer and citations are stored in `conversation_messages`.

If embeddings are unavailable, Recall falls back to keyword search. If no generation key is set, Recall returns the matching memories as sources without a written answer.

---

## Environment variables

| Variable | Required | Where it's used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (browser + server). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes* | Publishable key (`sb_publishable_…`). *Or set the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead. |
| `NEXT_PUBLIC_SITE_URL` | production | Base URL for auth email links, e.g. `https://nexus.example.com`. |
| `AI_PROVIDER_API_KEY` | for answers | Anthropic API key. Server only. |
| `AI_MODEL` | no | Claude model id. Default `claude-opus-5-5`. |
| `AI_EFFORT` | no | `low` · `medium` (default) · `high` · `xhigh` · `max`. |
| `EMBEDDING_PROVIDER` | no | `voyage` (default) or `openai`. |
| `EMBEDDING_API_KEY` | for semantic search | Voyage AI or OpenAI key. Server only. |
| `EMBEDDING_MODEL` | no | Default `voyage-3.5` / `text-embedding-3-small`. Must support 1024-d output. |

Notes:

- Anthropic does not offer an embeddings API, so semantic search needs a second provider key (`EMBEDDING_API_KEY`). The migration's `vector(1024)` matches both supported providers, which are explicitly asked for 1024 dimensions; responses of any other size are rejected.
- **No `SUPABASE_SERVICE_ROLE_KEY` is needed.** All queries run as the signed-in user under RLS. Account deletion uses the `delete_own_account()` SECURITY DEFINER function, which can only delete the caller.
- Secrets are read only on the server (`src/lib/ai/config.ts`), never prefixed with `NEXT_PUBLIC_`, never stored in the database, and never shown in the UI.
- `NEXT_PUBLIC_*` values are inlined at build time: **redeploy after changing them**.

---

## 1. Create and configure Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **Apply the migration** — either:
   - Dashboard → **SQL Editor** → paste the contents of `supabase/migrations/20261023000000_nexus_init.sql` → Run; or
   - Supabase CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.

   The migration enables `vector` in the `extensions` schema, creates all tables, indexes (including an HNSW index), RLS policies, and RPC functions.
3. **Auth → Providers → Email:** keep Email enabled. Keep “Confirm email” on (recommended).
4. **Auth → URL Configuration:**
   - *Site URL:* your production URL (e.g. `https://nexus.example.com`), or `http://localhost:3000` while developing.
   - *Redirect URLs:* add `http://localhost:3000/auth/confirm` and `https://<your-domain>/auth/confirm` (and `https://*-<team>.vercel.app/auth/confirm` if you want preview deployments to work).
5. **Auth → Emails:** the default templates work (PKCE `?code=` flow). Supabase's built-in email sender is heavily rate-limited; configure custom SMTP before inviting real users.
6. Project Settings → API: copy the **Project URL** and the **publishable** (or legacy **anon**) key.

## 2. Configure AI providers

- **Answers:** create an Anthropic API key at [console.anthropic.com](https://console.anthropic.com) → `AI_PROVIDER_API_KEY`.
- **Embeddings:** create a Voyage AI key at [dash.voyageai.com](https://dash.voyageai.com) (or use an OpenAI key with `EMBEDDING_PROVIDER=openai`) → `EMBEDDING_API_KEY`.

Both are optional for running the app; features degrade as described above. If you add an embedding key after saving memories, open **Settings → Index pending & failed memories**.

## 3. Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env.local      # fill in the values
npm run dev                     # http://localhost:3000
```

### Checks

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # ESLint (next/core-web-vitals + typescript)
npm test            # Vitest unit/integration tests
npm run build       # production build
# Database/RLS tests: needs a disposable Postgres with pgvector (not a Supabase project)
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

## 4. Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project → Import** the repository. Framework preset: Next.js (auto-detected). Build command `next build`, output default.
3. **Settings → Environment Variables:** add every variable from the table above for **Production** (and **Preview** if you use previews). Set `NEXT_PUBLIC_SITE_URL` to the production URL.
4. Deploy. Then in Supabase, set **Site URL** and **Redirect URLs** to the Vercel domain (step 1.4) if you hadn't yet.
5. Changing any `NEXT_PUBLIC_*` variable requires a **redeploy**.

The app is serverless-friendly: no filesystem writes, no in-memory state, no background workers. `/api/recall` sets `maxDuration = 60` seconds.

### Production verification checklist

- [ ] Visiting `/` while signed out shows the landing page; `/overview` redirects to `/login`.
- [ ] `curl -i -X POST https://<domain>/api/recall` returns **401**.
- [ ] Sign up → confirmation email arrives → link lands on `/overview` signed in.
- [ ] Password reset email → `/reset-password` → new password works.
- [ ] Create a memory → detail page shows **Indexed for semantic search** (otherwise check `EMBEDDING_*`).
- [ ] AI Recall answers a question about that memory with a `[1]` citation linking back to it.
- [ ] Settings shows both AI providers as **Configured**.
- [ ] A second account cannot see the first account's memories (open a memory URL from account A while signed in as B → “Nothing here”).
- [ ] Export JSON downloads; delete account signs you out and removes the data.

---

## Security and privacy model

- **Authentication:** Supabase Auth with `@supabase/ssr` cookies. The proxy refreshes sessions; pages call `requireUser()`, server actions and route handlers call `getAuthContext()` and refuse when it's null. Sessions are verified with `getClaims()` (JWT signature check, falling back to the Auth server for legacy symmetric keys). Client-side routing is never relied on for protection.
- **Authorization in two layers:** every application query adds `owner_id = <user id>`, and every table has RLS policies `owner_id = auth.uid()` for select/insert/update/delete. Cross-table references use composite `(id, owner_id)` foreign keys, so a memory can't point at another user's project and a message can't be written into another user's conversation even if a policy were misconfigured. `anon` has no table privileges.
- **Vector search authorization** happens inside the SQL functions (`auth.uid()` filters + RLS), never in the prompt or the model.
- **Input validation:** Zod on every server action and API route; database CHECK constraints back up lengths and enums. Source URLs must be `http(s)`.
- **Rendering:** user content and AI output are rendered as text (no `dangerouslySetInnerHTML`, no Markdown/HTML interpretation). External links use `rel="noopener noreferrer nofollow"`.
- **Prompt injection:** retrieved memory text is escaped and fenced as data; the system prompt tells the model to ignore instructions inside it. It can't widen access because the model has no tools and only sees what retrieval already authorized.
- **Headers:** `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, HSTS, permissions policy.
- **Not end-to-end encrypted.** Supabase encrypts data at rest and in transit, but RLS is access control, not encryption: the database operator (and anyone with the service-role key or database password) can read stored content.
- **Third-party AI providers:** memory text is sent to the embedding provider when saved/edited, and relevant excerpts plus your question are sent to Anthropic for answers. Deleting data in NEXUS does **not** delete anything those providers retained under their own policies.
- **Account deletion** deletes the `auth.users` row; `ON DELETE CASCADE` removes the profile, projects, memories, chunks/embeddings, relationships, conversations and messages in the same transaction. NEXUS stores no files, so there is no storage bucket to clean up.

---

## Test and verification status

What was run while building this repository:

- `npm run typecheck`, `npm run lint`, `npm test` (98 tests), `npm run build` — all passing.
- `npm run test:db` against PostgreSQL 16 + pgvector 0.6 with a Supabase auth shim — RLS isolation, cross-account FK protection, anon denial, RPC ownership, index invalidation, cascade deletes and account deletion all pass.
- A browser end-to-end run (Playwright) against the production build, backed by PostgREST 12 on that database and a local auth stub: sign-in, projects, memories (create/validate/edit/delete), quick capture, search/filter/sort, connections, Recall (keyword fallback and a stubbed Claude response with citation mapping), graph, settings, JSON export, a second account unable to read the first account's data, mobile layouts without horizontal overflow, and sign-out.

**Not verified here** (no credentials were available in the build environment):

- A real Supabase project (hosted Auth emails, the hosted gateway, Supabase's pgvector 0.8 HNSW iterative scans).
- Live calls to Anthropic, Voyage AI or OpenAI. These paths are covered by unit tests with mocked responses and a stub server only.
- An actual Vercel deployment. Nothing has been deployed.

## Known limitations

- **Indexing is synchronous.** Embeddings are created inside the save request (typically well under a second). There's no background queue: if a provider is down, the memory is saved with status `failed`, stays searchable by keyword, and can be retried from the memory page or Settings (20 at a time).
- **Very long memories** (up to 50,000 characters, ≈30+ chunks) are embedded in batches of 64 within one request; extremely slow providers could hit the serverless time limit and the memory would be marked `failed` for retry.
- **The graph** shows the 300 most recently edited memories and lays them out client-side; very large archives will need server-side clustering.
- **Not-found pages stream with HTTP 200** because the page shell is flushed before data loads (a consequence of streaming with Cache Components). The content is still the not-found page and no data leaks.
- **No sharing, file uploads, or attachments** in this MVP. There are therefore no storage buckets.
- **Rate limiting** covers AI Recall only (10 questions/minute per user). Supabase Auth applies its own limits to sign-in and email endpoints.
- **No Content-Security-Policy** header yet (Next.js inline scripts would need per-request nonces).
