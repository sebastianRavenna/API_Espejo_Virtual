-- Local stand-in for what Supabase provides (roles anon/authenticated, auth schema).
-- Only for testing migrations on a plain Postgres; never run against Supabase.
drop database if exists espejo; create database espejo;
\c espejo
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema extensions; create schema auth;
create table auth.users (id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema public, auth, extensions to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
-- Supabase-like default: functions executable by public
