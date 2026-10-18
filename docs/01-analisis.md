# 01 — Análisis

## Producto

Espejo Virtual es un widget embebible que la óptica pega en su sitio con una sola etiqueta `<script>`, sin importar la tecnología del sitio (WordPress, WooCommerce, HTML propio u otra). Ofrece tres funciones al cliente final:

1. **Espejo virtual**: probarse en vivo, con la cámara, anteojos de sol y de lectura.
2. **Visor 360**: ver cada marco en 3D y rotarlo sin encender la cámara.
3. **DP estimada**: obtener una estimación de la distancia pupilar.

Sebastian vende el widget como servicio (SaaS) y digitaliza en 3D los marcos de cada óptica.

## Problema que resuelve

Quien compra anteojos online no puede ver cómo le quedan, y eso frena la compra. La óptica chica o mediana no tiene acceso a soluciones internacionales pensadas para Shopify, cobradas en dólares y que obligan a digitalizar el catálogo por su cuenta. La pregunta concreta de la óptica ("¿qué modelos generan más interés?") queda contestada con las métricas de uso del espejo.

`TBD`: el plan no tiene datos de mercado (cuántas ópticas con tienda online hay en el área objetivo ni cuánto pagan hoy por herramientas web). Pregunta: ¿cuál es el mercado inicial (AMBA, Argentina, LATAM) y cuántas ópticas tienen sitio con catálogo?

## Usuarios

| Usuario | Quién es | Qué necesita |
|---|---|---|
| Cliente final | Visitante del sitio de la óptica | Ver cómo le queda un marco, rotarlo, conocer su DP aproximada. Sin registrarse y sin que su cara salga de su dispositivo. |
| Óptica (tenant) | Dueño o encargado de una óptica con sitio web | Cargar su catálogo con el menor esfuerzo, copiar un snippet, ver métricas de qué se prueba. |
| Operador | Sebastian | Dar de alta ópticas, digitalizar y aprobar modelos, activar y suspender cuentas, cobrar. |

## Modelo de negocio

Dos líneas de ingreso, separadas y explícitas en la oferta:

| Concepto | Tipo | Qué cubre |
|---|---|---|
| Abono mensual | Recurrente | Uso del espejo, visor 360, DP, métricas, hosting |
| Digitalización por marco | Único, por unidad | Generación 3D, post-proceso, revisión de calidad |

Reglas:

- El alta incluye de 3 a 5 marcos digitalizados sin cargo, para que la óptica vea el espejo con sus propios anteojos antes de decidir. Durante ese período el tenant está en `trial` y el widget **sí** muestra el catálogo (ADR-018).
- La óptica garantiza que tiene derechos sobre las fotos que entrega; eso queda en los términos de servicio. Sebastian es procesador, no dueño del catálogo.
- Al principio se cobra por transferencia y la activación es manual. El cobro automático (MercadoPago suscripciones) llega recién con más de cinco clientes.
- Si la óptica deja de pagar, pasa a `suspended`: la API devuelve catálogo vacío y el espejo no muestra marcos. No hace falta más protección.
- El costo de generar modelos 3D se traslada a la óptica dentro del cargo por marco.

`TBD`: precios. Preguntas: ¿cuánto sale el abono mensual y cuánto cada marco digitalizado? ¿El abono tiene escalones por cantidad de marcos activos, como hacen todos los competidores? ¿Cuánto dura el `trial`? La Fase 2 tiene como criterio de salida responder "cuánto pagaría".

Argumento comercial principal según el plan: las métricas ("el modelo X lo probaron 300 personas este mes") y un servicio local, en español, con WordPress/WooCommerce y MercadoPago. **Ver "Competencia": parte de ese argumento ya no diferencia.**

## Flujos por usuario (texto plano)

### Cliente final
1. Entra a la página de un producto o del catálogo en el sitio de la óptica. El widget carga.
2. Elige un marco en el selector.
3. Opción A, visor 360: ve el marco en 3D y lo rota con el dedo o el mouse. No pide cámara.
4. Opción B, espejo: toca "Probar". El navegador pide permiso de cámara; si lo concede, se ve con el marco puesto y puede cambiar de marco sin cortar la cámara.
5. Opcional: toca "Medir DP", se queda quieto unos segundos frente a la cámara y ve "DP estimada: XX mm" con el aviso de que no reemplaza la medición del óptico.
6. Opcional: hace una captura (evento `snapshot`). `TBD`: qué hace con la captura; compartirla es un extra de la Fase 5.
7. Cada acción registra un evento anónimo (`open`, `try`, `snapshot`, `pd`). Nunca se guarda ni se envía la imagen.

