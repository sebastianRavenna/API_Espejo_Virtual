# 07 — Registro de decisiones (ADR)

Cada entrada tiene fecha, decisión, contexto, alternativas descartadas y consecuencias. Las entradas del 2026-10-18 marcadas "(plan)" se tomaron en `docs/source/plan-espejo-virtual.md` y se registran acá como punto de partida.

Para revertir una decisión hay que hacerlo explícitamente: se agrega una entrada nueva que la reemplaza, y la vieja se marca "Reemplazada por ADR-XXX". Si Sebastian decide contra una objeción de Claude, la objeción queda anotada en la entrada.

---

### ADR-001 · Procesamiento de video solo en el navegador (plan)
- **Fecha:** 2026-10-18
- **Decisión:** el tracking, el oclusor, el render 3D y la DP corren en el navegador del cliente final. Nunca se sube video ni imágenes de la cara a un servidor.
- **Contexto:** privacidad del cliente final y costo: el servidor solo sirve JSON y estáticos, y eso entra en capas gratuitas.
- **Alternativas descartadas:** procesamiento en servidor (costo de cómputo, riesgo legal por datos biométricos).
- **Consecuencias:** el rendimiento depende del dispositivo del usuario; los términos de servicio pueden afirmar que no se suben imágenes; el backend es mínimo.

### ADR-002 · Dos líneas de ingreso; el costo de generación 3D lo paga la óptica (plan)
- **Fecha:** 2026-10-18
- **Decisión:** abono mensual (espejo, visor 360, DP, métricas, hosting) más un cargo único por marco digitalizado. El costo de generar el 3D se traslada dentro de ese cargo.
- **Contexto:** la digitalización tiene costo variable (API y tiempo); el abono cubre el costo fijo.
- **Alternativas descartadas:** abono único que incluya digitalización ilimitada (el costo crece con el catálogo y no con el ingreso).
- **Consecuencias:** la oferta muestra los dos conceptos separados. Los precios están `TBD`.

### ADR-003 · Alta con 3 a 5 marcos digitalizados sin cargo (plan)
- **Fecha:** 2026-10-18
- **Decisión:** el alta incluye 3 a 5 marcos gratis para que la óptica vea el espejo con sus anteojos antes de decidir.
- **Contexto:** la venta se cierra cuando la óptica se ve con su propio catálogo.
- **Alternativas descartadas:** demo solo con marcos genéricos.
- **Consecuencias:** el tenant en `trial` debe ver su catálogo en el widget (ver ADR-018).

### ADR-004 · Digitalización manual al inicio, con formulario (plan)
- **Fecha:** 2026-10-18
- **Decisión:** al inicio digitaliza Sebastian (servicio manual). La óptica entrega fotos y medidas por un formulario mínimo, nunca por WhatsApp. El esquema no distingue quién carga; solo cambian los permisos RLS.
- **Contexto:** validar calidad y demanda antes de automatizar.
- **Alternativas descartadas:** pipeline automatizado desde el día uno; recibir material por WhatsApp (se pierde, no tiene estructura ni trazabilidad).
- **Consecuencias:** una tarde por óptica del piloto. La Fase 4 (automatizar) solo se hace cuando la carga manual se vuelva un problema real de tiempo.

### ADR-005 · Supabase como proyecto nuevo dentro de la organización paga (plan)
- **Fecha:** 2026-10-18
- **Decisión:** base de datos y auth en un proyecto Supabase propio, dentro de la organización paga existente. Es el único costo fijo aceptado (USD 10/mes).
- **Contexto:** separar datos y cupos de otros proyectos de Raven-Net sin pagar otra organización.
- **Alternativas descartadas:** reutilizar un proyecto existente (mezcla datos y RLS); un backend propio (costo y mantenimiento).
- **Consecuencias:** el panel habla directo con Postgres bajo RLS; Auth viene incluido.

### ADR-006 · Assets 3D en Cloudflare R2, nunca en Supabase Storage (plan)
- **Fecha:** 2026-10-18
- **Decisión:** los GLB, las texturas, las miniaturas y las fotos fuente van a R2 con dominio propio. En Postgres solo se guarda la URL.
- **Contexto:** R2 no cobra egreso; los GLB se descargan en cada prueba.
- **Alternativas descartadas:** Supabase Storage (egreso cobrado).
- **Consecuencias:** las bajas de tenants requieren borrar los objetos de R2 a mano o por script (ver `06-mantenimiento.md`).

### ADR-007 · Endpoint público en Cloudflare Workers, cacheado (plan)
- **Fecha:** 2026-10-18
- **Decisión:** el widget no habla con Supabase. Un Worker valida clave, dominio y estado y devuelve el catálogo cacheado.
- **Contexto:** capa gratuita de 100k req/día; aislar la base del tráfico público.
- **Alternativas descartadas:** que el widget consulte Supabase directo con la clave `anon`.
- **Consecuencias:** cómo se escriben los eventos de métricas sigue abierto (P-04).

### ADR-008 · Multi-tenant con RLS; la óptica es dueña de sus registros (plan)
- **Fecha:** 2026-10-18
- **Decisión:** cada registro pertenece a un `tenant_id` y RLS se activa desde la primera migración. La óptica lee lo suyo. Al inicio solo el operador escribe en `frames`; en la Fase 4 se abre la escritura con un cambio de política, no de esquema.
- **Contexto:** evitar migraciones de seguridad posteriores.
- **Alternativas descartadas:** single-tenant o RLS "después".
- **Consecuencias:** hace falta definir cómo se identifica al operador (P-08).

