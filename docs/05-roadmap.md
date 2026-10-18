# 05 — Roadmap

Orden de trabajo fijo: spike técnico → flujos y esquema mínimo → piloto con una óptica → producto vendible → pipeline automatizado.

## Fase 0 — Spike técnico · 1 a 2 semanas · **en curso** (desde 2026-10-18)

**Objetivo:** demostrar que funciona y tener algo para mostrar. Sin backend.

**Tareas:**
- [x] Verificar la licencia de `alperenuzun/basic-virtual-tryon-glasses` y copiarlo en `widget/` (ADR-020, ADR-023). Resultó JavaScript + React, no TypeScript (P-13).
- [x] Hacerlo correr localmente por HTTPS (ADR-024). Verificado en la PC y en el celular (Sebastian, 2026-10-18).
- [ ] Reemplazar el modelo procedural por 3 GLB genéricos (Sketchfab CC o CGTrader): uno de acetato grueso, uno metálico fino y uno de sol. `sun_glasses.glb` (sol) probado con cámara real en PC y celular; `acetate.glb` y `metal.glb` cargados con su spec y elegibles con botones, **falta probarlos con cámara**.
- [ ] Agregar la estimación de DP con landmarks de iris. **Implementada (ADR-027); falta probarla con cámara y compararla con una DP medida por un óptico.**
- [ ] Probar Hunyuan3D multi-vista con fotos reales de 3 marcos y evaluar el resultado. Si el metálico fino sale mal, anotarlo: ahí entran las plantillas paramétricas como respaldo.
- [ ] Empaquetar como un solo `widget.js` con Vite y probarlo embebido en una página WordPress y en una HTML pelada.

**Criterio de salida:** un video de 30 segundos que le mostrarías a una óptica sin vergüenza.

**Primer día:** clonar, correr por HTTPS y cambiar el modelo procedural por un GLB descargado. Todo lo demás espera a que eso se vea bien. **Cumplido el 2026-10-18.**

## Fase 1 — Flujos y esquema mínimo · 2 a 3 días

**Objetivo:** dejar el backend mínimo conectado al widget.

**Tareas:**
- [ ] Escribir en texto plano qué hace cada persona. El borrador ya está en `01-analisis.md`; se revisa con lo aprendido en el spike.
- [ ] Crear el proyecto Supabase y las tablas mínimas (`tenants`, `frames`, `try_on_events`) con RLS desde el principio.
- [ ] Resolver P-04 (escritura de eventos y credencial del Worker), P-05 (valores de `kind`) y P-08 (identificar al operador).
- [ ] Crear el bucket de R2 con dominio propio (requiere P-03).
- [ ] Worker con `GET /v1/catalog`.
- [ ] Conectar el widget del spike al endpoint de catálogo.

**Criterio de salida:** el widget, embebido en una página de prueba, muestra marcos leídos de Supabase vía Worker. Con una clave inválida, un dominio no permitido o un tenant suspendido, muestra catálogo vacío. *(Criterio derivado del plan; el plan no lo explicita.)*

## Fase 2 — Piloto con una óptica · 1 mes

**Objetivo:** validar con un cliente real que el producto sirve y cuánto pagaría.

**Tareas:**
- [ ] Revisar el argumento comercial (P-09) antes de salir a buscar la óptica.
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
- Foto para compartir.
- Comparar dos marcos lado a lado.
- Recomendación por forma de cara.
- Servicio de ir a fotografiar el catálogo de la óptica, como extra pago.
- Integración por producto con WooCommerce (vincular producto ↔ `frame`). Surge del análisis; `TBD` si va en la Fase 2 o 3.
- "Frame removal" (probarse marcos sin sacarse los propios), como ofrece Fittingbox. Surge de la investigación de competencia; no está en el plan.
