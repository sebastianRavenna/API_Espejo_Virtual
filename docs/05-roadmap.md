# 05 — Roadmap

Orden de trabajo fijo: spike técnico → flujos y esquema mínimo → piloto con una óptica → producto vendible → pipeline automatizado.

## Fase 0 — Spike técnico · 1 a 2 semanas · **en curso** (desde 2026-10-18)

**Objetivo:** demostrar que funciona y tener algo para mostrar. Sin backend.

**Tareas:**
- [x] Verificar la licencia de `alperenuzun/basic-virtual-tryon-glasses` y copiarlo en `widget/` (ADR-020, ADR-023). Resultó JavaScript + React, no TypeScript (P-13).
- [x] Hacerlo correr localmente por HTTPS (ADR-024). Verificado en la PC y en el celular (Sebastian, 2026-10-18).
- [x] Reemplazar el modelo procedural por 3 GLB genéricos (Sketchfab CC o CGTrader): uno de acetato grueso, uno metálico fino y uno de sol. Los tres probados con cámara en PC y celular, elegibles con botones (2026-10-18).
- [ ] Agregar la estimación de DP con landmarks de iris. **Implementada y probada con cámara (ADR-027): estable, coincide con una tarjeta en ~2 % y se muestra como DP de lejos. Falta compararla con una DP medida por un óptico (Auglio da 3 mm más).**
- [ ] **Repetibilidad de la DP (pedido de Sebastian, 2026-10-21):** medir varias veces seguidas da resultados distintos, con hasta 4 mm de diferencia. Antes que la exactitud, tiene que dar siempre lo mismo. Hay que revisar cómo se mide: cada medición es estable por dentro (dispersión ≤ 2 mm), pero varía de una a otra. Primera sospecha: la corrección de cerca a lejos, que depende de la distancia estimada (iris en píxeles + campo de visión supuesto de la cámara), más que la DP de cerca. Para separarlas, comparar la DP de cerca y la distancia de 5 a 10 mediciones con `?debug=1`.
- [ ] **El reflejo de las lentes no convence (Sebastian, 2026-10-21):** "no se ve para nada bien" con cámara real. Se sigue con la API; mientras tanto, bajarlo o apagarlo por defecto (`?reflect=`) y revisarlo después (ADR-033).
- [x] Probar Hunyuan3D multi-vista con fotos de 3 marcos y evaluar el resultado (2026-10-18, fotos de producto de Edel-Optics). Acetato: muy bien. Metálico fino: reconocible, pero más grueso que el real y con artefactos. Probados en el espejo con cámara el 2026-10-19: el de sol, excelente (ver `08-bitacora.md`).
- [ ] Empaquetar como un solo `widget.js` con Vite y probarlo embebido en una página WordPress y en una HTML pelada. **Hecho el empaquetado (TypeScript + Vite, botón + modal en Shadow DOM, ADR-028/029) y probado en la HTML pelada (2026-10-19). Probado con cámara en PC y celular: funciona igual que antes. Falta WordPress.**

**Criterio de salida:** un video de 30 segundos que le mostrarías a una óptica sin vergüenza.

**Primer día:** clonar, correr por HTTPS y cambiar el modelo procedural por un GLB descargado. Todo lo demás espera a que eso se vea bien. **Cumplido el 2026-10-18.**

## Fase 1 — Flujos y esquema mínimo · 2 a 3 días

**Objetivo:** dejar el backend mínimo conectado al widget.