### ADR-009 · Ningún modelo 3D se publica sin revisión humana (plan)
- **Fecha:** 2026-10-18
- **Decisión:** un `frame` solo pasa a `ready` cuando un humano lo revisó en el espejo. Lo mismo vale en la Fase 4 con la cola de revisión.
- **Contexto:** la calidad de la IA varía (metálicos finos, transparentes) y un modelo malo daña la venta de la óptica.
- **Alternativas descartadas:** publicación automática.
- **Consecuencias:** el tiempo de revisión es un costo del operador y entra en el precio por marco.

### ADR-010 · La DP se presenta como estimación (plan)
- **Fecha:** 2026-10-18
- **Decisión:** "DP estimada", siempre con aviso. Nunca se presenta como medición clínica.
- **Contexto:** la precisión típica con iris de 11,7 mm es de 1–2 mm.
- **Alternativas descartadas:** venderla como medición.
- **Consecuencias:** los textos del widget y los términos de servicio lo dicen explícitamente.

### ADR-011 · Licenciamiento por clave + dominios + estado (plan)
- **Fecha:** 2026-10-18
- **Decisión:** clave por tenant, whitelist de dominios y estado de suscripción. Si el tenant no está habilitado, el catálogo vuelve vacío. No hace falta más protección.
- **Contexto:** sin marcos, el widget no sirve; el valor está en los modelos y el servicio.
- **Alternativas descartadas:** ofuscación o DRM del widget.
- **Consecuencias:** la clave es pública en el HTML (ver la nota de seguridad en `02-arquitectura.md`).

### ADR-012 · Esquema mínimo de 3 tablas para el piloto (plan)
- **Fecha:** 2026-10-18
- **Decisión:** solo `tenants`, `frames` y `try_on_events`. Pagos, cupos y roles se agregan cuando exista la primera factura.
- **Contexto:** no diseñar facturación antes de saber cuánto paga una óptica.
- **Alternativas descartadas:** esquema completo de SaaS desde el inicio.
- **Consecuencias:** el panel completo (Fase 3) espera a que las tablas estén cerradas.

### ADR-013 · Cobro por transferencia y activación manual; MercadoPago con más de cinco clientes (plan)
- **Fecha:** 2026-10-18
- **Decisión:** al principio se cobra por transferencia y se activa a mano. Las suscripciones de MercadoPago llegan con más de cinco clientes.
- **Contexto:** no vale la pena automatizar el cobro de pocos clientes.
- **Alternativas descartadas:** pasarela automática desde el día uno.
- **Consecuencias:** `tenants.status` se cambia a mano.

### ADR-014 · Competir por mercado local, no por tecnología (plan; revisar, ver P-09)
- **Fecha:** 2026-10-18
- **Decisión:** posicionamiento local (español, WordPress/WooCommerce, MercadoPago, servicio de digitalización), no superioridad técnica.
- **Contexto:** Fittingbox y Jeeliz tienen años de ventaja tecnológica; Jeeliz tiene un plan gratuito en Shopify.
- **Alternativas descartadas:** competir en realismo o en catálogo.
- **Consecuencias:** **la investigación del 2026-10-18 muestra que "español" y "WooCommerce" ya los cubren Fittingbox y Auglio.** La decisión sigue en pie, pero los argumentos se revisan en P-09.

### ADR-015 · Realismo: escala en mm, origen en el puente, lentes planos, oclusor (plan)
- **Fecha:** 2026-10-18
- **Decisión:** modelos escalados en mm con calibre-puente-patilla, origen en el puente (X sien, Y arriba, Z adelante), lentes reemplazados por dos superficies planas de vidrio, oclusor facial que solo escribe profundidad.
- **Contexto:** es la diferencia entre "sticker" y "natural".
- **Alternativas descartadas:** usar la geometría de lentes de la IA; escalar a ojo.
- **Consecuencias:** las tres medidas son obligatorias en el formulario; el script de Blender las necesita.

### ADR-016 · El spike parte de `alperenuzun/basic-virtual-tryon-glasses`; build con Vite (plan)
- **Fecha:** 2026-10-18
- **Decisión:** se parte de ese repo (TypeScript, MediaPipe, Three.js, con oclusor). Vite lo empaqueta como un solo `widget.js` con Shadow DOM.
- **Contexto:** ahorra semanas de base técnica.
- **Alternativas descartadas:** empezar de cero.
- **Consecuencias:** hay que revisar la licencia del repo al clonarlo (resuelto en ADR-023). Dónde vive el código es P-06.
- **Nota (2026-10-18):** el repo original no es TypeScript: es JavaScript con React 16 y react-scripts 3.4. El plan lo describía mal. La migración queda como P-13.

### ADR-017 · Orden de trabajo y diseño (plan; la parte del widget, reemplazada por ADR-030)
- **Fecha:** 2026-10-18
- **Decisión:** spike → flujos y esquema → piloto → producto vendible → pipeline automatizado. La UI del panel se diseña con Claude Design recién con las tablas cerradas (Fase 3). La UI del widget se hace en código sobre el canvas 3D, no en mockups.
- **Contexto:** no diseñar sobre supuestos.
- **Alternativas descartadas:** diseñar el panel primero.
- **Consecuencias:** el panel de la Fase 2 es mínimo y funcional.

