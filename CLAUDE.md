# Espejo Virtual — documento troncal

## 1. Qué es
Widget embebible (un `<script>`) para sitios de ópticas, sin importar la tecnología del sitio.
Permite al cliente final probarse anteojos de sol y de lectura con la cámara, ver cada marco en 3D sin cámara (visor 360) y obtener una DP estimada.
Todo el procesamiento de video corre en el navegador; el servidor solo sirve JSON y estáticos.
Se vende como SaaS: abono mensual por el espejo + cargo único por cada marco digitalizado en 3D.
Lo opera Sebastian (Raven-Net); al inicio la digitalización es un servicio manual.

## 2. Mapa de documentos
| Archivo | Contenido | Consultarlo cuando… |
|---|---|---|
| `docs/01-analisis.md` | Producto, usuarios, negocio, flujos, requisitos, competencia, riesgos | Se discute alcance, precio, flujos o posicionamiento |
| `docs/02-arquitectura.md` | Capas, stack y costos, realismo, DP, licenciamiento, esquema + RLS, endpoints, pipeline 3D | Se toca código, base, Worker, R2 o el pipeline |
| `docs/03-diseno-visual.md` | Pantallas del panel, UI del widget, estados y errores, estilo | Se construye o diseña UI |
| `docs/04-desarrollo.md` | Repo, setup HTTPS local, comandos, convenciones, testing, build de `widget.js`, Blender | Antes de escribir o correr código |
| `docs/05-roadmap.md` | Fases 0–5 con tareas y criterios de salida, backlog | Para decidir qué sigue o si una tarea está en alcance |
| `docs/06-mantenimiento.md` | Límites gratuitos, costos, alta/baja de ópticas, rotar clave, diagnóstico, respaldos | Operación y soporte a clientes |
| `docs/07-decisiones.md` | ADR + pendientes de decisión | **Siempre** que un pedido pueda contradecir algo ya decidido |
| `docs/08-bitacora.md` | Registro por sesión | Para retomar contexto de sesiones anteriores |
| `docs/source/` | Plan, prompt inicial e instrucciones originales (congelados) | Solo como referencia histórica; manda `docs/` |

## 3. Estado actual (2026-10-18)
- **Fase:** 0 — Spike técnico, en curso. **Primer día cumplido.**
- **Hecho:** el repo original está copiado en `widget/` (MIT declarada solo en el README, ADR-023) y corre por HTTPS con certificado autofirmado (ADR-024; comandos en `04-desarrollo.md`). `sun_glasses.glb` reemplaza al modelo procedural, en mm y con origen en el puente, con escala calibrada por iris (ADR-025). Además: video y anteojo sincronizados, color de la cámara corregido y oclusor de cabeza. Sebastian lo probó con cámara en la PC y en el celular: "perfecto". Los GLB de prueba quedan fuera del repo (ADR-026).
- **Límites conocidos:** de perfil completo el anteojo desaparece (MediaPipe pierde la cara); las patillas pasan por delante de la oreja y del pelo (backlog); se ve algo "sticker" por las lentes opacas del modelo y la falta de sombra.
- **Esperando a Sebastian:** inicializar git y hacer el primer commit; abrir el issue de `LICENSE` en el repo original. Pendiente nuevo: P-13 (el spike es JS + React + CRA, no TS + Vite). Quedan 10 pendientes en `07-decisiones.md`.

## 4. Próximos tres pasos
1. Cargar los otros dos GLB (acetato grueso y metálico fino) con su spec de correcciones, y anotar qué hubo que corregir en cada uno para el script de Blender.
2. Agregar la estimación de DP con landmarks de iris, reusando la regla de escala de ADR-025.
3. Probar Hunyuan3D multi-vista con fotos reales de 3 marcos (decide P-02).

## 5. Protocolo de trabajo
**Al recibir un prompt:**
1. Leer este `CLAUDE.md` completo.
2. Leer los documentos de `docs/` que el mapa indique como relevantes.
3. Si el prompt contradice una decisión de `docs/07-decisiones.md`, señalarlo antes de hacer nada y preguntar si se está revirtiendo.

**Al terminar un trabajo:**
1. Actualizar "Estado actual" y "Próximos tres pasos" de este archivo.
2. Actualizar los documentos de `docs/` afectados.
3. Registrar toda decisión nueva en `docs/07-decisiones.md` (si Sebastian decide contra una objeción, anotarla).
4. Agregar la entrada de la sesión en `docs/08-bitacora.md`.
5. Cerrar con tres líneas: qué se hizo, qué documentos se tocaron, qué sigue.

**Reglas fijas:** español rioplatense; archivos, tablas, variables y código en inglés. No agregar tecnologías, servicios ni dependencias fuera de los documentos: proponerlas como pendiente. Lo no definido se pregunta (máx. 3 por turno) o queda `TBD`. Avisar el costo (plata o tiempo) antes de proponer un camino.

## 6. Decisiones innegociables
- El procesamiento de video (tracking, DP, render) ocurre solo en el navegador. Nunca se sube video ni imágenes de la cara.
- Los assets 3D (GLB, texturas) van a Cloudflare R2, nunca a Supabase Storage.
- Costo fijo mínimo: el único costo fijo aceptado es el proyecto Supabase; la generación 3D se traslada a la óptica.
- La óptica es dueña de sus registros desde el esquema (multi-tenant con RLS).
- Ningún modelo 3D se publica sin revisión humana.
- La DP se presenta siempre como estimación con aviso, nunca como medición clínica.
