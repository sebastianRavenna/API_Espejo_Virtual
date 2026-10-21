# 02 — Arquitectura

## Principio rector

Todo el procesamiento de video (cámara, tracking, oclusor, render 3D y estimación de DP) ocurre en el navegador del cliente final. El servidor solo sirve JSON y archivos estáticos. Por eso casi todo entra en capas gratuitas.

## Las tres capas

```
┌─────────────────────────── 1. Sitio de la óptica ───────────────────────────┐
│ <script src="https://cdn.<dominio>/widget.js" data-key="...">                │
│ Shadow DOM · cámara · MediaPipe FaceLandmarker · oclusor · Three.js          │
│ <model-viewer> (visor 360) · DP con iris  →  nada de imagen sale de acá      │
└───────────────┬──────────────────────────────────────────┬─────────────────┘
                │ GET catálogo (JSON)                       │ GET GLB / texturas
┌───────────────▼──────────── 2. Plataforma ───────┐  ┌─────▼──── 3. CDN / storage ───┐
│ Cloudflare Worker: valida clave + dominio +      │  │ Cloudflare R2 (dominio propio) │
│ estado, devuelve catálogo cacheado               │  │ GLB, texturas, miniaturas,     │
│ Supabase: Postgres + Auth + RLS                  │  │ fotos fuente de los marcos     │
│ Panel de ópticas (habla directo con Postgres)    │  │ En Postgres solo va la URL     │
│ Pipeline de digitalización (manual al inicio)    │  └────────────────────────────────┘
└──────────────────────────────────────────────────┘
```

1. **Sitio de la óptica.** El widget se carga con `<script src="https://cdn.<dominio>/widget.js" data-key="...">`. El dominio es `TBD` (P-03); el plan usa el placeholder `cdn.tuproducto.com`. El widget usa Shadow DOM para aislar estilos y corre cámara, tracking, oclusor y render. Nunca sube video ni imágenes de la cara.
2. **Plataforma.** Un endpoint público (Worker) valida la clave, el dominio permitido y el estado del tenant, y devuelve el catálogo cacheado. El panel de administración usa Supabase Auth y habla directo con Postgres bajo RLS. El pipeline de digitalización es manual al inicio.
3. **CDN / storage.** Los GLB viven en R2 y el widget los descarga directo. En Postgres solo se guarda la URL.

## Stack y costos

| Capa | Herramienta | Costo |
|---|---|---|
| Tracking facial e iris | MediaPipe Tasks Vision (FaceLandmarker) | 0 |
| Render 3D | Three.js (espejo) y `<model-viewer>` (visor 360). El widget usa three 0.113 (2020), la del repo original; actualizarlo es P-17 | 0 |
| Widget y panel (estáticos) | Cloudflare Pages (ADR-021) | 0 (estáticos ilimitados, 500 builds/mes) |
| Endpoint público del widget | Cloudflare Workers | 0 (100k req/día) |
| Base de datos y auth | Supabase: en desarrollo, organización gratuita; en producción, la paga (ADR-034) | 0 en desarrollo; USD 10/mes desde el piloto |
| Assets 3D (GLB y texturas) | Cloudflare R2 con dominio propio | 0 (10 GB, egreso sin cargo) |
| Generación 3D | Hunyuan3D (open source) en Colab/Kaggle, o Tripo/Hunyuan por API (`TBD`, P-02) | 0 al inicio; centavos por marco después, trasladados al cliente |
| Post-proceso 3D | Blender headless (script Python), local | 0 |
| Build del widget | Vite + TypeScript, sin React (empaqueta un solo `widget.js`, ADR-028) | 0 |
| Cobros | Transferencia; luego MercadoPago suscripciones | Solo comisión por transacción |

Costo fijo de arranque: **USD 10/mes**. Los límites de cada plan cambian; hay que verificarlos al arrancar (ver `06-mantenimiento.md`).

## Lo que hace que se vea natural y no un sticker