**Tareas:**
- [ ] Escribir en texto plano qué hace cada persona. El borrador ya está en `01-analisis.md`; se revisa con lo aprendido en el spike.
- [x] Cerrar el modelo de datos v2 con Sebastian (ADR-037).
- [x] Crear el proyecto Supabase en la organización gratuita (ADR-034; lo creó Sebastian).
- [x] Escribir la primera migración (`tenants`, `frames`, `try_on_events`, RLS, permisos, `get_catalog`, `log_events`) y probarla en local (`supabase/tests/`).
- [ ] Aplicarla en el proyecto (falta acceso del conector a "Produccion de Apps", o pegarla en el SQL Editor) y correr los advisors de seguridad.
- [ ] Cargar un tenant de desarrollo con los seis marcos de prueba.
- [x] Resolver P-04 (ADR-036), P-05 (ADR-022) y P-08 (ADR-035).
- [ ] Crear el bucket de R2. Mientras no esté el dominio (P-03), con la URL de desarrollo de R2.
- [ ] Worker con `GET /v1/catalog`.
- [ ] Conectar el widget del spike al endpoint de catálogo.

**Criterio de salida:** el widget, embebido en una página de prueba, muestra marcos leídos de Supabase vía Worker. Con una clave inválida, un dominio no permitido o un tenant suspendido, muestra catálogo vacío. *(Criterio derivado del plan; el plan no lo explicita.)*

## Fase 2 — Piloto con una óptica · 1 mes

**Objetivo:** validar con un cliente real que el producto sirve y cuánto pagaría.

**Tareas:**
- [ ] Revisar el argumento comercial (P-09) antes de salir a buscar la óptica.
- [ ] Transferir el proyecto Supabase a la organización paga (ADR-034) y resolver el dominio (P-03).
- [ ] Elegir una óptica. `TBD`: cuál.
- [ ] Digitalizar 10 a 20 marcos suyos (servicio manual; ellos entregan fotos y medidas).
- [ ] Formulario mínimo de entrega (nombre, tipo, tres medidas, cuatro fotos) que guarde en R2 (P-10).
- [ ] Panel mínimo: login, lista de marcos con estado (pendiente / listo / rechazado), snippet para copiar.
- [ ] Embeber el widget en el sitio real de la óptica.
- [ ] Medir cuántos clientes lo abren, cuántos marcos prueban y qué dice la óptica.

**Criterio de salida:** la óptica dice que pagaría, y sabés cuánto.

## Fase 3 — Producto vendible · 2 a 3 meses

**Objetivo:** que se pueda vender a más ópticas sin intervención artesanal en cada paso.

**Tareas:**
- [ ] Panel completo diseñado con Claude Design (recién ahora, con las tablas cerradas): alta de cuenta, marcos, métricas por marco, dominios permitidos, snippet, facturación.
- [ ] Licenciamiento completo: clave por tenant, whitelist de dominios, estado de suscripción; catálogo vacío si está suspendido.
- [ ] Métricas: tabla `try_on_events` y vistas agregadas.
- [ ] Cobro por transferencia con activación manual; MercadoPago suscripciones cuando haya más de cinco clientes.
- [ ] Plugin de WordPress: un envoltorio del script con un campo para la clave.
- [ ] Términos de servicio y política de privacidad, dejando claro que no se suben imágenes de la cara y que la óptica garantiza los derechos de las fotos.

**Criterio de salida:** `TBD`. Pregunta: ¿cuántas ópticas pagando, o qué ingreso mensual, define que el producto es "vendible"?

## Fase 4 — Pipeline de digitalización automatizado · duración `TBD`

**Disparador:** solo cuando la carga manual se vuelva una carga de tiempo real.

**Tareas:**
- [ ] Abrir la carga de marcos a la óptica desde el panel (cambio de política RLS, no de esquema).
- [ ] Proceso que toma las fotos, llama a la API de generación 3D, corre el post-proceso en Blender headless y sube el GLB a R2. Dónde corre Blender es pendiente (P-11).
- [ ] Cola de revisión: nada se publica sin que un humano lo apruebe.

**Criterio de salida:** `TBD`. Pregunta: ¿qué tiempo de operador por marco se considera aceptable?

## Fase 5 — Extras · según pidan los clientes

Sin orden ni duración; cada uno entra si un cliente lo pide.

## Backlog (ideas no priorizadas)

