-- Smoke test of RLS, grants, get_catalog and log_events. Run on the local stub after the migrations:
--   psql -f supabase/tests/local_stub.sql
--   for f in supabase/migrations/*.sql; do psql -d espejo -v ON_ERROR_STOP=1 -f "$f"; done
--   psql -d espejo -f supabase/tests/rls_smoke.sql
-- Each block prints what it expects; the ones marked 'debe fallar' must end in ERROR.
\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-0000000000ff');
insert into public.tenants (id,name,api_key,allowed_domains,status,brand_color,owner_user_id) values
 ('10000000-0000-0000-0000-000000000001','Optica A','key_a','{optica-a.com.ar,*.optica-a.com.ar}','trial','#1a5fb4','00000000-0000-0000-0000-00000000000a'),
 ('10000000-0000-0000-0000-000000000002','Optica B','key_b','{optica-b.com}','suspended',null,'00000000-0000-0000-0000-00000000000b');
insert into public.frames (tenant_id,name,kind,model_status,glb_path,reviewed_at,sort_order) values
 ('10000000-0000-0000-0000-000000000001','Ready 2','sun','ready','a/2.glb',now(),2),
 ('10000000-0000-0000-0000-000000000001','Ready 1','reading','ready','a/1.glb',now(),1),
 ('10000000-0000-0000-0000-000000000001','Pending','sun','pending',null,null,0),
 ('10000000-0000-0000-0000-000000000002','B ready','sun','ready','b/1.glb',now(),0);
\echo '--- T1 ready sin revisión (debe fallar)'
insert into public.frames (tenant_id,name,kind,model_status,glb_path) values ('10000000-0000-0000-0000-000000000001','x','sun','ready','x.glb');
\echo '--- T2 dominio con mayúscula/esquema (debe fallar)'
update public.tenants set allowed_domains='{https://X.com}' where name='Optica A';
set role anon;
\echo '--- T3 anon: catálogo válido (2 marcos, orden 1,2)'
select jsonb_path_query_array(public.get_catalog('key_a','optica-a.com.ar'),'$.frames[*].name'), public.get_catalog('key_a','optica-a.com.ar')->>'brand_color';
\echo '--- T4 comodín www y mayúsculas (2)'
select jsonb_array_length(public.get_catalog('key_a','WWW.Optica-A.com.ar')->'frames');
\echo '--- T5 dominio ajeno / sufijo engañoso / clave mala / suspendido / null (todos 0)'
select jsonb_array_length(public.get_catalog('key_a','evil.com')->'frames'),
       jsonb_array_length(public.get_catalog('key_a','evil-optica-a.com.ar')->'frames'),
       jsonb_array_length(public.get_catalog('nope','optica-a.com.ar')->'frames'),
       jsonb_array_length(public.get_catalog('key_b','optica-b.com')->'frames'),
       jsonb_array_length(public.get_catalog('key_a',null)->'frames');
\echo '--- T6 anon lee tabla (debe fallar)'
select count(*) from public.tenants;
\echo '--- T7 anon llama resolve_tenant (debe fallar)'
select (public.resolve_tenant('key_a','optica-a.com.ar')).api_key;
\echo '--- T8 log_events: 2 válidos (open sin marco, try marco propio); descarta marco ajeno y evento inválido'
select public.log_events('key_a','optica-a.com.ar','20000000-0000-0000-0000-000000000001','mobile',
  jsonb_build_array(jsonb_build_object('event','open'),
    jsonb_build_object('event','try','frame_id',(select null)),
    jsonb_build_object('event','hack'),
    jsonb_build_object('event','try','frame_id','10000000-0000-0000-0000-0000000000ee')));
\echo '--- T9 log_events dominio malo (0)'
select public.log_events('key_a','evil.com','20000000-0000-0000-0000-000000000001','mobile','[{"event":"open"}]');
reset role;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a"}',false);
\echo '--- T10 óptica A ve solo su tenant y sus 3 marcos y sus eventos'
select (select count(*) from public.tenants), (select count(*) from public.frames), (select count(*) from public.try_on_events);
\echo '--- T11 óptica A no puede escribir (update 0 filas / insert falla)'
update public.tenants set status='active';
insert into public.frames (tenant_id,name,kind) values ('10000000-0000-0000-0000-000000000001','x','sun');
\echo '--- T12 óptica A no puede insertar eventos directo'
insert into public.try_on_events (tenant_id,event,session_id) values ('10000000-0000-0000-0000-000000000001','open',gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000ff","app_metadata":{"role":"operator"}}',false);
\echo '--- T13 operador ve todo (2 tenants, 4 marcos) y escribe'
select (select count(*) from public.tenants), (select count(*) from public.frames);
insert into public.frames (tenant_id,name,kind) values ('10000000-0000-0000-0000-000000000002','op','reading') returning name;
update public.tenants set status='active' where name='Optica B' returning status, updated_at > created_at as updated;
\echo '--- T14 api_key generada'
insert into public.tenants (name) values ('C') returning api_key ~ '^ev_[0-9a-f]{32}$';
