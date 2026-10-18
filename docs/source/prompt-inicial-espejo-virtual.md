# Prompt inicial — Espejo Virtual

Usalo en la primera sesión de Claude Code dentro del repo vacío (o en un chat con herramientas de archivos), con `plan-espejo-virtual.md` presente en la raíz del repo o adjunto.

---

Vamos a iniciar el proyecto **Espejo Virtual**: un widget embebible para sitios de ópticas que permite probarse anteojos con la cámara, verlos en 3D sin cámara y estimar la distancia pupilar. Se vende como SaaS a ópticas, con digitalización 3D de marcos cobrada por unidad. El plan completo está en `plan-espejo-virtual.md`: leelo entero antes de hacer nada. Es la fuente de verdad inicial; no inventes nada que no esté ahí y marcá como `TBD` lo que falte definir.

## Qué quiero que armes ahora

Una estructura de documentación en Markdown que va a ser la memoria del proyecto entre sesiones. Tiene un **documento troncal** y documentos por área. Creá estos archivos con contenido real tomado del plan, no plantillas vacías:

### Troncal: `CLAUDE.md` (raíz del repo)

Es el documento que leés **siempre** al recibir cualquier prompt y que actualizás **siempre** al terminar. Tiene que caber en una pantalla y contener, en este orden:

1. **Qué es el proyecto**, en cinco líneas.
2. **Mapa de documentos**: lista de los archivos de `docs/` con una línea de qué contiene cada uno y cuándo consultarlo.
3. **Estado actual**: fase en curso, qué está hecho, qué está en curso, qué está bloqueado y por qué.
4. **Próximos tres pasos**, concretos y ordenados.
5. **Protocolo de trabajo** (ver más abajo), para que cualquier sesión futura lo respete sin que yo lo repita.
6. **Decisiones de diseño innegociables**, en una lista corta: procesamiento de video solo en el navegador, assets en R2 nunca en Supabase Storage, costo fijo mínimo, la óptica es dueña de sus registros desde el esquema, ningún modelo 3D se publica sin revisión humana, DP se presenta como estimación.

### Documentos por área, en `docs/`

- `docs/01-analisis.md` — Producto, problema que resuelve, usuarios (cliente final de la óptica, la óptica, yo como operador), modelo de negocio con las dos líneas de ingreso, flujos de cada usuario en texto plano, requisitos funcionales y no funcionales, competencia (Fittingbox, Jeeliz) y por qué competimos por mercado local y no por tecnología, riesgos con su mitigación.
- `docs/02-arquitectura.md` — Las tres capas (sitio de la óptica / plataforma / CDN), stack con costos, decisiones técnicas que hacen que el espejo se vea natural (oclusor, escala en milímetros reales, lentes como superficies planas, origen en el puente, HTTPS), estimación de DP y su precisión, licenciamiento por clave + dominio + estado de suscripción, esquema de tablas con políticas RLS, endpoints del Worker público, pipeline de digitalización paso a paso con el protocolo de fotos.
- `docs/03-diseno-visual.md` — Pantallas del panel de administración (lista con propósito y campos de cada una), interfaz del widget sobre el canvas 3D (selector de marcos, captura, resultado de DP, visor 360), estados y mensajes de error visibles para el usuario, guía de estilo mínima. Lo que todavía no esté definido va como `TBD` con la pregunta que hay que responder para definirlo.
- `docs/04-desarrollo.md` — Estructura del repo, setup local (HTTPS local para la cámara), comandos, convenciones de código, estrategia de testing, cómo se construye y publica `widget.js`, cómo se corre el post-proceso 3D en Blender headless, cómo se prueba el widget embebido en WordPress y en HTML pelada.
- `docs/05-roadmap.md` — Las cinco fases del plan con objetivo, tareas, criterio de salida y duración estimada; más un backlog de ideas no priorizadas.
- `docs/06-mantenimiento.md` — Operación: límites de las capas gratuitas que usamos y qué pasa cuando se superan, costos actuales, cómo se da de alta y de baja una óptica, cómo se rota una clave, qué hacer si el espejo de un cliente deja de funcionar, respaldo de la base y de los assets.
- `docs/07-decisiones.md` — Registro de decisiones (ADR). Cada entrada: fecha, decisión, contexto, alternativas descartadas, consecuencias. Cargá como primeras entradas todas las decisiones ya tomadas en el plan (costo trasladado al cliente, digitalización manual al inicio, Supabase proyecto separado, R2 para assets, etc.).
- `docs/08-bitacora.md` — Registro cronológico por sesión: fecha, qué se hizo, qué quedó pendiente, qué dudas surgieron. La primera entrada es esta sesión.

## Protocolo de trabajo (va en `CLAUDE.md` y lo cumplís siempre)

Al recibir un prompt:
1. Leer `CLAUDE.md` completo.
2. Leer los documentos de `docs/` que el mapa indique como relevantes para la tarea.
3. Si el prompt contradice una decisión registrada en `docs/07-decisiones.md`, señalarlo antes de hacer nada y preguntar si estamos revirtiendo la decisión.

Al terminar un trabajo:
1. Actualizar la sección "Estado actual" y "Próximos tres pasos" de `CLAUDE.md`.
2. Actualizar los documentos de `docs/` afectados por lo que se hizo.
3. Registrar toda decisión nueva en `docs/07-decisiones.md`.
4. Agregar la entrada de la sesión en `docs/08-bitacora.md`.
5. Cerrar la respuesta con un resumen de tres líneas: qué se hizo, qué documentos se tocaron, qué sigue.

## Cómo quiero que trabajes en esta sesión

- Primero mostrame la estructura propuesta en una lista y hacé como máximo tres preguntas si algo del plan te resulta ambiguo. Después creá todo.
- No agregues tecnologías, servicios ni dependencias que no estén en el plan. Si creés que falta algo, proponelo en `docs/07-decisiones.md` como "pendiente de decisión", no lo asumas.
- Todo en español rioplatense. Nombres de archivos y de código en inglés.
- Terminá la sesión aplicando el protocolo de cierre, incluyendo la primera entrada de la bitácora.