### Óptica
1. Se registra o es dada de alta por el operador. `TBD`: en la Fase 2 el alta es del operador; el autoregistro llega en la Fase 3.
2. Entrega fotos y medidas de cada marco por el formulario mínimo: nombre, tipo, las tres medidas (calibre, puente, patilla) y cuatro fotos según el protocolo. Nunca por WhatsApp.
3. Ve la lista de sus marcos con su estado (pendiente / listo / rechazado).
4. Copia el snippet con su clave y lo pega en su sitio.
5. Mira métricas: aperturas, pruebas por marco, mediciones de DP (Fase 3).
6. Gestiona dominios permitidos y facturación (Fase 3).

### Operador (Sebastian)
1. Da de alta la óptica: crea el tenant con su clave y sus dominios y lo deja en `trial`.
2. Recibe las fotos del formulario, genera el 3D (Hunyuan3D o Tripo), corre el post-proceso en Blender y sube el GLB a R2.
3. Revisa cada modelo y lo aprueba (`ready`) o lo rechaza (`rejected`). Nada se publica sin esa revisión.
4. Cobra por transferencia y pasa el tenant a `active`; si no paga, lo pasa a `suspended`.

## Requisitos funcionales

| ID | Requisito | Fase |
|---|---|---|
| RF-01 | El widget se embebe con una etiqueta `<script>` con atributo `data-key`, en cualquier sitio. | 0 |
| RF-02 | Espejo en vivo con tracking facial, marcos 3D escalados en mm y oclusión de patillas. | 0 |
| RF-03 | Visor 360 del marco sin cámara (`<model-viewer>`). | 0 |
| RF-04 | DP estimada con landmarks de iris, presentada con aviso. | 0 |
| RF-05 | El catálogo del widget se obtiene del endpoint público y valida clave, dominio y estado del tenant. | 1 |
| RF-06 | Formulario de entrega de marcos (nombre, tipo, 3 medidas, 4 fotos) que guarda en R2. | 2 |
| RF-07 | Panel mínimo: login, lista de marcos con estado, snippet para copiar. | 2 |
| RF-08 | Registro de eventos de uso (`open`, `try`, `snapshot`, `pd`) por tenant y marco. | 2–3 |
| RF-09 | Panel completo: alta de cuenta, métricas por marco, dominios permitidos, facturación. | 3 |
| RF-10 | Plugin de WordPress que envuelve el script con un campo para la clave. | 3 |
| RF-11 | Cola de revisión y pipeline automatizado de digitalización. | 4 |

## Requisitos no funcionales

- **Privacidad:** ninguna imagen ni video de la cara sale del navegador. Los eventos no contienen datos personales.
- **Seguridad:** HTTPS obligatorio, porque sin HTTPS no hay acceso a la cámara. Aislamiento multi-tenant con RLS.
- **Aislamiento visual:** Shadow DOM, para que los estilos del sitio no rompan el widget ni el widget rompa el sitio.
- **Costo:** capas gratuitas en todo salvo Supabase (USD 10/mes). Ver `06-mantenimiento.md`.
- **Realismo:** escala en mm reales, origen en el puente, oclusor facial, lentes como superficies planas.
- **Rendimiento:** `TBD`. Preguntas: ¿peso máximo de `widget.js` y de cada GLB? ¿Tiempo máximo hasta ver el primer marco en un celular de gama media?
- **Compatibilidad:** `TBD`. Pregunta: ¿qué navegadores y dispositivos se soportan (Safari iOS, Chrome Android, desktop)?
- **Idioma:** español. `TBD`: si hace falta más de un idioma.

## Competencia

Investigación del 2026-10-18. Los precios están en USD y cambian; hay que verificarlos antes de usarlos en una propuesta comercial.

### Fittingbox (Francia)
Es el líder del rubro: más de 20 años, 59 patentes, y clientes como Fielmann, Specsavers, Afflelou, JINS y Zenni.
- **Qué hace:** espejo virtual web, en e-commerce y en el local, con "frame removal" para probarse marcos nuevos sin sacarse los propios. Tiene una base de más de 195.000 marcos de más de 1.200 marcas ya en 3D. Ofrece digitalización como servicio ("digital twins") en tres niveles: IA en el día, estándar y premium gestionado. Mide la DP online (dice ±1 mm en 7 de cada 10 mediciones) con la línea Optical Fit, que se vende aparte del espejo. Tiene herramientas para el local y demostración de lentes.
- **Integraciones:** Shopify, WooCommerce, Magento, PrestaShop, Drupal y HTML5.
- **Idiomas del sitio:** inglés, **español**, francés, italiano, neerlandés y portugués (Brasil).
- **Precio:** fuera de Shopify, a cotizar. En la app de Shopify: Bronze USD 59/mes (10 marcos, 500 usuarios únicos por mes), Silver USD 99 (50 marcos, 1.500 usuarios) y Gold USD 199 (200 marcos, 3.500 usuarios). Prueba de 14 días.