- **Oclusor:** una malla invisible de la cara que solo escribe profundidad. Así las patillas se esconden detrás de la cabeza cuando la persona gira. El óvalo de la cara solo no alcanza: al mirar abajo y a un costado, la patilla de atrás asoma por encima de la frente. Por eso se suma un elipsoide con forma de cabeza, pegado al anteojo y en mm, más angosto que las patillas para no tapar la patilla del lado de la cámara (visto en el spike, 2026-10-18).
- **Escala en milímetros reales:** se usan las medidas grabadas en la patilla, calibre-puente-patilla (por ejemplo, 52-18-140).
- **Origen en el puente**, con los ejes alineados: X hacia la sien, Y hacia arriba, Z hacia adelante.
- **Lentes como dos superficies propias** con material vidrio (transparente para lectura, tintado para sol), curvas como una lente real (curva base 6, ADR-033). No se usa la geometría de lentes que genera la IA.
- **HTTPS obligatorio:** sin HTTPS el navegador no da acceso a la cámara.
- **El video de la cámara no pasa por el tone mapping:** el tone mapping (ACES) es para el modelo 3D. Aplicado al video, la cara sale lavada y el anteojo parece pegado encima (visto en el spike, 2026-10-18). Además, la textura del video se declara sRGB: si no, la salida sRGB del renderer la aclara dos veces y queda pálida.
- **Patillas que se desvanecen hacia atrás:** el seguimiento no ve orejas ni pelo, así que la patilla se difumina entre 45 y 75 mm detrás del puente para no dibujarse encima de ellos.
- **Lentes de vidrio con Fresnel (ADR-033):** casi sin reflejo de frente y más fuerte en los bordes y ángulos rasantes, así se mueve al girar la cabeza; marcado en sol y sutil en lectura para no tapar los ojos. El entorno reflejado es el panorama 360° "Lebombo" (CC0, 1,48 MB), servido desde R2 en producción.
- **Reflejo de la pantalla:** el entorno de reflejos simula la pantalla delante de la cara, como hacen otros probadores; sin él, metales y lentes se ven apagados.
- **El video y el anteojo se dibujan juntos:** cada cuadro se dibuja recién cuando MediaPipe terminó de procesarlo, con el anteojo ya ubicado. Si el video se dibuja apenas llega y el anteojo después, el anteojo va a destiempo al girar (visto en el spike).
- **La regla de escala es el iris:** el mismo diámetro de 11,7 mm que usa la DP convierte milímetros del modelo a píxeles de pantalla (ADR-025).

## Estimación de DP

- Se calcula con los landmarks del iris de MediaPipe FaceLandmarker. El diámetro del iris humano (**11,7 mm**) sirve de regla para pasar de píxeles a milímetros.
- Se toma la **mediana de varios frames** para reducir el ruido.
- Precisión típica: **1–2 mm según el plan; no validada.** El iris adulto varía entre ~11 y ~12,5 mm, lo que por sí solo da ±2–3 mm, y en la primera prueba la app y Auglio difirieron 6 mm (ver ADR-027).
- Siempre se presenta como "DP estimada", con un aviso de que no reemplaza la medición del óptico.
- Frames, duración y condiciones: definidos en ADR-027 (45 cuadros válidos de frente, iris ≥ 20 px con la cámara a 1280×720, dispersión ≤ 2 mm, hasta 10 s).
- Se muestra la **DP de lejos**: la medición se hace mirando la cámara (los ojos convergen) y se corrige con la distancia estimada (ADR-027). Mostrar también la DP de cerca queda para la Fase 5.

## Licenciamiento

Clave por tenant + dominios permitidos + estado de suscripción.

- `tenants.api_key`: va pública en el snippet (`data-key`).
- `tenants.allowed_domains`: el Worker compara el header `Origin` del pedido contra esta lista.
- `tenants.status`: `trial | active | suspended`. Con `trial` o `active` se sirve el catálogo; con `suspended` el catálogo vuelve **vacío** (ADR-018).
- Sin catálogo, el widget no muestra marcos. No hace falta más protección: el valor está en los modelos y el servicio, no en el código del widget.

