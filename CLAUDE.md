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
- **Fase:** 0 — Spike técnico, en curso. Primer día cumplido.
- **Repo:** https://github.com/sebastianRavenna/API_Espejo_Virtual (rama `main`).
- **Hecho:** el spike está en `widget/` (MIT declarada solo en el README, ADR-023) y corre por HTTPS con certificado autofirmado (ADR-024). Tiene tres marcos de referencia (sol, acetato grueso, metálico fino), elegibles con botones, en mm y con origen en el puente, con escala calibrada por iris (ADR-025), video y anteojo sincronizados y oclusor de cabeza. El de sol está probado con cámara en PC y celular ("perfecto"). La DP estimada por iris está implementada y se muestra como DP de lejos, corregida por convergencia (ADR-027).
- **Probado con cámara:** los tres marcos se ven bien (acetato y metal con patillas sobre el pelo al mirar abajo).
- **Alerta de escala y DP:** la DP de Sebastian dio 58 mm (PDMeasure 58,2; Auglio, que hoy usa la óptica del piloto, 63–64), y el anteojo se vio proporcionado también en la cara de su hijo, cuando debería verse grande. La regla del iris puede no medir a la persona. Hay un modo diagnóstico (`?debug=1`) para comprobarlo. La DP de su hijo variaba 59–66 mm por estar lejos de la cámara: se subió la resolución a 1280×720, se exige un iris más grande y se rechazan las mediciones dispersas (falta probarlo). No mostrar la DP a una óptica sin validarla con un óptico.
- **Límites conocidos:** de perfil completo el anteojo desaparece (MediaPipe); las patillas pasan por delante de la oreja y del pelo (backlog); el metálico tiene patillas cortas porque el archivo trae unidades incoherentes; `acetate.glb` pesa 5 MB (P-07).
- **Esperando a Sebastian:** probar marcos y DP con la cámara; fotos de 3 marcos reales para la prueba de Hunyuan3D; abrir el issue de `LICENSE` en el repo original; decidir si nuestro repo lleva licencia (`TBD`). Pendientes abiertos: 10, entre ellos P-13 (el spike es JS + React + CRA, no TS + Vite).

## 4. Próximos tres pasos
1. Validar la DP contra la medición de un óptico. Hoy la app muestra la DP de lejos (corregida por convergencia): ~60,5 mm para Sebastian, contra 63–64 de Auglio. La regla del iris coincide con la tarjeta en ~2 %.
2. Prueba de Hunyuan3D multi-vista con las fotos de 3 marcos reales (decide P-02).
3. Medir peso y tiempo de carga de los GLB en el celular para decidir la compresión (P-07).

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