### ADR-018 · Los tenants en `trial` también reciben catálogo
- **Fecha:** 2026-10-18 (esta sesión; aprobada por Sebastian)
- **Decisión:** la vista o función pública expone marcos `ready` de tenants con `status in ('trial','active')`. Solo `suspended` devuelve vacío.
- **Contexto:** el plan decía "tenants activos", lo que contradecía el período de prueba con 3 a 5 marcos gratis (ADR-003) y el piloto sin pago (Fase 2).
- **Alternativas descartadas:** solo `active` (rompe el trial); un estado `pilot` aparte (innecesario).
- **Consecuencias:** falta definir cuánto dura el `trial` y quién lo pasa a `suspended` al vencer (`TBD`, hoy a mano).

### ADR-019 · Esta carpeta es la raíz del repo; los documentos originales van a `docs/source/`
- **Fecha:** 2026-10-18 (esta sesión)
- **Decisión:** `C:\Archivos\Trabajos\API Espejo Virtual` es la raíz del repo; Sebastian lo inicializa y lo sube a GitHub. El plan, el prompt inicial y las instrucciones se mueven a `docs/source/` como referencia congelada; la fuente de verdad viva es `docs/`.
- **Contexto:** separar el material de origen de la documentación que se mantiene.
- **Alternativas descartadas:** dejarlos en la raíz (se confunden con los documentos vivos).
- **Consecuencias:** si el plan y `docs/` divergen, manda `docs/`.

### ADR-020 · El código del spike vive en `widget/` dentro de este repo (resuelve P-06)
- **Fecha:** 2026-10-18 (esta sesión; decidida por Sebastian)
- **Decisión:** el código de `alperenuzun/basic-virtual-tryon-glasses` se copia en `widget/` de este repo, manteniendo su licencia y el crédito al autor original. Ese código evoluciona hasta ser el `widget.js` del producto.
- **Contexto:** el spike no es descartable; es la base del widget.
- **Alternativas descartadas:** un repo separado o un fork (dos repos que mantener; después hay que mudar el código).
- **Consecuencias:** hay que verificar la licencia del repo original antes de copiarlo. Los cambios que publique el original no llegan solos; se traen a mano si interesan.