**Nota de seguridad (para tener en cuenta, no bloquea):** la clave es visible en el HTML y el header `Origin` se puede falsificar desde fuera de un navegador. Alguien podría leer el catálogo de una óptica, que es información pública de todos modos (lo ve cualquiera que visite su sitio). Lo que sí se protege con la validación de dominio es que otro sitio embeba el widget con una clave ajena y la óptica pague ese uso. Con eso alcanza para el modelo actual.

## Esquema de datos (piloto)

Solo lo necesario para el piloto. Pagos, cupos y roles se agregan cuando exista la primera factura.

```sql
-- Ópticas (tenants)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text unique not null,
  allowed_domains text[] not null default '{}',
  status text not null default 'trial', -- trial | active | suspended
  brand_color text,                     -- hex del color de marca para el widget (ADR-031)
  owner_user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Marcos
create table frames (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  kind text not null,               -- sun | reading  (ADR-022; el plan decía sol | lectura)
  eye_size_mm int, bridge_mm int, temple_mm int,
  model_status text not null default 'pending', -- pending | ready | rejected
  glb_url text,
  thumbnail_url text,
  source_photos jsonb,              -- URLs en R2
  created_at timestamptz default now()
);

-- Eventos de prueba (métricas)
create table try_on_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  frame_id uuid references frames(id) on delete set null,
  event text not null,              -- open | try | snapshot | pd
  created_at timestamptz default now()
);
```

Esto es el esquema tal como está en el plan. Los cambios propuestos se discuten en `07-decisiones.md` y no están aplicados:

- `check` constraints sobre `status`, `kind`, `model_status` y `event`.

### Políticas RLS

Reglas del plan:

- La óptica **lee** sus `tenants`, `frames` y `try_on_events` filtrando por `tenant_id` (vía `owner_user_id = auth.uid()`).
- Al inicio, **solo el operador escribe** en `frames`. En la Fase 4 se habilita la escritura a la óptica con un cambio de política, no de esquema.
- El endpoint público no lee las tablas directamente: usa la `api_key` y una vista o función que solo expone marcos `ready` de tenants en `trial` o `active`.

Borrador en SQL. El operador se identifica con el claim `app_metadata.role = 'operator'` en el JWT de Supabase Auth (ADR-035).

```sql
alter table tenants enable row level security;
alter table frames enable row level security;
alter table try_on_events enable row level security;

-- helper: ¿el usuario actual es el operador?  (ADR-035)
create or replace function is_operator() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator', false)
$$;

-- tenants: la óptica ve su fila; el operador ve y edita todo
create policy tenants_owner_select on tenants for select
  using (owner_user_id = auth.uid() or is_operator());
create policy tenants_operator_all on tenants for all
  using (is_operator()) with check (is_operator());

-- frames: la óptica lee los suyos; solo el operador escribe (Fase 4: se abre insert a la óptica)
create policy frames_owner_select on frames for select
  using (is_operator() or tenant_id in (select id from tenants where owner_user_id = auth.uid()));
create policy frames_operator_write on frames for all
  using (is_operator()) with check (is_operator());

-- try_on_events: la óptica lee los suyos; la escritura la hace log_events() (ADR-036)
create policy events_owner_select on try_on_events for select
  using (is_operator() or tenant_id in (select id from tenants where owner_user_id = auth.uid()));
```

`TBD`: hoy la óptica no puede editar su propia fila en `tenants` (por ejemplo, sus dominios). Pregunta: ¿en la Fase 3 la óptica gestiona sus `allowed_domains` desde el panel? El plan lo lista en el panel completo; si es así, hace falta una política de `update` limitada a esa columna.

### Lectura pública del catálogo

Una función `security definer`, sin acceso directo de `anon` a las tablas (ADR-036). El detalle está en "Modelo de datos v2" más abajo.

## Modelo de datos v2 (aprobado el 2026-10-21, ADR-037)

