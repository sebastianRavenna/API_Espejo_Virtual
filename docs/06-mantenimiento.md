# 06 — Mantenimiento y operación

## Límites de las capas gratuitas

El plan pide **verificar los límites de cada plan al momento de arrancar, porque cambian**. Lo marcado "(verificar)" no está en el plan: es conocimiento general a junio de 2026 y hay que confirmarlo en la página oficial antes de la Fase 1.

| Servicio | Límite gratuito | Qué pasa al superarlo | Riesgo para nosotros |
|---|---|---|---|
| Cloudflare Workers (endpoint público) | 100.000 req/día (plan) · CPU limitada por request (verificar) | En el plan gratuito, los pedidos por encima del límite diario fallan hasta el reset; no se cobra (verificar). | Si cada `try` y cada `open` es un `POST /v1/events`, los eventos consumen el cupo mucho más rápido que el catálogo (que va cacheado). Ver P-04. |
| Cloudflare R2 (assets) | 10 GB de almacenamiento, egreso sin cargo (plan) · cupo mensual de operaciones de lectura y escritura (verificar) | Se cobra por GB y por millón de operaciones adicionales (verificar). | Bajo: un GLB comprimido pesa poco, pero hay que medirlo en el spike. Las fotos fuente también ocupan espacio. |
| Cloudflare Pages (estáticos, ADR-021) | Pedidos a estáticos gratis e ilimitados; 500 builds/mes; 25 MiB por archivo; 20.000 archivos por sitio (verificado 2026-10-18) | Los builds de más esperan al mes siguiente (verificar). | Bajo. |
| Supabase (proyecto dentro de la organización paga) | USD 10/mes por el proyecto (plan); los cupos de base, auth y backups dependen del plan de la organización (verificar) | Excedentes cobrados por uso (verificar). | Bajo para el piloto. `try_on_events` es la tabla que más crece. |
| Generación 3D (Colab/Kaggle) | Cuotas de GPU gratuitas variables (verificar) | Hay que esperar o pasar a la API paga (P-02). | El costo se traslada a la óptica. |
| MercadoPago | Sin costo fijo; comisión por transacción | — | — |

## Costos actuales

| Concepto | Costo mensual |
|---|---|
| Proyecto Supabase | USD 10 |
| Todo lo demás | 0 (dentro de las capas gratuitas) |
| **Total fijo** | **USD 10/mes** |

Costos variables: generación 3D por marco (trasladada a la óptica) y comisiones de cobro. Al 2026-10-18 no hay nada contratado todavía.

## Alta de una óptica (manual, Fase 2)

1. Crear el usuario de la óptica en Supabase Auth.
2. Insertar el `tenant`: `name`, `api_key` generada aleatoriamente, `allowed_domains` (con y sin `www`), `status = 'trial'` y `owner_user_id`. `TBD`: el formato y la longitud de la `api_key`.
3. Pasarle el acceso al formulario de entrega y el protocolo de fotos.
4. Digitalizar los 3 a 5 marcos sin cargo y aprobarlos (`ready`).
5. Pasarle el snippet y verificar que el widget aparece en su sitio.
6. Cuando paga (transferencia), `status = 'active'`.

## Baja de una óptica

- **Suspensión (falta de pago):** `status = 'suspended'`. El catálogo vuelve vacío de inmediato, o cuando vence el caché del Worker (`TBD`: TTL). Se reactiva volviendo a `active`.
- **Baja definitiva:** al borrar el `tenant` se borran en cascada sus `frames` y `try_on_events`. **Pero R2 no se borra solo:** hay que eliminar a mano los GLB, las miniaturas y las fotos fuente del tenant. Para hacerlo fácil conviene que todas sus rutas en R2 empiecen con el `tenant_id` (`TBD`: convención de rutas en R2).
- `TBD`: política de retención. Preguntas: ¿cuánto se guardan los datos después de la baja? ¿La óptica puede llevarse sus GLB? Los términos de servicio dicen que la óptica es dueña de sus registros; falta definir qué pasa con los modelos que pagó.

## Rotación de clave

1. Generar una nueva `api_key` y actualizar el `tenant`.
2. Mandar el snippet nuevo a la óptica.
3. **Mientras la óptica no lo pegue, su widget muestra catálogo vacío:** la clave vieja deja de valer en el acto (o cuando vence el caché).

`TBD`: ¿se acepta ese corte, o se soportan dos claves válidas durante una transición? Lo segundo cambia el esquema. Pregunta: ¿cuándo se rota una clave? (¿filtración, pedido de la óptica?)

## El espejo de un cliente dejó de funcionar

Diagnóstico en orden:

1. **¿El sitio carga por HTTPS?** Sin HTTPS no hay cámara (el visor 360 debería seguir andando).
2. **Consola del navegador en el sitio:** ¿`widget.js` carga? ¿Hay errores de CORS o de red?
3. **Pedido al catálogo:** ¿el Worker responde? ¿Devuelve marcos o una lista vacía?
4. Si vuelve vacío, revisar en el `tenant`:
   - ¿`status` es `trial` o `active`?
   - ¿El dominio exacto (con o sin `www`, subdominio) está en `allowed_domains`?
   - ¿La `api_key` del snippet coincide?
5. **¿Hay marcos en `ready`?**
6. **Los GLB:** ¿las URLs de R2 responden? ¿CORS del bucket y dominio propio OK?
7. **Cambios del sitio:** ¿la óptica cambió de tema, de plugin de caché o de optimizador de JS (algunos minifican o difieren scripts externos)?
8. **Estado de Cloudflare / Supabase** (incidentes, cupo diario del Worker agotado).

## Respaldos

- **Base:** `TBD`. Los backups automáticos dependen del plan de la organización Supabase (verificar). Pregunta: ¿alcanzan, o se agrega un `pg_dump` periódico? Si es así, ¿a dónde va, sin agregar servicios?
- **Assets en R2:** `TBD`. R2 no hace backup por sí solo. Las fuentes (fotos originales y medidas) permiten regenerar los GLB, pero cuesta tiempo y plata. Pregunta: ¿se guarda una copia local de los GLB aprobados en la máquina del operador?
- **Scripts y docs:** en el repo de GitHub.

Todo esto queda como pendiente P-12 en `07-decisiones.md`.