### Jeeliz (Francia; hoy opera como WebAR.rocks / SPACEGOO SARL)
- **Qué hace:** espejo web que se integra con un snippet "en menos de una hora". Genera los modelos 3D con IA generativa a partir de las fotos de producto que la óptica ya tiene (una foto frontal con patillas abiertas y otra lateral o de 3/4). Ajusta la iluminación de la cara sobre el marco y procesa todo en el dispositivo. No exige "powered by". No menciona medición de DP.
- **Integraciones:** snippet genérico y app de Shopify. No menciona WooCommerce ni API.
- **Precio:** en su sitio, Starter USD 299/mes (150 marcos, 10.000 sesiones por mes) y Advanced USD 499/mes (500 marcos, 100.000 sesiones), con un mes de prueba. En la app de Shopify (lanzada en agosto de 2025) hay un plan gratis de 3 marcos, Pro USD 39 (40 marcos), Premium USD 99 (200) y Ultimate USD 199 (500). La app de Shopify está solo en inglés.

### Auglio (agregado en esta investigación; no estaba en el plan)
Su propia comparativa es sesgada a su favor, así que hay que verificar estos datos.
- **Qué hace:** espejo virtual con DP automática, sin tarjeta de referencia, integrada desde el plan Basic (dice ±2 mm en 7 de cada 10 mediciones). Tiene una base de más de 100.000 marcos. La digitalización tiene tres niveles: semi-3D, asistida por IA en el día y premium fotorrealista desde USD 35 por SKU.
- **Integraciones:** Shopify, **WooCommerce, WordPress**, Magento, PrestaShop, Wix y otras.
- **Idiomas del sitio:** inglés, alemán, **español** y japonés.
- **Precio:** según su comparativa, Starter USD 49/mes (15 marcos, 200 usuarios), Basic USD 119 (con DP automática) y Professional USD 369. Su página de precios pide cotización.

### Por qué competimos por mercado local y no por tecnología

La tecnología no diferencia: Fittingbox tiene 20 años de patentes y una base de 195.000 marcos, y Jeeliz y Auglio ya generan 3D con IA a partir de fotos. Un desarrollador solo no los supera en realismo ni en catálogo.

**Corrección al plan:** el plan da como diferenciales "español" y "WordPress/WooCommerce". Eso ya no alcanza, porque Fittingbox y Auglio ofrecen las dos cosas. Lo que sigue siendo diferencial verificable es esto:

- **Cobro en pesos con transferencia o MercadoPago.** Todos los competidores cobran en USD con tarjeta internacional.
- **Digitalización hecha por alguien local.** La óptica entrega fotos y medidas y recibe el trabajo hecho, con revisión humana y trato directo. Fittingbox también vende digitalización, pero desde Francia y a cotizar.
- **Precio de entrada en pesos** para ópticas chicas, que no pagarían USD 59 a 299 por mes. `TBD` hasta definir precios.
- **Soporte cercano y en el idioma de la óptica.**
- **DP incluida en el abono**, cuando Fittingbox la vende aparte. Auglio también la incluye, así que esto solo diferencia frente a Fittingbox y Jeeliz.

Queda registrado como pendiente P-09 en `07-decisiones.md`: revisar el argumento comercial antes del piloto.

Fuentes:
- [Fittingbox — sitio](https://fittingbox.com/en/)
- [Fittingbox — app de Shopify](https://apps.shopify.com/glasses-virtual-try-on-by-fittingbox)
- [Fittingbox — medición de DP online](https://fittingbox.com/en/optical-fit/online-pd-measurement-tool)
- [Jeeliz — sitio](https://jeeliz.com/)
- [Jeeliz — app de Shopify](https://apps.shopify.com/jeeliz-live-virtual-try-on)
- [Auglio vs Fittingbox vs GlassOn (escrito por Auglio)](https://auglio.com/en/auglio-vs-fittingbox-vs-glasson)

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Calidad de los modelos 3D, sobre todo en marcos metálicos finos y transparentes | Se prueba en la Fase 0 con tres tipos distintos. Si la IA no alcanza, se usan plantillas paramétricas texturizadas con la foto frontal. Nunca se publica un modelo sin revisión humana. |
| Competencia internacional que regala el widget (Jeeliz tiene un plan gratuito en Shopify) | Competir por mercado local: cobro en pesos, MercadoPago y digitalización a mano. Ver la corrección de arriba. |
| Precisión de la DP | Se vende como estimación con aviso, no como medición clínica. |
| Derechos sobre las fotos | Los aporta la óptica bajo los términos de servicio. No se redistribuye material de marcas. |
| Costo de egreso de assets | Los GLB nunca van a Supabase Storage; siempre a R2. |
| Abuso del endpoint público (la clave es visible en el HTML) | Validación de dominio por `Origin` más caché. Ver la nota de seguridad en `02-arquitectura.md`. |