**Estado:** aprobado por Sebastian; reemplaza al esquema del plan de arriba. Implementado en `supabase/migrations/20261021000000_initial_schema.sql` y probado en un Postgres local (`supabase/tests/rls_smoke.sql`). Aplicarlo en el proyecto de Supabase está pendiente (ver ADR-037).

**Criterio:** se piensa en papel la base de todas las fases, para no encerrarse, pero la primera migración crea solo lo que necesita el piloto (ADR-012). Lo de la Fase 3 queda esbozado y se migra cuando haga falta.

### Cambios respecto del esquema del plan, y por qué

| Cambio | Por qué |
|---|---|
| `glb_url` y `thumbnail_url` pasan a ser `glb_path` y `thumbnail_path` (ruta dentro de R2, por ejemplo `t/<tenant_id>/f/<frame_id>/v1/model.glb`) | El dominio todavía no está (P-03): hoy es la URL de desarrollo de R2 y mañana un subdominio. Con rutas, el Worker arma la URL con `ASSETS_BASE_URL` y cambiar de dominio no toca la base. La versión en la ruta permite que el navegador guarde el GLB en caché para siempre: un modelo corregido es una ruta nueva. |
| `source_photos` guarda rutas, no URLs | Mismo motivo. |
| `check` en `status`, `kind`, `model_status` y `event`, y rangos para las medidas | Ya estaba propuesto. Un valor mal escrito rompe el catálogo sin avisar. |
| `frames.rejection_reason` | `03-diseno-visual.md` preguntaba si la óptica ve por qué se rechazó un marco; sin esto no hay dónde guardarlo. |
| `frames.reviewed_at` y `reviewed_by` | Deja registro de la revisión humana (ADR-009). Un marco no puede quedar `ready` sin GLB ni sin revisión (`check`). |
| `frames.ai_generated` | Para la leyenda "modelo 3D generado con IA" que pide la licencia de Hunyuan3D (P-16). |
| `frames.is_visible` y `sort_order` | La óptica (o el operador) oculta un marco sin stock sin borrarlo, y ordena el selector. |
| `frames.render_params jsonb` | Correcciones de los modelos que no vienen normalizados (unidad, puente, rotación, materiales de lente: hoy son `unitToMm`, `bridge`, `rotationY` y `lensMaterials` en `widget/src/engine/frames.ts`). Los que pasan por Blender vienen normalizados (ADR-015) y lo dejan vacío. Sirve para cargar en la base los seis marcos de prueba sin rehacerlos. |
| `tenants.trial_ends_at` | ADR-018 deja abierto cuánto dura el trial; con la fecha en la base, vencerlo deja de depender de la memoria del operador (igual se cambia a mano, ADR-013). |
| `tenants.website_url` | El operador sabe dónde está embebido el widget; ayuda en el diagnóstico (`06-mantenimiento.md`). |
| `tenants.api_key` con valor por defecto generado en la base (`ev_` + 32 caracteres hex) | Nadie inventa claves a mano; rotar es un `update`. |
| `allowed_domains` guarda nombres de host en minúscula, sin esquema ni puerto; `*.ejemplo.com` cubre subdominios | Regla clara para comparar contra `Origin`. `www.` no se agrega solo: se carga explícito o con comodín. |
| `try_on_events.session_id` (uuid al azar por apertura del modal) y `device` (`mobile` / `desktop`) | Permite contar sesiones únicas, que es como cobran los competidores (usuarios únicos por mes), sin guardar datos personales: el uuid no se guarda en el dispositivo y no hay IP ni user agent. |
| `try_on_events.event` suma `view_3d` | El visor 360 ("Ver en 3D", brief §3.4) también es uso medible. |
| `created_at` / `updated_at` con trigger | Para el panel y el diagnóstico. |

