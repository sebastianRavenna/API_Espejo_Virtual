-- Espejo Virtual — initial schema (data model v2, docs/02-arquitectura.md)
-- Tables: tenants, frames, try_on_events. RLS on from the start (ADR-008).
-- The operator is identified by app_metadata.role = 'operator' (ADR-035).
-- anon has no table access; the Worker only calls get_catalog / log_events (ADR-036).

create extension if not exists pgcrypto with schema extensions;

-- ─── Tables ──────────────────────────────────────────────────────────────

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text unique not null default ('ev_' || encode(extensions.gen_random_bytes(16), 'hex')),
  -- hosts only, lowercase, no scheme or port: 'optica.com.ar', '*.optica.com.ar'
  allowed_domains text[] not null default '{}'
    check (array_to_string(allowed_domains, ',') !~ '[A-Z/: ]'),
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  trial_ends_at timestamptz,
  brand_color text check (brand_color ~* '^#[0-9a-f]{6}$'),      -- ADR-031
  website_url text,
  owner_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenants_owner_idx on public.tenants (owner_user_id);

create table public.frames (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('sun', 'reading')),            -- ADR-022
  eye_size_mm int check (eye_size_mm between 30 and 75),
  bridge_mm int check (bridge_mm between 10 and 30),
  temple_mm int check (temple_mm between 100 and 160),
  model_status text not null default 'pending'
    check (model_status in ('pending', 'ready', 'rejected')),
  rejection_reason text,
  glb_path text,                                   -- path inside R2, not a URL (P-03)
  thumbnail_path text,
  source_photos jsonb not null default '{}',       -- {"front": "t/<tenant>/f/<frame>/src/front.jpg", ...}
  render_params jsonb not null default '{}',       -- fix-ups for non-normalized models (unitToMm, bridge, rotationY, lensMaterials)
  ai_generated boolean not null default false,     -- P-16
  is_visible boolean not null default true,
  sort_order int not null default 0,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ADR-009: nothing is published without a model and a human review
  constraint frames_ready_requires_review
    check (model_status <> 'ready' or (glb_path is not null and reviewed_at is not null))
);
create index frames_tenant_idx on public.frames (tenant_id);
create index frames_reviewed_by_idx on public.frames (reviewed_by);

create table public.try_on_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  frame_id uuid references public.frames (id) on delete set null,
  event text not null check (event in ('open', 'view_3d', 'try', 'snapshot', 'pd')),
  session_id uuid not null,                        -- random per modal opening; not personal data
  device text check (device in ('mobile', 'desktop')),
  created_at timestamptz not null default now()
);
create index try_on_events_tenant_time_idx on public.try_on_events (tenant_id, created_at);
create index try_on_events_frame_idx on public.try_on_events (frame_id);

-- ─── updated_at ──────────────────────────────────────────────────────────

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger frames_set_updated_at before update on public.frames
  for each row execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────

create function public.is_operator() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator', false)
$$;

alter table public.tenants enable row level security;
alter table public.frames enable row level security;
alter table public.try_on_events enable row level security;

-- tenants: the optician sees its row; only the operator writes
create policy tenants_select on public.tenants for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_operator()));
create policy tenants_insert on public.tenants for insert to authenticated
  with check ((select public.is_operator()));
create policy tenants_update on public.tenants for update to authenticated
  using ((select public.is_operator())) with check ((select public.is_operator()));
create policy tenants_delete on public.tenants for delete to authenticated
  using ((select public.is_operator()));

-- frames: the optician reads its own; only the operator writes (Phase 4 opens insert)
create policy frames_select on public.frames for select to authenticated
  using ((select public.is_operator())
         or tenant_id in (select id from public.tenants where owner_user_id = (select auth.uid())));
create policy frames_insert on public.frames for insert to authenticated
  with check ((select public.is_operator()));
create policy frames_update on public.frames for update to authenticated
  using ((select public.is_operator())) with check ((select public.is_operator()));
create policy frames_delete on public.frames for delete to authenticated
  using ((select public.is_operator()));

-- try_on_events: the optician reads its own; writes only through log_events()
create policy events_select on public.try_on_events for select to authenticated
  using ((select public.is_operator())
         or tenant_id in (select id from public.tenants where owner_user_id = (select auth.uid())));

-- ─── Public functions (called by the Worker with the anon key) ───────────

-- Tenant that may serve this request: key exists, host allowed, not suspended (ADR-011, ADR-018)
create function public.resolve_tenant(p_key text, p_origin_host text) returns public.tenants
language sql stable
set search_path = ''
as $$
  select t.*
  from public.tenants t
  where t.api_key = p_key
    and t.status in ('trial', 'active')
    and exists (
      select 1 from unnest(t.allowed_domains) d
      where d = lower(p_origin_host)
         or (d like '*.%' and right(lower(p_origin_host), length(d) - 1) = substr(d, 2))
    )
$$;

create function public.get_catalog(p_key text, p_origin_host text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  t public.tenants;
begin
  t := public.resolve_tenant(p_key, p_origin_host);
  if t.id is null then
    return jsonb_build_object('frames', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'brand_color', t.brand_color,
    'frames', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id,
               'name', f.name,
               'kind', f.kind,
               'eye_size_mm', f.eye_size_mm,
               'bridge_mm', f.bridge_mm,
               'temple_mm', f.temple_mm,
               'glb_path', f.glb_path,
               'thumbnail_path', f.thumbnail_path,
               'render_params', f.render_params,
               'ai_generated', f.ai_generated
             ) order by f.sort_order, f.name)
      from public.frames f
      where f.tenant_id = t.id and f.model_status = 'ready' and f.is_visible
    ), '[]'::jsonb)
  );
end;
$$;

-- Phase 2: batch of events [{ "frame_id": uuid|null, "event": text }, ...]. Returns rows inserted.
create function public.log_events(
  p_key text, p_origin_host text, p_session_id uuid, p_device text, p_events jsonb
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tenants;
  inserted int;
begin
  if p_session_id is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 50 then
    return 0;
  end if;
  t := public.resolve_tenant(p_key, p_origin_host);
  if t.id is null then
    return 0;
  end if;

  insert into public.try_on_events (tenant_id, frame_id, event, session_id, device)
  select t.id, f.id, e ->> 'event', p_session_id,
         case when p_device in ('mobile', 'desktop') then p_device end
  from jsonb_array_elements(p_events) e
  left join public.frames f
    on f.tenant_id = t.id
   and f.id::text = e ->> 'frame_id'
  where e ->> 'event' in ('open', 'view_3d', 'try', 'snapshot', 'pd')
    and (e ->> 'frame_id' is null or f.id is not null);   -- drop frames of other tenants
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- ─── Grants (Data API auto-expose is off, ADR-034) ──────────────────────

revoke all on public.tenants, public.frames, public.try_on_events from anon, authenticated;
grant select, insert, update, delete on public.tenants, public.frames to authenticated;
grant select on public.try_on_events to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_operator() from public, anon, authenticated;
revoke all on function public.resolve_tenant(text, text) from public, anon, authenticated;
revoke all on function public.get_catalog(text, text) from public, anon, authenticated;
revoke all on function public.log_events(text, text, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.is_operator() to authenticated;
grant execute on function public.get_catalog(text, text) to anon;
grant execute on function public.log_events(text, text, uuid, text, jsonb) to anon;
