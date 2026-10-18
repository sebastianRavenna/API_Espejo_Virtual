# Espejo virtual para ópticas — Plan completo

## 1. Qué es

Un widget embebible (un `<script>`) que la óptica pega en su sitio, sin importar la tecnología, y que le permite a sus clientes:

- Probarse anteojos de sol y de lectura en vivo con la cámara (espejo virtual).
- Ver cada marco en 3D, rotándolo, sin necesidad de prender la cámara (visor 360).
- Obtener una estimación de su distancia pupilar (DP).

Vos vendés el widget como servicio (SaaS) y digitalizás los marcos de cada óptica en 3D.

## 2. Modelo de negocio

Dos líneas de ingreso, separadas y explícitas en la oferta:

| Concepto | Tipo | Qué cubre |
|---|---|---|
| Abono mensual | Recurrente | Uso del espejo, visor 360, DP, métricas, hosting |
| Digitalización por marco | Único, por unidad | Generación 3D, post-proceso, revisión de calidad |

Reglas:

- El alta incluye 3 a 5 marcos digitalizados sin cargo, para que la óptica vea el espejo con sus propios anteojos antes de decidir.
- La óptica garantiza tener derechos sobre las fotos que entrega (queda en los términos de servicio). Vos sos procesador, no dueño del catálogo.
- Al principio se cobra por transferencia y se activa a mano. Cobro automático recién con más de cinco clientes.
- Si la óptica deja de pagar, la API devuelve catálogo vacío y el espejo no muestra marcos. No hace falta más protección.

Argumento comercial principal: las métricas ("el modelo X lo probaron 300 personas este mes") y el hecho de que el servicio sea local, en español, con WordPress/WooCommerce y MercadoPago.

## 3. Stack y costos

Principio de diseño: todo el procesamiento de video ocurre en el navegador del cliente final. Tu servidor solo sirve JSON y archivos estáticos. Por eso casi todo entra en capas gratuitas.

| Capa | Herramienta | Costo |
|---|---|---|
| Tracking facial e iris | MediaPipe Tasks Vision (FaceLandmarker) | 0 |
| Render 3D | Three.js (espejo) y `<model-viewer>` (visor 360) | 0 |
| Widget y panel (estáticos) | Cloudflare Pages o Vercel | 0 |
| Endpoint público del widget | Cloudflare Workers | 0 (100k req/día) |
| Base de datos y auth | Supabase, proyecto nuevo en tu organización paga | USD 10/mes |
| Assets 3D (GLB y texturas) | Cloudflare R2 con dominio propio | 0 (10 GB, egreso sin cargo) |
| Generación 3D | Hunyuan3D (open source) en Colab/Kaggle, o Tripo/Hunyuan por API | 0 al inicio; centavos por marco después, trasladado al cliente |
| Post-proceso 3D | Blender headless (script Python), local | 0 |
| Cobros | Transferencia; luego MercadoPago suscripciones | Solo comisión por transacción |

Costo fijo de arranque: USD 10/mes. Verificar los límites de cada plan al momento de arrancar, porque cambian.

## 4. Arquitectura

Tres capas:

1. **Sitio de la óptica.** El widget JS, cargado con `<script src="https://cdn.tuproducto.com/widget.js" data-key="...">`. Usa Shadow DOM para aislar estilos. Corre cámara, tracking, oclusor facial y render 3D en el navegador. Nunca sube video ni imágenes de la cara a ningún servidor.
2. **Tu plataforma.** Endpoint público (Worker) que valida clave + dominio permitido + suscripción activa y devuelve el catálogo, cacheado. Panel de administración para ópticas (Supabase Auth, habla directo con Postgres bajo RLS). Pipeline de digitalización (al inicio, manual).
3. **CDN / storage.** Los GLB viven en R2. El widget los descarga directo. En Postgres solo se guarda la URL.

Detalles técnicos que hacen la diferencia entre "sticker" y "natural":

- Oclusor: malla invisible de la cara que solo escribe profundidad, para que las patillas se escondan detrás de la cabeza al girar.
- Modelos escalados en milímetros reales usando las medidas grabadas en la patilla (calibre-puente-patilla, por ejemplo 52-18-140), con el origen en el puente.
- Lentes como dos superficies planas con material vidrio (transparente para lectura, tintado para sol), no la geometría que genere la IA.
- HTTPS obligatorio: sin HTTPS no hay acceso a cámara.

DP: se estima con los landmarks del iris, usando el diámetro del iris (11,7 mm) como regla, tomando la mediana de varios frames. Precisión típica 1–2 mm. Se presenta como "DP estimada" con aviso; no reemplaza la medición del óptico.

## 5. Fases

### Fase 0 — Spike técnico (1 a 2 semanas)

Objetivo: demostrar que funciona y tener algo para mostrar. Sin backend.

- Clonar `alperenuzun/basic-virtual-tryon-glasses` (TypeScript, MediaPipe, Three.js, con oclusor).
- Reemplazar el modelo procedural por 3 GLB genéricos (Sketchfab CC o CGTrader): uno de acetato grueso, uno metálico fino, uno de sol.
- Agregar la estimación de DP con landmarks de iris.
- Probar Hunyuan3D multi-vista con fotos reales de 3 marcos y evaluar el resultado. Si el metálico fino sale mal, anotar: ahí entran las plantillas paramétricas como respaldo.
- Empaquetar como un solo `widget.js` con Vite y probarlo embebido en una página WordPress y en una HTML pelada.

