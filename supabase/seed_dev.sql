-- Development tenant with the six spike frames (widget/src/engine/frames.ts).
-- Paste in the SQL Editor once, after the migrations. Not for production.
-- GLB paths are relative to the R2 bucket; upload widget/public/models-dev/*.glb under dev/models/.
-- Add your LAN IP to allowed_domains to test from the phone (e.g. '192.168.100.4').

with t as (
  insert into public.tenants (name, allowed_domains, status, brand_color, website_url)
  values ('Dev · Óptica de prueba', '{localhost,127.0.0.1}', 'active', '#1a5fb4', 'https://localhost:3000')
  returning id, api_key
), f as (
  insert into public.frames (tenant_id, name, kind, model_status, glb_path, render_params, ai_generated, sort_order, reviewed_at)
  select t.id, v.name, v.kind, 'ready', 'dev/models/' || v.file, v.params::jsonb, v.ai, v.ord, now()
  from t, (values
    ('Sol',          'sun',     'sun_glasses.glb', '{"unitToMm": 10, "bridge": [6.91, 0.87, 0.52], "rotationY": -1.5707963267948966}', false, 1),
    ('Acetato',      'reading', 'acetate.glb',     '{"unitToMm": 100, "bridge": [0, 0.121, 0.070], "rotationY": 0, "lensMaterials": ["Frame.1"]}', false, 2),
    ('Metal',        'sun',     'metal.glb',       '{"unitToMm": 7.564296520423600, "bridge": [0, 184.45, 16.18], "rotationY": 0}', false, 3),
    ('IA · Acetato', 'reading', 'hy-acetate.glb',  '{}', true, 4),
    ('IA · Metal',   'reading', 'hy-metal.glb',    '{}', true, 5),
    ('IA · Sol',     'sun',     'hy-sun.glb',      '{}', true, 6)
  ) as v(name, kind, file, params, ai, ord)
  returning 1
)
select (select api_key from t) as dev_api_key, (select count(*) from f) as frames_created;
