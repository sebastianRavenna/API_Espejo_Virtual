# 03 — Diseño visual

Reglas del plan sobre diseño:

- La UI del **panel** se diseña con Claude Design recién en la Fase 3, cuando las tablas estén cerradas. Hasta entonces el panel es mínimo y funcional.
- La UI del **widget** se hace en código, sobre el canvas 3D, no en mockups.

Este documento lista qué pantallas existen y qué datos muestra cada una. Lo visual (colores, tipografía, layout) está casi todo en `TBD`.

## Panel de administración

### Fase 2: panel mínimo (piloto)

| Pantalla | Usuario | Propósito | Campos y acciones |
|---|---|---|---|
| Login | Óptica, operador | Entrar con Supabase Auth | Email, contraseña. `TBD`: ¿magic link o contraseña? |
| Mis marcos | Óptica | Ver el estado de su catálogo | Por marco: miniatura, nombre, tipo (sol/lectura), medidas (calibre-puente-patilla), estado (`pending` / `ready` / `rejected`). `TBD`: ¿se muestra el motivo del rechazo? El esquema no tiene campo para eso. |
| Entregar marco (formulario) | Óptica | Mandar fotos y medidas sin WhatsApp | Nombre, tipo, calibre (mm), puente (mm), patilla (mm), cuatro fotos (frente, perfil izquierdo, arriba, tres cuartos) con la guía visual del protocolo. Las fotos van a R2. `TBD` (P-10): ¿el formulario es parte del panel con login o es un link aparte? |
| Snippet | Óptica | Copiar el código para su sitio | `<script src="…/widget.js" data-key="…">` con botón "Copiar" e instrucciones cortas para WordPress y HTML. |
| Ópticas (operador) | Operador | Alta y estado de cuentas | Nombre, clave, dominios permitidos, estado (`trial` / `active` / `suspended`), dueño. Acciones: crear, cambiar estado, rotar clave. |
| Revisión de modelos (operador) | Operador | Aprobar o rechazar modelos | Marco, fotos fuente, visor 3D del GLB, botón "Probar en espejo", acciones Aprobar (`ready`) y Rechazar (`rejected`). |

`TBD`: ¿las pantallas del operador viven en el mismo panel (mismo sitio, distintos permisos) o se manejan desde el dashboard de Supabase durante el piloto? Lo segundo no requiere código.

### Fase 3: panel completo (con Claude Design)

| Pantalla | Propósito | Campos |
|---|---|---|
| Alta de cuenta | Autoregistro de la óptica | `TBD`: nombre de la óptica, email, sitio web, ¿CUIT? Pregunta: ¿qué datos fiscales hacen falta para facturar como monotributista? |
| Marcos | Gestionar el catálogo | Los de la Fase 2, más filtros por tipo y estado |
| Métricas por marco | Argumento comercial principal | Aperturas, pruebas, capturas y DP por marco y por período ("el modelo X lo probaron 300 personas este mes"). `TBD`: ¿qué períodos y qué gráficos? |
| Dominios permitidos | Controlar dónde funciona el widget | Lista editable de dominios. `TBD`: ¿la óptica los edita o solo el operador? (ver `02-arquitectura.md`) |
| Snippet | Igual que en la Fase 2 | Más el link al plugin de WordPress |
| Facturación | Estado del abono y los cargos por marco | `TBD`: depende del modelo de cobro (transferencia vs. MercadoPago) y de los precios. |

## Interfaz del widget (sobre el canvas 3D)

| Elemento | Qué hace | Definido |
|---|---|---|
| Selector de marcos | Lista horizontal de miniaturas del catálogo; tocar una cambia el marco en el espejo o en el visor sin cortar la cámara | Función sí; layout `TBD` |
| Botón "Probar" | Pide permiso de cámara y abre el espejo | Sí |
| Visor 360 | `<model-viewer>` con el marco elegido, rotable, sin cámara. Es la vista por defecto mientras no se toque "Probar" | `TBD`: ¿es la vista por defecto? |
| Captura | Toma una foto del espejo (evento `snapshot`). Se queda en el dispositivo | `TBD`: ¿se descarga o solo se muestra? Compartir es Fase 5 |
| Medir DP | Pide quedarse quieto y mirar a la cámara, mide varios frames y muestra el resultado | Flujo sí; textos `TBD` |
| Resultado de DP | "DP estimada: XX mm", siempre con el aviso "Es una estimación; no reemplaza la medición de tu óptico" | Sí (texto final `TBD`) |
| Cerrar / volver | Apaga la cámara y vuelve al visor | Sí |

Durante el spike la UI es mínima pero prolija: termina en un video para mostrar a ópticas, así que no puede verse como un experimento. No se hacen mockups.

`TBD`, se decide al empaquetar `widget.js` al final de la Fase 0: ¿el widget se abre en un modal flotante (botón "Probátelos") o se incrusta en un contenedor de la página? Ese formato define cómo se integra con la ficha de producto de WooCommerce.

## Estados y mensajes de error visibles

| Situación | Qué ve el usuario (borrador) |
|---|---|
| Cargando modelo | Indicador de carga sobre el canvas |
| Sitio sin HTTPS | "El probador necesita una conexión segura (https). Avisale a la óptica." Esto debería detectarse antes de pedir la cámara. |
| Permiso de cámara denegado | "No pudimos acceder a la cámara. Podés habilitarla en la configuración del navegador o ver los marcos en 3D." Ofrece el visor 360. |
| Dispositivo sin cámara | Solo visor 360, sin el botón "Probar" |
| No se detecta una cara | "Acercate y mirá a la cámara con buena luz." |
| DP sin lectura estable | "No pudimos estimar tu DP. Probá con más luz y la cara de frente." |
| Catálogo vacío (clave inválida, dominio no permitido o tenant suspendido) | `TBD`. Pregunta: ¿el widget se oculta por completo o muestra un mensaje? Para el cliente final lo mejor es ocultarse; para diagnosticar conviene un aviso en la consola del navegador. |
| Falla al cargar un GLB | "No pudimos cargar este modelo." Se mantiene el resto del catálogo. |
| Navegador no compatible (sin WebGL) | `TBD` según la matriz de compatibilidad |

## Guía de estilo mínima

- **Idioma:** español, voseo rioplatense en los textos del widget. `TBD`: ¿voseo o neutro? Las ópticas fuera de Argentina podrían preferir neutro.
- **Tono:** corto y directo; nunca promete precisión clínica.
- **Aislamiento:** todo dentro del Shadow DOM, sin depender de fuentes ni estilos del sitio anfitrión.
- **Colores y tipografía del widget:** `TBD`. Pregunta: ¿el widget toma el color de marca de cada óptica (configurable por tenant, lo que cambia el esquema) o usa una paleta neutra común?
- **Marca "powered by":** `TBD`. Pregunta: ¿se muestra la marca del producto en el widget? Jeeliz vende como ventaja no mostrarla.
- **Panel:** se define con Claude Design en la Fase 3.
