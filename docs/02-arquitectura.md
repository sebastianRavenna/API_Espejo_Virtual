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
| Base de datos y auth | Supabase, proyecto nuevo en la organización paga | USD 10/mes |
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
- **Lentes como dos superficies planas** con material vidrio (transparente para lectura, tintado para sol). No se usa la geometría de lentes que genera la IA.
- **HTTPS obligatorio:** sin HTTPS el navegador no da acceso a la cámara.
- **El video de la cámara no pasa por el tone mapping:** el tone mapping (ACES) es para el modelo 3D. Aplicado al video, la cara sale lavada y el anteojo parece pegado encima (visto en el spike, 2026-10-18). Además, la textura del video se declara sRGB: si no, la salida sRGB del renderer la aclara dos veces y queda pálida.
- **Patillas que se desvanecen hacia atrás:** el seguimiento no ve orejas ni pelo, así que la patilla se difumina entre 45 y 75 mm detrás del puente para no dibujarse encima de ellos.
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

Borrador en SQL. **Cómo se identifica al operador está `TBD` (P-08).** Hasta resolverlo, el borrador usa un claim `app_metadata.role = 'operator'` en el JWT de Supabase Auth.

```sql
alter table tenants enable row level security;
alter table frames enable row level security;
alter table try_on_events enable row level security;

-- helper: ¿el usuario actual es el operador?  (P-08)
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

-- try_on_events: la óptica lee los suyos; la escritura la hace el Worker (P-04)
create policy events_owner_select on try_on_events for select
  using (is_operator() or tenant_id in (select id from tenants where owner_user_id = auth.uid()));
```

`TBD`: hoy la óptica no puede editar su propia fila en `tenants` (por ejemplo, sus dominios). Pregunta: ¿en la Fase 3 la óptica gestiona sus `allowed_domains` desde el panel? El plan lo lista en el panel completo; si es así, hace falta una política de `update` limitada a esa columna.

### Lectura pública del catálogo

Una función `security definer` (propuesta), sin acceso directo de `anon` a las tablas:

```sql
-- propuesta: el Worker llama get_catalog(api_key) y valida el Origin contra allowed_domains
-- devuelve: allowed_domains + marcos ready de un tenant trial/active; vacío si no aplica
```

`TBD` (P-04): con qué credencial llama el Worker a Supabase (service role guardada como secreto del Worker, o rol `anon` que solo puede ejecutar la función).

## Endpoints del Worker público

| Método y ruta | Estado | Qué hace |
|---|---|---|
| `GET /v1/catalog?key=<api_key>` | Definido en el plan | Valida que la clave exista, que `Origin` esté en `allowed_domains` y que `status` sea `trial` o `active`. Devuelve `{ frames: [{ id, name, kind, eye_size_mm, bridge_mm, temple_mm, glb_url, thumbnail_url }] }`. Con clave inválida, dominio no permitido o tenant suspendido devuelve `{ frames: [] }`. Respuesta cacheada; el TTL es `TBD`. |
| `POST /v1/events` | **Pendiente (P-04)** | Recibe `{ key, frame_id, event }` y lo inserta en `try_on_events`. El plan prevé la tabla, pero no dice cómo escribe en ella un widget anónimo. |
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
   2. Eliminar lo que la IA haya generado en la zona de lentes y reemplazarlo por dos superficies planas con material vidrio según el tipo (lectura o sol).
   3. Escalar a milímetros reales con calibre, puente y largo de patilla.
   4. Centrar el origen en el puente y alinear ejes (X sien, Y arriba, Z adelante).
   5. Exportar GLB comprimido (Draco o meshopt) con texturas KTX2 o WebP. Cuál de cada uno es `TBD` (P-07).
   6. Generar una miniatura para el panel.
4. Subir el GLB y la miniatura a R2, y cargar `glb_url` y `thumbnail_url`.
5. **Revisión humana:** se prueba en el espejo y se marca `ready` o `rejected`. Nada se publica sin este paso.
6. Respaldo si la IA no alcanza (típico en metálicos finos y transparentes): plantilla paramétrica texturizada con la foto frontal.

Al principio es una tarde de trabajo por óptica del piloto. En la Fase 4, según el plan, un "worker" orquesta los pasos 2 a 4 y deja el modelo en la cola de revisión.

**Ojo con la palabra "Worker":** un Cloudflare Worker no puede correr Blender. Blender headless necesita una máquina con Python y el binario de Blender, y eso no está en el stack. Puede ser tu PC procesando una cola o algún servicio de cómputo, que tendría costo. Queda como pendiente P-11. No bloquea nada hasta la Fase 4.