Criterio de salida: un video de 30 segundos que le mostrarías a una óptica sin vergüenza.

### Fase 1 — Flujos y esquema mínimo (2 a 3 días)

- Escribir en texto plano qué hace cada persona (óptica: se registra, ve sus marcos, copia el snippet, mira métricas; vos: cargás marcos, aprobás modelos, activás cuentas).
- Crear el proyecto Supabase y las tablas mínimas (ver sección 7) con RLS desde el principio: la óptica es dueña de sus registros; al inicio solo tu usuario tiene permiso de escritura en `frames`.
- Conectar el widget del spike al endpoint de catálogo.

### Fase 2 — Piloto con una óptica (1 mes)

- Elegir una óptica y digitalizar 10 a 20 marcos suyos. La digitalización la hacés vos (servicio manual); ellos entregan fotos y medidas.
- Formulario mínimo de entrega (nombre, tipo, tres medidas, cuatro fotos) que guarde en R2. Evita recibir fotos por WhatsApp.
- Panel mínimo: login, lista de marcos con estado (pendiente / listo / rechazado), snippet para copiar.
- Embeber el widget en el sitio real de la óptica.
- Medir: cuántos clientes lo abren, cuántos marcos prueban, qué dice la óptica.

Criterio de salida: la óptica dice que pagaría, y sabés cuánto.

### Fase 3 — Producto vendible (2 a 3 meses)

- Panel completo diseñado con Claude Design (recién ahora, con las tablas cerradas): alta de cuenta, marcos, métricas por marco, dominios permitidos, snippet, facturación.
- Licenciamiento: clave por tenant, whitelist de dominios, estado de suscripción; catálogo vacío si no está activa.
- Métricas: tabla `try_on_events` y vistas agregadas.
- Cobro: transferencia y activación manual; MercadoPago suscripciones cuando haya más de cinco clientes.
- Plugin de WordPress: un envoltorio del script con un campo para la clave.
- Términos de servicio y política de privacidad (dejar claro que no se suben imágenes de la cara).

### Fase 4 — Pipeline de digitalización automatizado

Solo cuando la carga manual se vuelva una carga de tiempo real.

- Abrir la carga de marcos a la óptica desde el panel (cambio de política RLS, no de esquema).
- Worker que toma las fotos, llama a la API de generación 3D, corre el post-proceso en Blender headless y sube el GLB a R2.
- Cola de revisión: nada se publica sin que un humano lo apruebe.

### Fase 5 — Extras (según pidan los clientes)

DP de cerca vs. lejos, foto para compartir, comparar dos marcos lado a lado, recomendación por forma de cara, servicio de ir a fotografiar el catálogo como extra pago.

## 6. Pipeline de digitalización

Protocolo de fotos (para la guía visual del formulario): fondo blanco, luz pareja sin sombras duras, marco apoyado en su posición natural, cuatro tomas: frente, perfil izquierdo, arriba y tres cuartos. El perfil derecho es espejo del izquierdo en casi todos los marcos.

Post-proceso (script Blender, corre local):

1. Importar la geometría generada por la IA.
2. Eliminar lo que la IA haya generado en la zona de lentes y reemplazar por dos superficies planas con material vidrio según el tipo (lectura o sol).
3. Escalar a milímetros reales usando calibre, puente y largo de patilla.
4. Centrar el origen en el puente, alinear ejes (X hacia la sien, Y hacia arriba, Z hacia adelante).
5. Exportar GLB comprimido (Draco o meshopt), texturas en KTX2 o WebP.
6. Generar una miniatura para el panel.

Al principio corrés Hunyuan3D en Colab o Kaggle a mano y el script en tu máquina. Es una tarde por óptica del piloto.

## 7. Esquema mínimo de tablas

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
  kind text not null,               -- sol | lectura
  eye_size_mm int, bridge_mm int, temple_mm int,
  model_status text not null default 'pending', -- pending | ready | rejected
  glb_url text,
  thumbnail_url text,
  source_photos jsonb,              -- urls en R2
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

RLS: la óptica lee sus `frames` y `try_on_events` por `tenant_id`; al inicio, la escritura en `frames` solo la tiene tu usuario. El endpoint público del widget usa la `api_key` y una vista que solo expone marcos en estado `ready` de tenants activos.

## 8. Riesgos y cómo se mitigan

- **Calidad de los modelos 3D**, sobre todo marcos metálicos finos y transparentes. Se prueba en la Fase 0 con tres tipos distintos; si la IA no alcanza, se usan plantillas paramétricas texturizadas con la foto frontal. Nunca se publica un modelo sin revisión humana.
- **Competencia internacional que regala el widget** (Jeeliz tiene plan gratuito en Shopify). Se compite por mercado local, español, WordPress, MercadoPago y servicio de digitalización a mano, no por tecnología.
- **Precisión de la DP.** Se vende como estimación con aviso, no como medición clínica.
- **Derechos de las fotos.** Los aporta la óptica bajo sus términos; vos no redistribuís material de marcas.
- **Costo de egreso de assets.** Los GLB nunca van a Supabase Storage; siempre a R2.

## 9. Próximo paso inmediato

Fase 0, primer día: clonar el repo del spike, hacerlo correr localmente por HTTPS, y cambiar el modelo procedural por un GLB descargado. Todo lo demás espera a que eso se vea bien.
