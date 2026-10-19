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

## 3. Estado actual (2026-10-19)
- **Fase:** 0 — Spike técnico, en curso.
- **Repo:** https://github.com/sebastianRavenna/API_Espejo_Virtual (rama `main`).
- **Hecho:** `widget/` es TypeScript + Vite, sin React (ADR-028). Genera un solo `widget.js` que inserta un botón "Probátelos" y abre el probador en un modal con Shadow DOM (ADR-029). Probado en la página de desarrollo y en una HTML pelada, y con cámara en PC y celular: funciona igual que antes (quedan ajustes finos). El motor conserva todo lo validado con cámara: escala por iris (ADR-025), DP de lejos (ADR-027), oclusores, patillas con 7° de inclinación, seis marcos (tres de Sketchfab y tres generados con Hunyuan3D-2mv).
- **Hunyuan3D (P-02):** en Colab dio formas muy buenas en acetato (el de sol, excelente en cámara) y aceptables en metal fino. Prototipo de post-proceso en `blender/prototype_postprocess.py`.
- **DP:** estable y coincide con una tarjeta en ~2 %; ~60,5 mm de lejos para Sebastian contra 63–64 de Auglio. No mostrarla a una óptica sin validarla con un óptico.
- **Límites conocidos:** de perfil completo el anteojo desaparece (MediaPipe); las patillas pasan por delante de la oreja y del pelo; sin mapa de entorno los metales se ven apagados; `widget.js` pesa 656 KB (three 0.113, P-17).
- **Esperando a Sebastian:** detallar los ajustes finos del widget; DP medida por un óptico; decidir si el diseño visual del widget pasa por Claude Design (ADR-017 dice "en código"); abrir el issue de `LICENSE` en el repo original. Pendientes abiertos: 12 (P-13 resuelto; nuevo P-17).

## 4. Próximos tres pasos
1. Ajustes finos del widget y prueba embebido en un WordPress de prueba (cierra el empaquetado de la Fase 0).
2. Diseño visual del widget y realismo (mapa de entorno, P-17) para el video de 30 segundos de la Fase 0.
3. Validar la DP contra un óptico y cerrar P-02/P-07 (generación 3D y peso de los GLB).

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