### Fase 1 (primera migración)

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text unique not null default ('ev_' || encode(gen_random_bytes(16), 'hex')),
  allowed_domains text[] not null default '{}',   -- hosts: 'optica.com.ar', '*.optica.com.ar'
  status text not null default 'trial' check (status in ('trial','active','suspended')),
  trial_ends_at timestamptz,
  brand_color text check (brand_color ~* '^#[0-9a-f]{6}$'),   -- ADR-031
  website_url text,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table frames (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('sun','reading')),       -- ADR-022
  eye_size_mm int check (eye_size_mm between 30 and 75),
  bridge_mm int check (bridge_mm between 10 and 30),
  temple_mm int check (temple_mm between 100 and 160),
  model_status text not null default 'pending'
    check (model_status in ('pending','ready','rejected')),
  rejection_reason text,
  glb_path text,
  thumbnail_path text,
  source_photos jsonb not null default '{}',   -- {"front": "t/…/src/front.jpg", …}
  render_params jsonb not null default '{}',   -- fix-ups de modelos no normalizados
  ai_generated boolean not null default false, -- P-16
  is_visible boolean not null default true,
  sort_order int not null default 0,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (model_status <> 'ready' or (glb_path is not null and reviewed_at is not null))  -- ADR-009
);
create index frames_tenant_idx on frames (tenant_id);