### ADR-021 · Estáticos en Cloudflare Pages (resuelve P-01)
- **Fecha:** 2026-10-18 (esta sesión; decidida por Sebastian)
- **Decisión:** `widget.js` y el panel se publican en Cloudflare Pages, plan gratuito.
- **Contexto:** Sebastian tiene Vercel Pro, que también serviría (permite uso comercial). Se eligió Pages por costo cero verificado y porque el Worker y R2 ya están en Cloudflare: un solo proveedor para dominio, DNS, estáticos, endpoint y assets. Además, el producto no depende de mantener Vercel Pro por otros motivos.
- **Verificado el 2026-10-18** ([docs de Cloudflare](https://developers.cloudflare.com/pages/functions/pricing/)): "On both free and paid plans, requests to static assets are free and unlimited". Límites del plan gratuito: 500 builds por mes, 25 MiB por archivo, 20.000 archivos por sitio.
- **Alternativas descartadas:** Vercel Pro (costo extra cero hoy, pero ata el producto a una suscripción ajena al proyecto).
- **Consecuencias:** las Pages Functions, si se usaran, consumen el cupo de Workers. Para el endpoint se usa el Worker (ADR-007).

### ADR-022 · `frames.kind` usa `sun | reading` (resuelve P-05)
- **Fecha:** 2026-10-18 (esta sesión; decidida por Sebastian)
- **Decisión:** los valores de `frames.kind` son `sun` y `reading`. En pantalla se muestran "Sol" y "Lectura".
- **Contexto:** el resto de los valores del esquema (`status`, `model_status`, `event`) ya están en inglés. No lo exige la regla del proyecto, que solo cubre nombres; es una cuestión de coherencia.
- **Alternativas descartadas:** `sol | lectura`, como estaba en el plan.
- **Consecuencias:** la primera migración usa `check (kind in ('sun','reading'))`.

### ADR-023 · Se copia el spike con la licencia MIT declarada en el README
- **Fecha:** 2026-10-18 (sesión Fase 0 día 1; decidida por Sebastian)
- **Decisión:** se copió `alperenuzun/basic-virtual-tryon-glasses` (commit `a1413d5`) en `widget/`, sin historial git, tomando como permiso la declaración "License: MIT" de su README. El texto MIT con la atribución a Alperen Uzun y la aclaración quedan en `widget/LICENSE-UPSTREAM.md`; el crédito, en `widget/README.md`.
- **Contexto:** el repo **no trae archivo `LICENSE`** y GitHub lo reporta "sin licencia". El README sí dice MIT (badge y sección). Sin el archivo no hay titular ni año.
- **Excluido de la copia:** `public/js/gsap.min.js` (licencia propia de GreenSock, no MIT) y `public/js/jquery-3.4.1.min.js`, que se cargaban pero ningún archivo usaba; y `public/obj/*` (modelos sin licencia ni procedencia, que el código no cargaba).
- **Alternativas descartadas:** frenar hasta que el autor agregue el archivo (parar el spike por un riesgo bajo).
- **Consecuencias:** **tarea de Sebastian:** abrir un issue en el repo original pidiendo que agreguen el `LICENSE`. Si el autor contestara otra cosa, hay que revisar esta decisión antes de vender.

### ADR-024 · HTTPS local con el certificado autofirmado de react-scripts
- **Fecha:** 2026-10-18 (sesión Fase 0 día 1)
- **Decisión:** el dev server corre con `HTTPS=true` (en `widget/.env.development`), que hace que react-scripts genere solo un certificado autofirmado. Escucha en `0.0.0.0`, así que el celular entra por `https://<IP-LAN>:3000`. No se agregó ninguna dependencia.
- **Contexto:** sin HTTPS no hay cámara, y desde el celular `localhost` no aplica.
- **Alternativas descartadas:** `mkcert` (certificado confiable, sin aviso; pero es una herramienta nueva y en el celular hay que instalar su CA a mano); túnel tipo `cloudflared` o `ngrok` (servicio externo, el video sigue local pero la página pasa por un tercero).
- **Actualización (2026-10-19, ADR-028):** con Vite, el certificado ya no lo genera react-scripts. Lo crea `npm run cert` (openssl de Git para Windows) en `widget/.cert/`, para localhost y las IP de la LAN.
- **Consecuencias:** cada dispositivo muestra un aviso de "conexión no privada" que hay que aceptar una vez. Funciona en Chrome de escritorio; **falta verificar en Chrome Android y Safari iOS**. Si Safari iOS no da cámara con el certificado autofirmado, la siguiente opción es `mkcert` (pedir OK). Al pasar a Vite (P-13) hay que rehacer esto.

### ADR-025 · En el spike, la escala sale del iris y el puente se apoya en el landmark 168
- **Fecha:** 2026-10-18 (sesión Fase 0 día 1)
- **Decisión:** el modelo se dibuja en mm reales (ADR-015) y se convierte a píxeles con una regla: diámetro medio del iris (11,7 mm), medido con los landmarks 469–477, mediana de 15 frames. Si no hay landmarks de iris, se usa el ancho de cara (234–454) como 140 mm. El origen del modelo (puente) se ubica en el landmark 168, 2 mm hacia adelante y 2 mm hacia abajo (`CFG` en `constants.js`).
- **Contexto:** el repo original escalaba un modelo procedural relativo al ancho de la cara en píxeles, con un factor a ojo (1,22). Con eso un marco de 52-18-140 no se ve de su tamaño real, que es justamente lo que ADR-015 quiere evitar.
- **Alternativas descartadas:** seguir con el ancho de cara (varía más entre personas que el iris: ±7 % contra ±4 % aprox.).
- **Consecuencias:** la DP (próxima sesión) va a usar la misma regla; conviene que sea una sola función. Los offsets de 2 mm están puestos a ojo sobre una foto fija: hay que ajustarlos con la cámara real.
- **Ajuste tras la prueba con cámara real (2026-10-18):** con la mediana de 15 frames sobre px/mm, el anteojo tardaba en seguir el acercamiento y "respiraba" (se agrandaba y achicaba). Ahora el iris calibra el **ancho de cara de la persona en mm**, que no cambia con la distancia (mediana de 30 frames), y la escala de cada frame sale del ancho de cara en píxeles de ese frame (landmarks 234–454), sin demora. El puente se subió 3 mm (`bridgeDropMm` de 2 a −1) porque quedaba bajo.
- **Segundo ajuste (2026-10-18):** al girar la cabeza el ancho de mejilla a mejilla se acorta y el anteojo se achicaba. Ahora el iris calibra dos medidas de la persona: ancho de cara (234–454) y alto de la parte superior de la cara (10–2, frente a debajo de la nariz; no depende de la mandíbula). Se calibra solo con la cara de frente. En cada frame se toma la mayor de las dos escalas: girar acorta el ancho, cabecear acorta el alto, y ninguno de los dos alarga.

### ADR-026 · Los GLB de prueba no van al repo (resuelve P-14)
- **Fecha:** 2026-10-18 (sesión Fase 0 día 1; decidida por Sebastian)
- **Decisión:** `models-dev/` y `widget/public/models-dev/` están en el `.gitignore` de la raíz. `widget/README.md` lista cada GLB de prueba con su autor, su licencia y el enlace de descarga. El dev server los lee de `widget/public/models-dev/`.
- **Contexto:** son fixtures de desarrollo descargados de Sketchfab (CC-BY-4.0); pesan ~7 MB y quedarían para siempre en el historial de git.
- **Objeción de Claude (anotada):** Claude recomendaba commitear solo los 3 de referencia, porque así el spike es reproducible. Sin ellos en el repo, cada persona necesita una cuenta de Sketchfab, y una descarga distinta del mismo modelo puede romper las correcciones de su spec (unidades, rotación, puente), que dependen del archivo exacto.
- **Alternativas descartadas:** commitearlos; Git LFS (herramienta nueva); bucket de R2 de desarrollo (R2 todavía no existe).
- **Consecuencias:** después de clonar, el widget no muestra anteojo hasta que se bajen los GLB. Para detectar una descarga distinta, la consola muestra el tamaño en mm al cargar.

### ADR-027 · Cómo se estima la DP en el spike (resuelve el `TBD` de frames y condiciones)
- **Fecha:** 2026-10-18 (sesión Fase 0; propuesta de Claude, pendiente de validar con la DP medida por un óptico)
- **Decisión:** DP = distancia entre los centros de los iris (landmarks 468 y 473) dividida por el diámetro medio del iris en el mismo cuadro, × 11,7 mm. Como el iris es la regla, no depende de la distancia a la cámara. Solo cuentan los cuadros con la cara de frente (|z| de la línea de los ojos < 0,12, más estricto que la calibración de escala) y con el iris de al menos 12 px. Se juntan 45 cuadros válidos (~1,5 s) y se toma la mediana. Si en 10 s no se juntan, se avisa y se pide acercarse y mirar de frente. Valores en `CFG.pd`.
- **Contexto:** `02-arquitectura.md` dejaba en `TBD` cuántos frames, cuánto dura y qué hacer si la cara no está de frente o está lejos.
- **Texto en pantalla (ADR-010):** "DP estimada: N mm" más el aviso "Es una estimación hecha con la cámara (precisión de 1 a 2 mm). No reemplaza la medición de tu óptico."
- **Limitación conocida:** la persona mira la pantalla, que está cerca, así que los ojos convergen y la DP medida sale algo menor que la DP de lejos. DP de cerca vs. lejos es de la Fase 5.
- **Consecuencias:** hay que comparar contra la DP medida por un óptico (criterio de testing de `04-desarrollo.md`) antes de mostrarla a una óptica.
- **Alerta (2026-10-18, primera prueba):** para Sebastian, la app da 58 mm, PDMeasure 58,2 y Auglio 63–64. Además, el anteojo se vio proporcionado en una cara adulta y en la de un chico, cuando debería verse grande en el chico. La regla del iris puede no estar midiendo a la persona, y la "precisión de 1 a 2 mm" del plan no está validada. **No mostrar la DP a una óptica hasta validarla contra una medición profesional.** Diagnóstico en `08-bitacora.md`.
- **Validación parcial (2026-10-18):** con una tarjeta de 85,6 mm apoyada en la frente y corregida por perspectiva, la DP de Sebastian da 57,3–57,7 mm contra 58,8 del iris: la regla del iris coincide en ~2 %. Queda el **sesgo de convergencia**: se mide DP de cerca a ~35 cm (≈ 1,5–2 mm menos que la DP de lejos).
- **Corrección de convergencia (2026-10-18; aprobada por Sebastian):** la app muestra la **DP de lejos**, que es la que informan los ópticos, con la leyenda "(de lejos)". Cada ojo gira alrededor de un centro ~10 mm detrás de la pupila; mirando la cámara a distancia D, DP de cerca = DP de lejos − 2·r·sen θ, con sen θ = (DP/2)/√(D² + (DP/2)²). D sale de la escala del iris y de un ángulo de visión supuesto de 65° sobre el lado largo de la imagen (`CFG.pd.cameraFovDeg`). Con los datos de Sebastian: 58,8 de cerca → 60,5 de lejos (D ≈ 36 cm); con un ángulo de 60° a 78° el resultado queda entre 60,3 y 60,9. Esto adelanta parte de "DP de cerca vs. lejos" (Fase 5): mostrar también la de cerca sigue en la Fase 5.
- **Ajuste por ruido (2026-10-18, segunda prueba):** en el hijo de Sebastian, sentado más lejos, la DP saltó entre 59 y 66 mm; en Sebastian, cerca, se mantuvo en 58. Con un iris de 12–14 px, un píxel de ruido mueve la DP 4–5 mm. Cambios: la cámara se pide a 1280×720 (antes 640×480 por defecto); el iris mínimo sube de 12 a 20 px; si la dispersión entre los percentiles 25 y 75 de los cuadros supera 2 mm, no se muestra resultado y se pide repetir más cerca; mientras mide, la pantalla dice si falta la cara, si está lejos o si está girada. Se sacó del aviso en pantalla "precisión de 1 a 2 mm" porque no está validada; el aviso de ADR-010 queda: "Es una estimación hecha con la cámara. No reemplaza la medición de tu óptico".

### ADR-028 · El widget pasa a TypeScript + Vite, sin React (resuelve P-13)
- **Fecha:** 2026-10-19 (decidida por Sebastian, opción a de P-13)
- **Decisión:** el spike se reescribió en TypeScript estricto y se empaqueta con Vite en modo librería, como un solo `widget.js` (IIFE). Se eliminaron React, react-scripts y todo el andamiaje de CRA. El motor quedó como una clase (`TryOnEngine`) con `start()` y `stop()`, y la interfaz en TypeScript sin framework. Se conserva three.js 0.113.2 (la del repo original) para que la migración no cambie el aspecto; actualizarlo es P-17. `package-lock.json` se commitea (decidido por Sebastian) para que el build sea reproducible.
- **Contexto:** el plan pedía TypeScript + Vite (ADR-016) y el repo original era JavaScript + React + CRA, con 1.849 paquetes de 2020.
- **Alternativas descartadas:** seguir con CRA y React (dependencias viejas, un bundle con React adentro); migrar más adelante (había que empaquetar ahora).
- **Consecuencias:** 16 paquetes en lugar de 1.849. `widget.js` pesa 656 KB (169 KB comprimido), casi todo three.js. El HTTPS local se rehízo (ADR-024): certificado autofirmado con `npm run cert` (openssl de Git) para el dev server y el preview de Vite.

### ADR-029 · Formato del widget: botón que abre un modal, en Shadow DOM
- **Fecha:** 2026-10-19 (decidida por Sebastian; estaba `TBD` para el momento de empaquetar)
- **Decisión:** el `<script>` inserta un botón "Probátelos" donde se pega (o en `data-target`) y el probador se abre en un modal encima de la página. La cámara se pide recién al abrir y se apaga al cerrar. Todo vive en un Shadow DOM, así que los estilos del sitio y del widget no se mezclan.
- **Contexto:** `03-diseno-visual.md` lo dejaba abierto: modal o incrustado en la página.
- **Alternativas descartadas:** incrustado en un recuadro de la página (ocupa espacio, depende del diseño de cada sitio, y hay que decidir cuándo pedir la cámara).
- **Consecuencias:** en celular el modal ocupa toda la pantalla. Para WooCommerce alcanza con pegar el script en la ficha de producto. La UI actual es funcional y mínima (ADR-017); el diseño visual se trabaja antes del video de la Fase 0.

### ADR-030 · La UI del widget también se diseña con Claude Design (reemplaza en parte a ADR-017)
- **Fecha:** 2026-10-19 (decidida por Sebastian)
- **Decisión:** el diseño visual del widget (botón, modal, controles, estados y mensajes) se hace en Claude Design y después se implementa en código, igual que el del panel. Lo que funciona hoy queda como base funcional.
- **Contexto:** ADR-017 decía que la UI del widget se hacía directamente en código, sobre el canvas, sin mockups. El widget es lo que va a ver la óptica en el video de la Fase 0 y lo que ve su cliente final.
- **Alternativas descartadas:** seguir diseñando el widget directo en código.
- **Consecuencias:** antes del video de la Fase 0 hay un paso de diseño en Claude Design. Los estilos están en un solo archivo (`widget/src/ui/styles.css`, en Shadow DOM), así que el rediseño no toca el motor. El diseño del panel sigue esperando a que las tablas estén cerradas (Fase 3), como dice ADR-017.

### ADR-031 · El widget toma el color de marca de cada óptica
- **Fecha:** 2026-10-20 (decidida por Sebastian)
- **Decisión:** el botón "Probátelos" y los acentos del modal (marco elegido, botones principales, progreso) usan el color de marca de la óptica. El resto del modal es neutro (fondo oscuro, texto claro) para que la cámara y el anteojo se lean bien con cualquier color.
- **Objeción de Claude (anotada):** recomendaba una paleta neutra común para el piloto, porque el color por óptica agrega una columna al esquema mínimo (ADR-012) y obliga a cuidar el contraste: un color claro (amarillo, celeste) sobre fondo claro o con texto blanco puede quedar ilegible.
- **Contexto:** `03-diseno-visual.md` lo dejaba en `TBD`. La óptica siente el widget como propio si lleva su color.
- **Alternativas descartadas:** paleta neutra igual para todas.
- **Consecuencias:** el esquema suma `tenants.brand_color text` (hex, por ejemplo `#1a5fb4`), que se carga desde el panel y viaja en la respuesta de `/v1/catalog`. Mientras no haya backend, el `<script>` acepta `data-color`. El widget calcula el color del texto sobre el acento (blanco o negro) según el contraste, y si el color no es válido o tiene poco contraste usa uno por defecto.

### ADR-032 · Marca del producto discreta dentro del modal
- **Fecha:** 2026-10-20 (decidida por Sebastian)
- **Decisión:** el modal muestra una línea chica con la marca del producto ("Probador por …"), abajo, con poco contraste. El botón que ve la página de la óptica no lleva nuestra marca.
- **Contexto:** `03-diseno-visual.md` lo dejaba en `TBD`; Jeeliz vende como ventaja no mostrar la marca.
- **Alternativas descartadas:** sin marca (queda como posible extra pago); marca en el botón (compite con la óptica).
- **Consecuencias:** el texto final depende del nombre comercial (P-03). Hasta entonces el diseño reserva el espacio.

### ADR-033 · Lentes de vidrio con Fresnel e intensidad del reflejo por tipo (amplía ADR-030)
- **Fecha:** 2026-10-20 (pedido de Sebastian). Ampliada el 2026-10-21: panorama "Lebombo" aprobado (cierra P-18) y lentes curvas (curva base 6, aprobado por Sebastian; enmienda las "superficies planas" de ADR-015).
- **Decisión:** las lentes son superficies propias con un material de vidrio, no parte del marco. El reflejo sigue la ley de Fresnel: casi nulo mirando de frente (~4 %) y fuerte hacia los bordes y en ángulos rasantes, así se desplaza sobre el vidrio al mover la cabeza. La intensidad depende del tipo de marco: marcada en `sun` (1,0) y sutil en `reading` (0,35), para que nunca tape los ojos. Ajustable con `?reflect=<sol>,<lectura>` (`CFG.lensReflect`).
- **Contexto:** Sebastian pidió reflejos como los de Fittingbox: un entorno reconocible sobre el vidrio, no una mancha de brillo. Hasta ahora casi ningún modelo tenía lentes separadas: a los generados con IA se les borraban y en otros venían fundidas con el marco.
- **Cómo se hace (three.js 0.113, sin forzar):** `MeshPhysicalMaterial` de 0.113 tiene `transparency` (el cuerpo es transparente y el alfa sube con la luz reflejada, ponderada por Fresnel de Schlick); un uniform escala el reflejo según el tipo. La cámara ortográfica ya usa la dirección de vista correcta en esos shaders. El post-proceso (`blender/prototype_postprocess.py --lens clear|tinted`) borra la lente de la IA y genera una superficie por lente a partir del contorno de la foto de frente, como primitiva con material `lens`. La superficie es un casquete esférico de **curva base 6** (radio = 530 / curva ≈ 88 mm; `--base-curve`, 0 = plana): el contorno queda apoyado en el aro y el centro se adelanta ~3–4 mm, como una lente real. Una lente plana refleja apenas unos grados del entorno y se ve como un tinte parejo; curva, refleja un ángulo amplio y muestra formas reconocibles (ventanal, sol) que se desplazan al girar la cabeza.
- **Entorno reflejado:** panorama 360° "Lebombo" de Poly Haven (Greg Zaal, CC0), HDR 1k de 1,48 MB, girado media vuelta para que el ventanal quede en el reflejo de frente (`CFG.environment`). Se sirve en desarrollo junto a los modelos (`models-dev/env/lebombo_1k.hdr`, fuera del repo como ADR-026) y en producción desde R2. Se baja una vez por página al abrir el modal; mientras carga, o si falla, se usa el entorno sintético de ADR-030 (`createScreenEnvironment`). Ilumina también los marcos; `?light=` pasa a ser la intensidad del entorno sobre el marco (`envMapIntensity`, por defecto 1).
- **Límites:** (1) el entorno de reflejos de 0.113 se arma en cubos de 256 px por cara, así que el detalle reflejado es moderado (mejora con P-17); (2) los modelos de Sketchfab "Sol" y "Metal" traen la lente fundida con el marco, así que no tienen vidrio propio; el "Acetato" de Sketchfab sí (`lensMaterials: ['Frame.1']`); (3) el reflejo depende de la forma de la lente: los marcos de Sketchfab con vidrio propio conservan su geometría.
- **Alternativas descartadas:** dejar la lente de la IA (facetada y fundida con el marco, deforma el reflejo); usar transparencia común (los reflejos se apagan junto con el vidrio).
- **Consecuencias:** el script de Blender tiene que generar las lentes igual que el prototipo: superficie curva (curva base 6), material `lens`, tinte en espacio lineal (G-15 ≈ 0,03 / 0,04 / 0,02).

### ADR-034 · Supabase de desarrollo en la organización gratuita; se transfiere a la paga antes del piloto (enmienda ADR-005)
- **Fecha:** 2026-10-21 (decidida por Sebastian)
- **Decisión:** el proyecto Supabase del Espejo se crea en la organización gratuita "Produccion de Apps" para desarrollar y probar la Fase 1. Cuando haya algo operativo, antes de mostrárselo a una óptica, pasa a la organización paga (Raven-Net). ADR-005 sigue valiendo para producción.
- **Configuración al crearlo:** región São Paulo (`sa-east-1`, la misma de los otros proyectos); Data API activada (el Worker llama funciones por PostgREST); **"Automatically expose new tables" desactivado** (los permisos se dan a mano en las migraciones, así `anon` no ve ninguna tabla); **"Enable automatic RLS" activado** como red de seguridad (las migraciones igual lo activan explícitamente); Postgres común, no OrioleDB.
- **Contexto:** no pagar USD 10/mes mientras no haya nada que mostrar.
- **Objeciones de Claude (anotadas, no bloquean):** (1) los proyectos gratuitos se pausan tras una semana sin actividad; si se pausa, el widget se queda sin catálogo, así que no sirve para mostrárselo a una óptica; (2) el plan gratuito no tiene backups (P-12); (3) el plan gratuito permite pocos proyectos activos por cuenta (verificar el cupo actual).
- **Cómo se migra:** Supabase permite transferir un proyecto entre organizaciones (Project Settings → General → Transfer project), y conserva la URL y las claves, así que el Worker no cambia. Verificar el procedimiento cuando llegue el momento. Si no se pudiera, el plan B es rehacer el proyecto corriendo las migraciones de `supabase/migrations/`, que es la fuente de verdad del esquema.
- **Consecuencias:** el costo fijo es USD 0 hasta el piloto. La transferencia entra como tarea de la Fase 2.

### ADR-035 · El operador se identifica con `app_metadata.role = 'operator'` (resuelve P-08)
- **Fecha:** 2026-10-21 (decidida por Sebastian, recomendación de Claude)
- **Decisión:** el usuario de Sebastian en Supabase Auth lleva `app_metadata.role = 'operator'`. La función `is_operator()` lee ese claim del JWT. `app_metadata` solo se edita con la clave de servicio o desde el dashboard; el usuario no lo puede cambiar.
- **Alternativas descartadas:** UID fijo dentro de una función (hay que migrar para sumar a otra persona); tabla de roles (agrega una tabla, contra ADR-012).
- **Consecuencias:** después de cambiar el claim hay que cerrar sesión y volver a entrar para que el JWT lo traiga.

### ADR-036 · El Worker usa la clave `anon` (publishable) y solo puede ejecutar funciones (resuelve P-04)
- **Fecha:** 2026-10-21 (decidida por Sebastian)
- **Decisión:** el Worker habla con Supabase con la clave pública (`anon`, que en los proyectos nuevos se llama "publishable key", `sb_publishable_…`). El rol `anon` no tiene permisos sobre ninguna tabla: solo `execute` sobre funciones `security definer` que validan clave, dominio y estado antes de devolver o guardar algo. Lectura: `get_catalog`. Eventos (Fase 2): `log_events`, que recibe un lote (los eventos se agrupan en el cliente para cuidar el cupo de 100.000 pedidos por día del Worker).
- **Contexto:** es la opción (b) de P-04. La clave de servicio saltea RLS y, si se filtrara desde el Worker, expondría toda la base; con `anon`, lo peor que puede pasar es que alguien llame a las mismas funciones públicas.
- **Diferencia con un frontend que usa `anon` directo (como suele hacerse, por ejemplo, en Buzzer Live):** acá la clave no está en el navegador sino como secreto del Worker (ADR-007), y aunque se filtrara no da acceso a ninguna tabla.
- **Alternativas descartadas:** clave de servicio como secreto del Worker (opción a).
- **Consecuencias:** toda la lógica de validación vive en SQL (`get_catalog`, `log_events`) y se prueba en la base; el Worker queda como pasamanos con caché y CORS.

---

## Pendientes de decisión

| ID | Tema | Opciones | Recomendación de Claude | Bloquea |
|---|---|---|---|---|
| ~~P-01~~ | ~~Hosting de estáticos~~ | **Resuelto → ADR-021 (Cloudflare Pages)** | | |
| P-02 | Generación 3D | Hunyuan3D en Colab/Kaggle / Tripo o Hunyuan por API | **Prueba del 2026-10-18:** Hunyuan3D-2mv en Colab gratuito sirve para acetato (forma muy buena) y es aceptable para metal fino (más grueso que el real, con artefactos; requiere revisión y quizá plantilla). Recomendación: seguir con Hunyuan3D-2mv en Colab para el piloto (costo cero, ~minutos por marco más la sesión), con fotos ortogonales (P-15) y el post-proceso de lentes. Probado en el espejo el 2026-10-19: el de sol, excelente; el de acetato, bien tras limpiar las lentes; el metálico fino, flojo. Falta evaluar textura (Paint). Confirmar la licencia (P-16 y la inconsistencia de `setup.py`). | Fase 2 |
| P-03 | Dominio del producto | — (el plan usa `cdn.tuproducto.com`) / **subdominio de `raven-net.com.ar`** (propuesta de Sebastian, 2026-10-21) | **El subdominio sirve y no cuesta nada** (por ejemplo `espejo.raven-net.com.ar` para el Worker y `cdn.espejo.raven-net.com.ar` para R2 y `widget.js`). Condición: los dominios propios de R2 y de Workers exigen que el DNS de `raven-net.com.ar` esté en la misma cuenta de Cloudflare (mudar los nameservers es gratis; el modo "solo CNAME" es del plan Business). Contra: el producto queda con la marca Raven-Net en el snippet; si después se elige un nombre comercial, hay que cambiar el snippet en cada óptica. Hasta resolverlo se trabaja con `*.workers.dev` y la URL de desarrollo de R2; por eso la base guarda rutas de R2 y no URLs completas. | Fase 2 (antes de embeber en el sitio de la óptica) |
| ~~P-04~~ | ~~Escritura de `try_on_events` y credencial del Worker~~ | **Resuelto → ADR-036 (`anon` + funciones `security definer`)** | | |
| ~~P-05~~ | ~~Valores de `frames.kind`~~ | **Resuelto → ADR-022 (`sun / reading`)** | | |
| ~~P-06~~ | ~~Dónde vive el código del spike~~ | **Resuelto → ADR-020 (`widget/` en este repo)** | | |
| P-07 | Compresión de GLB y texturas | Draco / meshopt · KTX2 / WebP | Decidir en el spike midiendo peso y tiempo de carga en el celular. | Fase 0 |
| ~~P-08~~ | ~~Cómo identifica RLS al operador~~ | **Resuelto → ADR-035 (claim `app_metadata.role`)** | | |
| P-09 | Argumento comercial frente a la competencia | Ver `01-analisis.md` → Competencia | Apoyarse en pesos, MercadoPago, digitalización local y DP incluida; dejar de vender "español + WooCommerce" como diferencial. | Fase 2 (antes de ofrecer el piloto) |
| P-10 | Cómo sube el formulario las fotos a R2 | URL prefirmada emitida por el Worker / subida a través del Worker | URL prefirmada: el archivo no pasa por el Worker. Definir también si el formulario requiere login. | Fase 2 |
| P-11 | Dónde corre Blender headless en la Fase 4 | Máquina de Sebastian procesando una cola / servicio de cómputo pago | Sin decidir hasta la Fase 4. Un Cloudflare Worker no puede correr Blender. | Fase 4 |
| P-12 | Respaldos de base y R2 | Backups del plan Supabase / `pg_dump` periódico · copia local de GLB aprobados | Verificar qué incluye el plan de la organización antes de agregar nada. | Antes del primer cliente pago |
| ~~P-13~~ | ~~El spike no está en el stack documentado~~ | **Resuelto → ADR-028 (TypeScript + Vite, sin React)** | | |
| ~~P-14~~ | ~~Dónde viven los GLB de prueba~~ | **Resuelto → ADR-026 (fuera del repo, lista de descargas)** | | |
| P-15 | Protocolo de fotos para la generación 3D | Hunyuan3D-2mv usa vistas ortogonales `front`, `left` y `back`; el protocolo actual pide frente, perfil izquierdo, arriba y tres cuartos | Cambiar a frente, perfil izquierdo, perfil derecho y atrás (ortogonales, fondo blanco) y sumar las medidas de la patilla. Confirmar con la prueba antes de cambiar el formulario. | Fase 2 (formulario de entrega) |
| P-16 | Rotular los modelos 3D como generados por IA | La licencia de Hunyuan3D (Política de Uso Aceptable, ítem 12) pide identificar el contenido generado por máquina cuando se publica | Si se usa Hunyuan3D en producción, mostrar una leyenda discreta en el widget o en el visor 360 ("modelo 3D generado con IA a partir de fotos") y mencionarlo en los términos. Revisar también si pasa lo mismo con Tripo u otras APIs (P-02). | Antes de publicar el primer modelo generado con IA |
| P-17 | Actualizar three.js | El widget usa 0.113.2 (2020, la del repo original). Las versiones actuales cambian la API de color (`outputColorSpace`), la iluminación física y la ruta de los loaders | Actualizar en una tarea aparte, comparando capturas antes y después. Debería achicar `widget.js` y habilitar mejoras de realismo (mapa de entorno). | Antes de la Fase 3 |
| ~~P-18~~ | ~~Panorama de entorno para los reflejos~~ | **Resuelto → ADR-033 ("Lebombo", CC0, HDR 1k de 1,48 MB; se puede pasar a JPG de ~0,2 MB si el peso molesta en el celular)** | | |
