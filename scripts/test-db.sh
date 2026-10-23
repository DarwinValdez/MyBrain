#!/usr/bin/env bash
# Applies the migrations to a throwaway database and runs the RLS / ownership
# tests. Requires a plain PostgreSQL server with the pgvector extension.
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# The script creates and drops a database called nexus_rls_test on that server.
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to an admin connection string for a disposable Postgres server}"
DB=nexus_rls_test
cd "$(dirname "$0")/.."

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
TARGET=$(node -e 'const u=new URL(process.argv[1]); u.pathname="/'"$DB"'"; console.log(u.toString())' "$TEST_DATABASE_URL")

psql "$TARGET" -v ON_ERROR_STOP=1 -q -f supabase/tests/local-shim.sql
for f in supabase/migrations/*.sql; do
  psql "$TARGET" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$TARGET" -v ON_ERROR_STOP=1 -q -t -o /dev/null -f supabase/tests/rls.test.sql

psql "$TEST_DATABASE_URL" -q -c "drop database if exists $DB"