create table try_on_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  frame_id uuid references frames(id) on delete set null,
  event text not null check (event in ('open','view_3d','try','snapshot','pd')),
  session_id uuid not null,
  device text check (device in ('mobile','desktop')),
  created_at timestamptz not null default now()
);
create index try_on_events_tenant_time_idx on try_on_events (tenant_id, created_at);
```

**Permisos** (con "Automatically expose new tables" desactivado, ADR-034):

- `anon`: nada sobre las tablas; solo `execute` sobre `get_catalog` y `log_events`. Se revoca `execute` a `public` en todas las funciones.
- `authenticated`: `select` sobre las tres tablas, filtrado por RLS (las políticas de arriba), e `insert/update/delete` sobre `tenants` y `frames`, que RLS solo deja pasar al operador (ADR-035).
- RLS activado en las tres tablas desde la primera migración (ADR-008).

**Funciones:**

| Función | Quién la llama | Qué hace |
|---|---|---|
| `is_operator()` | RLS | `app_metadata.role = 'operator'` (ADR-035). |
| `get_catalog(p_key text, p_origin_host text) returns jsonb` | Worker, con `anon` | Si la clave existe, el host está en `allowed_domains` (exacto o comodín) y el estado es `trial` o `active`: `{ brand_color, frames: [...] }` con los marcos `ready` y visibles, ordenados por `sort_order`. Si no: `{ frames: [] }`. **No devuelve la lista de dominios**: la comparación se hace adentro. |
| `resolve_tenant(p_key text, p_origin_host text)` | Solo las dos funciones de abajo (sin `execute` para `anon`) | Devuelve el tenant si la clave existe, el host está permitido (exacto, o `*.dominio` para subdominios; sin distinguir mayúsculas) y no está suspendido. |
| `log_events(p_key text, p_origin_host text, p_session_id uuid, p_device text, p_events jsonb) returns int` | Worker, con `anon` (Fase 2) | Mismas validaciones; inserta el lote (tope de 50 eventos por llamada), descarta los eventos con nombre inválido o con `frame_id` de otro tenant y devuelve cuántos guardó. |
| `set_updated_at()` | Trigger | Actualiza `updated_at`. |

Cada marco de `get_catalog` trae `id, name, kind, eye_size_mm, bridge_mm, temple_mm, glb_path, thumbnail_path, render_params, ai_generated`. El Worker convierte las rutas en URLs.

### Fase 2 (piloto)

Sin tablas nuevas. Se activa `log_events`; el formulario de entrega crea el `frame` en `pending` con sus `source_photos` (la subida a R2 es P-10).

### Fase 3 (esbozo, no se migra ahora)

- `tenant_members (tenant_id, user_id, role)`: más de un usuario por óptica. Reemplaza a `owner_user_id`; las políticas pasan a mirar esta tabla.
- `charges (tenant_id, concept: subscription | digitization, frame_id, amount_ars, period, paid_at, method: transfer | mercadopago)`: el abono y los cargos por marco (ADR-002, ADR-013). Precios y escalones por cantidad de marcos siguen `TBD`.
- `frame_variants`: variantes de color (backlog).
- `frames.product_url` o vínculo con WooCommerce (backlog).
- Agregados de métricas (vista o tabla diaria) si `try_on_events` crece demasiado.

## Endpoints del Worker público

| Método y ruta | Estado | Qué hace |
|---|---|---|
| `GET /v1/catalog?key=<api_key>` | Definido en el plan | Valida que la clave exista, que `Origin` esté en `allowed_domains` y que `status` sea `trial` o `active`. Devuelve `{ brand_color, frames: [{ id, name, kind, eye_size_mm, bridge_mm, temple_mm, glb_url, thumbnail_url, render_params, ai_generated }] }` (las URLs las arma el Worker desde las rutas de R2). Con clave inválida, dominio no permitido o tenant suspendido devuelve `{ frames: [] }`. Respuesta cacheada; el TTL es `TBD`. |
| `POST /v1/events` | Definido (ADR-036), se hace en la Fase 2 | Recibe `{ key, session_id, device, events: [{ frame_id, event }] }` (lote) y llama a `log_events`. |
| Subida de fotos del formulario a R2 | **Pendiente (P-10)** | El plan dice que el formulario "guarda en R2", pero no dice por dónde pasa la subida. |

CORS: el Worker responde `Access-Control-Allow-Origin` con el origen validado, no con `*`. Si el catálogo vuelve vacío, ¿se devuelve `200` con lista vacía o un código distinto que permita al widget mostrar un mensaje claro? `TBD` (ver estados en `03-diseno-visual.md`).

## Pipeline de digitalización

### Protocolo de fotos (para la guía visual del formulario)

- Fondo blanco, luz pareja sin sombras duras.
- El marco apoyado en su posición natural.
- Cuatro tomas: **frente**, **perfil izquierdo**, **arriba** y **tres cuartos**. El perfil derecho es espejo del izquierdo en casi todos los marcos.
- Las tres medidas de la patilla: calibre, puente y largo de patilla.

### Paso a paso

1. La óptica carga el formulario (nombre, tipo, 3 medidas, 4 fotos). Las fotos van a R2 y se crea el `frame` en `pending`.
2. Generación 3D: Hunyuan3D multi-vista en Colab o Kaggle, a mano (o Tripo/Hunyuan por API, P-02).
3. Post-proceso con un script de Blender headless, local:
   1. Importar la geometría generada por la IA.
   2. Eliminar lo que la IA haya generado en la zona de lentes y reemplazarlo por dos superficies curvas (curva base 6, ADR-033) con material vidrio según el tipo (lectura o sol).
   3. Escalar a milímetros reales con calibre, puente y largo de patilla.
   4. Centrar el origen en el puente y alinear ejes (X sien, Y arriba, Z adelante).
   5. Exportar GLB comprimido (Draco o meshopt) con texturas KTX2 o WebP. Cuál de cada uno es `TBD` (P-07).
   6. Generar una miniatura para el panel.
4. Subir el GLB y la miniatura a R2, y cargar `glb_url` y `thumbnail_url`.
5. **Revisión humana:** se prueba en el espejo y se marca `ready` o `rejected`. Nada se publica sin este paso.
6. Respaldo si la IA no alcanza (típico en metálicos finos y transparentes): plantilla paramétrica texturizada con la foto frontal.

Al principio es una tarde de trabajo por óptica del piloto. En la Fase 4, según el plan, un "worker" orquesta los pasos 2 a 4 y deja el modelo en la cola de revisión.

**Ojo con la palabra "Worker":** un Cloudflare Worker no puede correr Blender. Blender headless necesita una máquina con Python y el binario de Blender, y eso no está en el stack. Puede ser tu PC procesando una cola o algún servicio de cómputo, que tendría costo. Queda como pendiente P-11. No bloquea nada hasta la Fase 4.