- Oclusor de orejas y pelo: las patillas quedan delante de la oreja y del pelo (prueba del 2026-10-18). El elipsoide de cabeza tapa la patilla de atrás pero no modela orejas ni volumen de pelo. Ajuste fino.

- DP de cerca vs. lejos.
- Comparar dos marcos lado a lado.
- Servicio de ir a fotografiar el catálogo de la óptica, como extra pago.
- Integración por producto con WooCommerce (vincular producto ↔ `frame`). Surge del análisis; `TBD` si va en la Fase 2 o 3.

Agregadas por la investigación de mercado del 2026-10-20 (Sesión 4). Dificultad estimada sobre el stack actual; nada de esto está decidido ni priorizado:

| Idea | Qué es | Dificultad | Notas |
|---|---|---|---|
| Guía de talle | Ancho de cara (landmarks escalados por iris, ADR-025) contra ancho total del marco (2×calibre + puente + terminales, ~12 mm): "te queda chico / justo / grande". | Baja de programar; precisión sin validar | Reutiliza la escala por iris y las medidas de `frames`. Mejor relación valor/esfuerzo. **Depende de la alerta abierta sobre la regla del iris** (el anteojo se vio proporcionado en una cara adulta y en la de un adolescente; la DP varía entre dispositivos): validar antes de mostrarlo. Fittingbox lo vende como "Size Guarantee". Se presenta como orientación, igual que la DP (ADR-010). |
| Tinte de lentes | Selector de color de lente o fotocromático. | Baja, si la lente es una pieza propia | Es cambiar el material de la lente (ADR-033). Hoy solo los marcos generados con IA tienen la lente como superficie de vidrio propia; en los de Sketchfab "Sol" y "Metal" viene fundida con el marco. En producción depende de que el script de Blender genere las lentes (ADR-015), que todavía no existe. Fittingbox lo vende como "Lens Try-On". |
| Compartir la foto | Botón compartir (hoja nativa del celular) sobre la foto que hoy ya se descarga. | Baja | La foto ya existe (brief §3.6). La compartición la decide el usuario; nada pasa por nuestro servidor. |
| Variantes de color del marco | Mismo modelo en varios colores. | Media | Cambia el esquema (variantes por `frame`) y el pipeline (texturas por variante). |
| Botón "agregar al carrito" | Del espejo al carrito de WooCommerce. | Media | Depende de vincular producto ↔ `frame` (ítem de la lista de arriba). Refuerza el argumento local (P-09). |
| Modo foto | Cargar una foto desde el dispositivo en vez de usar la cámara en vivo. | Media | Se procesa igual en el navegador y no se envía a ningún servidor (ADR-001). Útil en computadoras sin cámara. |
| Recomendación por forma de cara | Clasificar el rostro (ovalado, redondo, cuadrado…) con proporciones de landmarks y sugerir estilos. | Media | La técnica es fácil; las reglas de estilo son convención, no ciencia, y la clasificación es ruidosa. Requiere etiquetar cada marco con su estilo (cambio de esquema). |
| Modo local (kiosco) | El widget a pantalla completa en una tablet dentro del local, para probar todo el catálogo sin tenerlo en stock. | Baja–media | Mismo widget. Podría abrir venta a ópticas sin sitio web, pero el licenciamiento valida el dominio del sitio de la óptica (ADR-011): una óptica sin sitio necesita otra forma de validar la licencia (por ejemplo, una página que hospedemos nosotros por óptica). |
| Eliminación de montura (frame removal) | Borrar en vivo los anteojos que el usuario tiene puestos. | Alta | Clave para miopes que no ven la pantalla sin anteojos. Exige reconstruir la cara en video en vivo dentro del navegador. Es la función estrella de Fittingbox, que la tiene patentada (según la investigación, 59 patentes; dato a verificar): revisar antes de encararla. |
| Altura de segmento | Medición para lentes progresivos. | Alta | Depende del marco puesto y roza lo clínico; choca con ADR-010 si no se presenta como estimación. |
