# 08 — Bitácora

Registro cronológico por sesión. La entrada más nueva va arriba.

---

## 2026-10-21 — Sesión 6 (continuación): primera migración

**Qué se hizo**
- Sebastian aprobó el modelo de datos v2 (**ADR-037**) y creó el proyecto en "Produccion de Apps".
- `supabase/migrations/20261021000000_initial_schema.sql`: las tres tablas con `check`, RLS por operación (la óptica lee lo suyo, solo el operador escribe), `is_operator()`, `resolve_tenant()` (interna), `get_catalog()` y `log_events()` como `security definer` con `search_path` vacío, `updated_at` por trigger y permisos explícitos (`anon` solo ejecuta las dos funciones públicas).
- Se probó en un Postgres 16 local, con un stub de los roles y del esquema `auth` de Supabase (`supabase/tests/`). Pasaron las 14 pruebas: no se puede publicar un marco sin revisión, el formato de los dominios se valida, el comodín funciona y un sufijo engañoso (`evil-optica-a.com.ar`) no pasa, una clave mala, un dominio ajeno o un tenant suspendido devuelven catálogo vacío, `anon` no lee tablas, la óptica ve solo lo suyo y no escribe, el operador ve y escribe todo, y `log_events` descarta los eventos inválidos y los marcos de otro tenant.
- **No se aplicó en Supabase:** el conector de esta sesión solo ve la organización Raven-Net.
- P-03: no se usa `raven-net.com.ar` (DNS en Vercel); más adelante, un `.com.ar` nuevo, una vez que el producto tenga nombre.

- No se pueden conectar las dos organizaciones de Supabase a la vez y Sebastian prefiere dejar Raven-Net. **Sebastian aplicó la migración en el SQL Editor.** Claude no la puede verificar.
- `supabase/seed_dev.sql`: un tenant de desarrollo con los seis marcos, probado en local (`get_catalog` devuelve los seis en orden).
- Conexión con Cloudflare: hoy la red del entorno bloquea `api.cloudflare.com`. Pasos en `04-desarrollo.md` (token en la configuración del entorno y dominio permitido).

**Pendiente**
- Sebastian: correr `seed_dev.sql` y el Security Advisor; cargar el token de Cloudflare y habilitar la red.

---

## 2026-10-21 — Sesión 6: arranque del backend (modelo de datos, sin código)

**Qué se hizo**
- Sebastian: el reflejo de las lentes con cámara real "no se ve para nada bien"; se sigue con la API y se revisa después (tarea en `05-roadmap.md`).
- Sebastian: la DP da resultados distintos en cada medición, con hasta 4 mm de diferencia; primero tiene que ser repetible. Queda como tarea de la Fase 0, con una primera sospecha: la corrección de cerca a lejos.
- Plan de la Fase 1 (esquema → Worker → conectar el widget → R2). Se revisaron los proyectos Supabase de la cuenta: no había uno para el Espejo.
- Decisiones: Supabase de desarrollo en la organización gratuita "Produccion de Apps" y transferencia a la paga antes del piloto (**ADR-034**, enmienda ADR-005, con objeciones anotadas: pausa por inactividad, sin backups). Operador por `app_metadata.role` (**ADR-035**, cierra P-08). Worker con la clave `anon` que solo ejecuta funciones `security definer` (**ADR-036**, cierra P-04).
- Revisión de la pantalla de creación del proyecto: desactivar "Automatically expose new tables", activar "Enable automatic RLS" y elegir São Paulo.
- **Modelo de datos v2** propuesto en `02-arquitectura.md`: rutas de R2 en vez de URLs, `check` en los estados, motivo de rechazo, registro de la revisión, marca de IA (P-16), visibilidad y orden, `render_params` para los marcos de prueba, sesión anónima y tipo de dispositivo en los eventos, y las funciones `get_catalog` y `log_events`. La Fase 3 (miembros, cobros, variantes) queda esbozada sin migrar (ADR-012).
- P-03: Sebastian propone un subdominio de `raven-net.com.ar`. Sirve y no cuesta nada si el DNS está en Cloudflare; queda abierto.

**Pendiente**
- OK de Sebastian al modelo v2 y creación del proyecto Supabase.
- Confirmar dónde está el DNS de `raven-net.com.ar`.

---

## 2026-10-21 — Reflejos de entorno en las lentes (sesión paralela a la 5)

**Qué se hizo**
- **Panorama "Lebombo" (P-18 → ADR-033):** con el OK de Sebastian se bajó el HDR 1k (1,48 MB, CC0) a `widget/public/models-dev/env/lebombo_1k.hdr` y se carga como entorno de reflejos (`widget/src/engine/env.ts`, `RGBELoader` + `PMREMGenerator` de three 0.113). Se gira media vuelta para que el ventanal quede en el reflejo de frente. El entorno sintético queda mientras carga o si falla.
- **Lentes curvas (curva base 6):** con lentes planas el reflejo se veía como un tinte beige parejo, porque una superficie plana refleja apenas unos grados del panorama. Sebastian aprobó curvarlas como una lente real (enmienda ADR-015): `blender/prototype_postprocess.py` arma cada lente con anillos concéntricos y la curva con radio 530 / curva (`--base-curve`, por defecto 6). Se regeneraron `hy-acetate`, `hy-metal` y `hy-sun`.
- **Tinte G-15 corregido:** el verde (0,16 / 0,19 / 0,13) se veía lechoso porque glTF guarda el color en espacio lineal; ahora es 0,03 / 0,038 / 0,024.
- `?light=` ahora regula la intensidad del entorno sobre el marco (por defecto 1).
- Verificado en el navegador con cámara simulada: en "IA · Sol" se ven formas del entorno (ventanal, reflejo del sol) que cambian de lugar al girar el anteojo; en "IA · Acetato" (lectura) el vidrio queda claro con brillos leves.

**Pendiente**
- Prueba con cámara real de Sebastian (sol y lectura, girando la cabeza).
- Pasar la curva de las lentes al script de Blender definitivo.

---

## 2026-10-20 — Sesión 4: funciones para escalar (planificación, sin código)

**Qué se hizo**
- Sebastian preguntó qué otras funciones suelen tener estos espejos (medición de cabeza, eliminación de montura, vista 360, forma de cara).
- Investigación de mercado (Fittingbox, GlamAR y otros). El backlog de `05-roadmap.md` suma 10 ideas, cada una con su dificultad sobre el stack actual.
- Correcciones: el visor 360 ya es parte del producto base (RF-03, brief §3.4 "Ver en 3D"), no una función a futuro. La "medición de cabeza" que ofrece el mercado es en realidad una guía de talle (ancho de cara contra ancho del marco).

- **Revisión en Claude Code (2026-10-21)** contra `07-decisiones.md` y el código, con seis correcciones aprobadas por Sebastian: (1) "Tinte de lentes" es baja solo si la lente es una pieza propia; hoy lo es en los marcos generados con IA, no en "Sol" ni "Metal" de Sketchfab, y en producción depende del script de Blender (ADR-015, ADR-033). (2) "Guía de talle": el ancho total del marco suma las terminales (~12 mm), y la precisión depende de la alerta abierta sobre la regla del iris. (3) "Modo kiosco": el licenciamiento valida el dominio (ADR-011), así que una óptica sin sitio necesita otra forma de validar. (4) Se quitaron los duplicados ("Foto para compartir" y "Recomendación por forma de cara"). (5) "Modo foto" dice "cargar desde el dispositivo, sin enviarla" (ADR-001). (6) El dato de las 59 patentes de Fittingbox quedó marcado como "a verificar".
- **Brief del widget (`09-brief-widget.md`), sección 5 "Crecimiento previsto"**, el mismo criterio que Sebastian ya le pasó a Claude Design: barra de acciones de 2 a 6 botones (con solución para el celular, por ejemplo un menú "más"), la tarjeta de resultado de la DP como componente reutilizable para otras mediciones (siempre con el aviso de ADR-010) y espacio previsto para una segunda fila de opciones debajo del selector de marcos. No se diseñan ahora: solo se pide que el layout no se rompa. No lleva ADR: es un criterio de diseño que se apoya en ADR-010 y ADR-031.
- **En paralelo, otra sesión de Claude Code** (commit `78211ba`) hizo de las lentes superficies de vidrio con Fresnel, con el reflejo graduado por tipo (sol 1,0, lectura 0,35, ajustable con `?reflect=`), registró **ADR-033** (amplía ADR-030) y dejó el panorama de entorno como **P-18**: propuesta "Lebombo" de Poly Haven (CC0, HDR 1k de 1,48 MB), esperando el OK de Sebastian. El prototipo de post-proceso ahora genera lentes planas (`--lens clear|tinted`). Falta la prueba con cámara.

**Pendiente**
- El backlog no se prioriza hasta el feedback del piloto (Fase 2).
- Sebastian: OK al panorama (P-18) y prueba con cámara de las lentes nuevas.

---

## 2026-10-19 — Sesión 3: empaquetado del widget (TypeScript + Vite, sin React)

**Qué se hizo**
- Sebastian eligió la opción (a) de P-13 (ADR-028), el formato **botón + modal** (ADR-029) y commitear `package-lock.json`.
- Proyecto nuevo en `widget/`: `package.json` con three 0.113.2, TypeScript 5.9.3 y Vite 6.4.4 (16 paquetes, antes 1.849); `tsconfig` estricto; `vite.config.ts` en modo librería → `dist/widget.js` (IIFE). Se borraron React, react-scripts, `serviceWorker`, `public/index.html` y el resto de CRA.
- HTTPS rehecho sin dependencias nuevas: `npm run cert` genera un certificado autofirmado con el openssl de Git, para localhost y las IP de la LAN. `NO_HTTPS=1` levanta por HTTP para el panel de Claude Code.
- Motor portado a TypeScript (`src/engine/`) como clase `TryOnEngine` con `start()` y `stop()`, con la misma lógica: escala por iris, DP de lejos, suavizado, oclusores e inclinación de 7°. MediaPipe se carga una vez por página; los GLB se cachean.
- UI nueva sin framework (`src/ui/`), en Shadow DOM y en español: botón "Probátelos", modal con pasos de carga, mensajes de error (permiso de cámara, sin cámara, sin https), selector de marcos, Medir DP, Foto, Grabar, aviso de privacidad y el diagnóstico de `?debug=1` con la verificación con tarjeta. Cerrar el modal (✕, Escape o clic afuera) apaga la cámara.
- `src/main.ts` se ubica a sí mismo (`document.currentScript`), inserta el botón después de su `<script>` y lee `data-key`, `data-label`, `data-target` y `data-models`.
- Página de desarrollo (`widget/index.html`, simula una ficha de producto) y HTML pelada (`test-pages/index.html`).

**Verificado en el panel de Claude Code (sin cámara real)**
- Typecheck limpio; build de 656 KB (169 KB comprimido), sin rastros de React.
- El botón aparece donde va el script, sin heredar la tipografía de la página. Sin cámara se muestra el mensaje de permiso. Con una cámara sintética (canvas), el modal carga los pasos, la escena, el GLB (mismas medidas en mm) y MediaPipe ("Graph successfully started running").
- Cerrar libera el canvas y la cámara; reabrir funciona sin recargar MediaPipe; cambiar de marco carga cada GLB sin errores. En celular (375 px), el modal ocupa toda la pantalla.
- **HTML pelada con el build:** el botón aparece entre los dos párrafos, en Shadow DOM, y el modal carga los modelos desde `models-dev/` al lado de `widget.js`.
- **Probado con cámara por Sebastian (PC y celular): funciona igual que antes de la migración.** Quedan ajustes finos, sin detallar todavía.

**Preguntas de Sebastian durante la sesión**
- Qué pedirle a su cliente y a las marcas para armar los GLB, y si las marcas suelen tener GLB (respuesta en el chat; resumen: pedir modelos 3D si existen, y si no, fotos de producto ortogonales y medidas).
- Si lo armado es "el diseño de la API" y si conviene pasarlo antes por Claude Design: es la UI funcional del widget, no la API (el endpoint es de la Fase 1). Según ADR-017, la UI del widget se hace en código; usar Claude Design para el widget sería un cambio a esa decisión y queda a su criterio.

**Pendiente**
- Probar en WordPress. Diseño visual del widget antes del video de 30 segundos.

**Arranque del diseño (2026-10-20)**
- Desvanecido de patillas y reflejo confirmados con cámara y commiteados (`05c615e`).
- Sebastian decidió: **color de marca de cada óptica** en el botón y los acentos (ADR-031; Claude recomendaba paleta neutra, objeción anotada) y **marca del producto discreta dentro del modal** (ADR-032). El esquema suma `tenants.brand_color`.
- Se escribió `docs/09-brief-widget.md`, el brief para Claude Design: qué es, restricciones (Shadow DOM, color de acento variable, cara despejada, privacidad, aviso de DP), pantallas y estados en escritorio y celular, incluido "Ver en 3D", y qué entregar (tokens, componentes, pantallas y HTML/CSS).

**Ajustes finos (pedidos de Sebastian tras la prueba con cámara)**
- **ADR-030:** el diseño visual del widget pasa a Claude Design (reemplaza en parte a ADR-017).
- **Patillas sobre el pelo o la oreja:** el seguimiento solo ve la cara, no orejas ni pelo, así que los oclusores invisibles no alcanzan. Técnica habitual en probadores: **desvanecer las patillas hacia atrás**. Se hace en el shader de cada material: entre 45 y 75 mm detrás del puente, la patilla desaparece con un difuminado (fragmentos descartados con un umbral por píxel, sin transparencia, así no hay problemas de orden con las lentes). Valores en `CFG.templeFade`, ajustables con `?fade=45,75`.
- **Reflejo de la pantalla (como Fittingbox):** el mapa de entorno estaba vacío (negro). Ahora es una habitación tenue con un rectángulo luminoso adelante (la pantalla) y un techo suave (`createScreenEnvironment`). En las lentes de sol aparece un reflejo suave arriba y el marco gana brillo. Intensidad `CFG.screenLight` = 4 (con 2,5 casi no se veía; con 6 el metal rosado se veía blanco), ajustable con `?light=`.
- Verificado sin cara en el panel: el motor congelado, con el anteojo ubicado a mano, muestra las patillas desvaneciéndose y el reflejo en las lentes. **Confirmado por Sebastian con cámara: quedan bien con los valores por defecto (45–75 mm, luz 4).**
- **DP:** en el celular le dio 62 mm y en la PC 58–59. Se le explicó qué es "(de lejos)". La diferencia entre dispositivos (otra cámara, otra óptica, otra distancia) supera lo que corrige la convergencia. Se le pidieron los números de `?debug=1` en el celular para separar la causa.

---

## 2026-10-18 — Sesión 2 (continuación): otros dos marcos y DP

**Qué se hizo**
- Se identificaron los dos GLB que faltaban renderizándolos en un visor temporal (ya borrado): `glasses.glb` (Marius.Eder) es **acetato negro grueso**, y `glasses (1).glb` (Lamis) es **metálico fino al aire**, con lentes verdosas. En `widget/public/models-dev/` se renombraron `acetate.glb` y `metal.glb`; la lista de descargas de `widget/README.md` usa esos nombres.
- Specs de corrección (tabla en `04-desarrollo.md`): el de acetato viene en decímetros y es coherente. El metálico tiene **unidades incoherentes** (frente 18,5 contra patilla 14,6): se escaló por el frente a 140 mm y las patillas quedan cortas. Es el caso que justifica escalar con calibre-puente-patilla (ADR-015). Verificado con los vértices: los tres miden 140 mm de frente, el puente queda en el origen y ninguno choca con el oclusor de cabeza (margen 2 % en los dos nuevos, contra 18 % en el de sol).
- Selector de marco: botones "Sol", "Acetato" y "Metal". Cada GLB se baja la primera vez que se elige y queda en memoria. El nuevo toma la pose del anterior, así que no salta.
- **DP estimada** (ADR-027): botón "Medir DP" con indicaciones mientras mide, resultado en mm y el aviso de ADR-010.
- UI: los botones bajan de línea en pantallas angostas (antes se salían del borde en el celular).

**No verificado:** nada de esto se pudo probar con cámara desde Claude Code; compila y la UI se ve bien sin video.

**Prueba con cámara de acetato, metal y DP (video de 41 s y capturas)**
- Acetato: bien de tamaño y posición, probablemente el más convincente. Al mirar abajo, las dos patillas (naranjas) suben por delante del pelo en las sienes: el límite de pelo y orejas, más visible por el grosor y el color.
- Metal: bien; las lentes verdosas con transparencia ayudan. Los extremos de las patillas se ven un poco sobre el pelo al girar.
- El tracking no se movió de la cara de Sebastian con otra persona pasando por detrás.
- **DP de Sebastian: nuestra app 58 mm; PDMeasure (también escala por iris) 58,2 de lejos y 55,2 de cerca; Auglio, que es lo que hoy tiene la óptica del piloto, 63–64.** No hay DP medida por un óptico, así que no se sabe cuál acierta.
- **El anteojo se vio "proporcionado" en la cara de Sebastian y en la de su hijo, más chica.** Con escala real (ADR-015) un marco de 140 mm debería verse grande en un chico, así que la regla del iris puede estar adaptándose a la cara. Dos hipótesis: (1) el modelo de iris de MediaPipe estima el tamaño del iris en proporción a la cara (un "a priori" aprendido), y entonces la regla no mide la persona; (2) el iris real de Sebastian es más grande que 11,7 mm (el rango adulto va de ~11 a ~12,5 mm), lo que bajaría su DP y agrandaría el anteojo en su cara. Las dos hipótesis invalidan la "precisión de 1 a 2 mm" que dice el plan: la sola variación del iris entre personas da ±2–3 mm.
- Se agregó un modo diagnóstico (`?debug=1`) que muestra el diámetro del iris en px, el ancho y el alto de cara calibrados en mm y la escala en px/mm.

**Segunda prueba con `?debug=1` (capturas de Sebastian y su hijo, adolescente)**
- Los números del recuadro de diagnóstico no salen en la grabación (solo se graba el canvas); faltan para cerrar la hipótesis de la regla.
- DP del hijo: 66, 62, 59 y 62 mm en cuatro mediciones; la de Sebastian, estable en 58 si está cerca. El hijo estaba más lejos de la cámara: el iris medía unos 12–14 px y un píxel de ruido mueve la DP 4–5 mm. Cambios en ADR-027: cámara a 1280×720, iris mínimo de 20 px, rechazo de mediciones dispersas (> 2 mm) e indicaciones en pantalla según la causa.

**Números de diagnóstico (texto copiado por Sebastian)**
- Sebastian: iris 15,8 px · ancho de cara 143 mm (205 px) · alto superior 110 mm · 1,57 px/mm.
- Hijo (adolescente): iris 19,7 px · ancho de cara 145 mm (243 px) · alto superior 106 mm · 1,68 px/mm.
- La app calibra a los dos con casi el mismo ancho de cara: eso explica que el anteojo se vea igual de proporcionado. No se sabe si es real, porque a esa edad la cara ya tiene casi el tamaño adulto. **No alcanza para confirmar ni descartar la hipótesis 1.**
- El iris de Sebastian (15,8 px) es chico para una cámara de 1280×720. Puede que la webcam no la soporte y entregue 640×480. Se agregó la resolución real al recuadro de diagnóstico.
- Nota: el "alto superior" sale ~110 mm (el landmark 10 está cerca del nacimiento del pelo). El valor de respaldo de 75 mm en `CFG.faceHeightMm` es bajo, pero solo se usa sin landmarks de iris.

**Prueba decisiva propuesta: tarjeta de 85,6 mm.** Una tarjeta tamaño ISO (SUBE, débito, DNI; mostrando el dorso, sin datos a la vista) mide siempre 85,6 mm de ancho. Apoyada plana contra la frente, de frente a la cámara y con `?debug=1` abierto, una captura de pantalla completa permite comparar el ancho de la tarjeta en píxeles con la escala de la app y con la distancia entre pupilas. Así se obtiene la DP y el ancho de cara reales, sin depender del iris. Si la tarjeta confirma que la regla del iris falla, la alternativa es calibrar con tarjeta, que es el método clásico de las apps de DP; costo: un paso más para el usuario.

**Tercera ronda de diagnóstico**
- Cámara confirmada a 1280×720. DP de Sebastian 59,3 mm con dispersión 1,5 mm: pasa el control de estabilidad y coincide con las mediciones anteriores (58–59). Es **estable**; falta saber si es **exacta**.
- Sebastian preguntó cómo ve la app la tarjeta: no la detecta. Se agregó al modo diagnóstico una **verificación con tarjeta**: botón "Congelar", dos clics en los bordes de la tarjeta, y la app compara la escala de la tarjeta (85,6 mm) con la del iris y muestra la DP y el ancho de cara calculados con cada una.

**Prueba con tarjeta (Sebastian, captura completa)**
- Resultado: tarjeta 232 px → 2,71 px/mm; iris 2,33 px/mm (−14 % contra la tarjeta). Con la tarjeta: DP 51,9 mm y cara de 119 mm; con el iris: DP 60,4 mm y cara de 139 mm.
- **La prueba no es concluyente.** DP 51,9 y cara de 119 mm son valores muy raros en un adulto. La causa es la perspectiva: a ~40 cm de la cámara, la tarjeta estaba sostenida delante de la frente y la frente ya está 1,5–2 cm por delante de las pupilas. Cada centímetro de diferencia agranda la tarjeta ~2,5 %, y el 14 % observado equivale a tener la tarjeta 5–6 cm más cerca de la cámara que los ojos.
- Lección para producto: calibrar con tarjeta en la cámara del usuario **también** es frágil. Exige la tarjeta apoyada en la frente, más distancia a la cámara y una corrección por la profundidad de la frente. No es una solución automática al problema del iris.
- Bug corregido en el modo diagnóstico: las marcas de los clics se dibujaban relativas a la ventana y, con la página scrolleada, aparecían sobre el título. La medición no estaba afectada: los clics cayeron en los bordes de la tarjeta. Ahora las marcas son relativas a la imagen, y la conversión de píxeles contempla `object-fit: cover`.
- Sebastian aclaró que la tarjeta estaba **apoyada en la frente**. Corrección por perspectiva: la frente está 15–20 mm por delante de las pupilas; con una webcam de 60–70° de ángulo horizontal a 1280×720 (f ≈ 900–1100 px), la distancia era de 35–43 cm, y la tarjeta se ve 4–5,5 % más grande que en el plano de los ojos. Escala corregida: 2,56–2,60 px/mm; pupilas a 141 px → **DP de 54–55 mm**, que no cambia con ninguna combinación de los supuestos.
- Quedan tres valores para la DP de Sebastian: **tarjeta corregida 54–55 mm · iris (app y PDMeasure) 58–60 mm · Auglio 63–64 mm.** Si la tarjeta acierta, la regla del iris le da un 9 % de más (iris real de ~10,7 mm, dentro del rango normal). Pero 54–55 mm es bajo para un hombre adulto (media ~64), así que tampoco se toma como verdad.
- **Conclusión:** la DP de la app es estable (58–60 mm en Sebastian); si hay error, es sistemático. Ninguna prueba casera puede validar cuál valor es exacto. La única referencia útil es la medición de un óptico: ~55 → hay que ajustar la regla del iris; ~59 → la regla está bien; ~64 → hay que entender qué usa Auglio.

**Segunda prueba con tarjeta (mejor apoyada) y comparación con PDMeasure**
- Nuestra app: tarjeta 3,09 px/mm, iris 2,87 px/mm (−7 %; la primera prueba había dado −14 %). DP sin corregir: tarjeta 54,7 mm, iris 58,8 mm. Con la corrección por perspectiva (frente 15–20 mm delante de las pupilas, distancia 32–39 cm), la DP con tarjeta queda en **57,3–57,7 mm**: coincide con el iris en 1–1,5 mm (~2 %). La primera prueba con tarjeta fue la excepción.
- PDMeasure con tarjeta: falló, porque sus marcadores quedaron sobre los ojos y no en la tarjeta (informa 69 mm de diferencia). Mostró su resultado por iris: 58,1 mm.
- Valores de Sebastian: tarjeta corregida 57,3–57,7 · nuestro iris 58,8 · PDMeasure 58,1 · **Auglio 63–64 (solo)**.
- **Sesgo de convergencia (error nuestro):** al mirar la cámara a ~35 cm los ojos convergen y las pupilas se acercan. La app mide DP de cerca a esa distancia, no DP de lejos, que es la que informan los ópticos. Con la pupila ~10 mm delante del centro de giro del ojo, la diferencia es ≈ 10 × DP / distancia ≈ 1,5–2 mm. DP de lejos estimada de Sebastian: **~60,5 mm**, y la brecha con Auglio baja de 5–6 mm a ~3 mm.
- Propuesta: corregir la convergencia antes de la Fase 5 (ADR-027 la había postergado). La distancia sale de la escala y de un ángulo de visión supuesto para la cámara; un error del 15 % en la distancia mueve la corrección ~0,3 mm.

**Corrección de convergencia implementada (aprobada por Sebastian)**
- La app muestra la DP de lejos (ADR-027). Verificado con los datos de Sebastian: 58,8 → 60,5 mm; con un ángulo de visión de la cámara de 60° a 78°, el resultado queda entre 60,3 y 60,9. La cuenta inversa devuelve la medición original. Con `?debug=1` se ven la DP de cerca medida, la de lejos y la distancia estimada.
- Panorama de Sebastian, en DP de lejos: nuestra app ~60,5 mm · Auglio 63–64 mm. La validación final sigue siendo la medición de un óptico.

**Próxima prueba propuesta (sin costo):** con `?debug=1`, anotar el ancho de cara calibrado de Sebastian y de su hijo; con una regla, medir el ancho real de cara de los dos (de pómulo a pómulo, a la altura de las orejas). Si el ancho calibrado sale parecido en los dos, se confirma la hipótesis 1. Para la DP, la única referencia válida es una medición del óptico (pupilómetro o regla), que la óptica del piloto puede hacer en un minuto.

**Resultado de la prueba de Hunyuan3D-2mv (P-02)**
- Sebastian lo corrió en Colab (T4 gratuita) después de resolver cuatro tropiezos de entorno (Pillow actualizada a mitad de sesión, import de `hy3dgen`, máquina reciclada por inactividad, `transformers` 5 contra 4). Salieron 4 GLB de 40.000 caras cada uno (~700 KB): uno por marco, más la variante `_swapped` del acetato.
- **Forma:** muy buena en los dos de acetato (RX5228 y Wayfarer): frente, bisagras, curva de las patillas y hasta el relieve del logo. El metálico fino (GU2813) se reconoce (ojo de gato, plaquetas, puente), pero con el aro y las patillas más gruesos que el real, y con "repisas" inventadas debajo de cada lente, sacadas del texto impreso en las lentes de muestra.
- `left` y `right` intercambiados dan casi la misma malla, así que el orden no importa para marcos simétricos. Se queda `d090` = `left`.
- Hunyuan entrega la malla ya con los ejes de ADR-015 (frente +Z, Y arriba), normalizada a un cubo de 2 unidades: **la escala real sale de las medidas**, como prevé ADR-015. Proporción: en el metálico, frente y patillas no cierran juntos (~8 %).
- **Lentes:** vienen como superficies sólidas. Se recortaron con un prototipo del post-proceso (`blender/prototype_postprocess.py`: numpy, Pillow y OpenCV). Usa los huecos transparentes de la foto de frente para borrar la lente, y lo que la foto muestra como fondo para borrar inventos; después escala a mm, ubica el origen en el puente y asigna material. Hizo falta alinear la malla con la foto por búsqueda (escala y corrimiento vertical), porque las fotos de producto se toman un poco desde abajo. Quedan bordes irregulares alrededor de las lentes y, en el acetato, dos restos donde la patilla se ve a través de la lente.
- Cargados en el espejo como "IA · Acetato", "IA · Metal" e "IA · Sol" (`widget/public/models-dev/hy-*.glb`, fuera del repo). **Falta probarlos con cámara.**
- Sin textura: el modelo de forma no la genera, y el material se asigna a mano. Hunyuan3D-Paint necesita ~16 GB y la T4 tiene 15: sin probar.

**Prueba con cámara de los marcos generados con IA (video de Sebastian, 2026-10-19)**
- **IA · Sol:** excelente; un Wayfarer creíble, de tamaño correcto y bien apoyado. Se ve mejor que el modelo de sol de Sketchfab.
- **IA · Acetato:** forma correcta, pero tenía dos trozos negros dentro de las lentes, arriba en las esquinas. Eran la patilla que se ve a través de la lente en la foto y que el recorte no tomó como lente.
- **IA · Metal:** el más flojo; el aro se veía oscuro y sucio, con bordes serruchados, y más grueso que el real.
- Correcciones en el prototipo: (1) cada hueco de lente de la foto se rellena por su envolvente convexa, así que lo que se ve a través de la lente también cuenta como lente. Eso limpió los trozos del acetato y la mayoría de los restos del metal. (2) El metal pasó de 100 % a 35 % metálico: el espejo no tiene mapa de entorno y un metal puro refleja negro. El arreglo de fondo es un entorno de iluminación real (backlog de realismo). (3) Se agregó un filtro de piezas sueltas, que en estas mallas no encontró nada: los restos estaban pegados al aro. Falta volver a ver Acetato y Metal con cámara.
- **Patillas en diagonal hacia arriba (lo detectó Sebastian; Claude no lo había señalado):** de costado, las patillas de todos los marcos suben desde la bisagra y terminan arriba de la oreja, metidas en el pelo; al mirar abajo suben más. Causa: la orientación toma como vertical la línea frente-mentón (landmarks 10 y 175), que está echada hacia atrás respecto de la vertical real de la cabeza. Los modelos tienen las patillas derechas, así que el error es del seguimiento. Corrección: giro del anteojo alrededor del puente (`CFG.pitchCorrectionDeg`, 15° inicial, a ojo sobre el video), regulable en vivo con `?pitch=<grados>`. Efecto secundario: el frente se inclina con la parte de abajo hacia adelante, al revés del ángulo pantoscópico real. Si el valor que hace falta es grande, conviene pasar a la matriz de pose de MediaPipe (`outputFacialTransformationMatrixes`), que da la orientación anatómica de la cabeza.
- Prueba con 15° (capturas de Sebastian): se pasó y las patillas bajaban hacia la mandíbula. Sin corrección subían ~8–10° y con 15° bajaban ~7–8°: se dejó en **7°**. **Confirmado por Sebastian con cámara: las patillas quedan bien.** Las mismas capturas confirman que "IA · Metal" ya se ve rosado claro y que "IA · Acetato" tiene las lentes limpias.

**Hunyuan3D:** antes de esta prueba no se había arrancado.
- Primer marco real para la prueba (fotos de Sebastian): ojo de gato metálico fino, negro y dorado, con lentes transparentes. Tomas recibidas: tres cuartos de frente, frente y tres cuartos desde atrás; fondo blanco y luz pareja, 2000×2000. **Faltan:** perfil a 90°, vista desde arriba y las tres medidas de la patilla. Es el caso más difícil para la IA (metal fino y lentes transparentes): sirve como prueba de peor caso.
- **Protocolo de fotos verificado:** el ejemplo oficial de Hunyuan3D-2mv (`examples/shape_gen_multiview.py`, Hugging Face `tencent/Hunyuan3D-2mv`) usa las vistas `front`, `left` y `back`, y solo genera forma (la textura es otro paso, Hunyuan3D-Paint). Necesita ~6 GB de VRAM para la forma y ~16 GB con textura. El protocolo de `02-arquitectura.md` (frente, perfil izquierdo, arriba, tres cuartos) no coincide → P-15.
- **Licencia de Hunyuan3D 2.0 (Tencent Hunyuan 3D 2.0 Community License):** uso comercial permitido; excluye la Unión Europea, el Reino Unido y Corea del Sur; exige licencia aparte por encima de 1 millón de usuarios mensuales; prohíbe usar las salidas para entrenar otros modelos; y la Política de Uso Aceptable (ítem 12) pide **identificar claramente el contenido generado por máquina cuando se publica** → P-16.
- **Marcos de prueba sin esperar al cliente:** Edel-Optics publica fotos de producto sin fondo, nombradas por ángulo (`-d000` frente, `-d090` y `-d270` costados, `-d180` atrás), hasta 2000 px, con medidas en la ficha. Elegidos: **Ray-Ban RX5228 5405** (acetato negro, 53□17-140), **Guess GU2813-058** (metálico fino de ojo de gato, rosado/dorado, 56□16-140, parecido al marco del cliente) y **Ray-Ban Wayfarer RB2140 901** (sol, acetato, lentes G-15, 50□22-150). Son fotos con derechos de las marcas: solo para la prueba interna, no se publican ni se muestran a ópticas.
- Con OK de Sebastian se bajaron las 12 fotos (3 marcos × 4 vistas, 2000×1334 px, 488 KB) a `models-dev/hunyuan-test/`, que está fuera del repo. El servidor las entrega en WebP aunque la URL diga `.jpg`, así que se guardaron como `.webp`. Verificadas a la vista: `d000` frente, `d090` y `d270` costados, `d180` atrás. El README local de la carpeta tiene medidas, fuentes y el código de uso. No está claro de qué lado espera Hunyuan la vista `left`: probar `d090` y, si la malla sale espejada, `d270`.
- **Notebook de Colab** (`notebooks/hunyuan3d_mv_test.ipynb`): la PC de Sebastian no tiene GPU NVIDIA, así que la prueba va en Colab con una T4 gratuita. El notebook instala Hunyuan3D-2, sube `models-dev/hunyuan-test.zip`, quita el fondo blanco (umbral 245, ajustable; muestra una vista previa para verificar las patillas finas), genera la forma con las 4 vistas (el código acepta `front`, `left`, `back` y `right`, y recentra cada vista por su alfa, por eso hace falta transparencia), limpia la malla, para el primer marco genera además una versión con los costados intercambiados, muestra vistas rápidas y descarga los GLB. Verificado contra el código de Hunyuan3D (imports, `from_pretrained`, entrada como diccionario de imágenes PIL); el JSON y las celdas de Python son válidos. **No se ejecutó**: no hay GPU acá.
- Primera corrida en Colab (Sebastian): la celda 4 falló con `TypeError: function takes exactly 2 arguments (1 given)` dentro de `ImageFilter.MaxFilter`. Causa: la instalación de la celda 2 actualizó Pillow con la sesión ya cargada, y quedaron mezcladas dos versiones. Corrección: la celda 2 reinicia la sesión al terminar (`os.kill(os.getpid(), 9)`, patrón habitual en Colab), y la dilatación del alfa usa `cv2.dilate` en lugar del filtro de Pillow. Probado localmente con las 12 fotos: los marcos quedan enteros, incluidas las patillas finas del metálico; las lentes transparentes quedan transparentes, lo que no importa porque se reemplazan (ADR-015).
- Después del reinicio, la celda 5 dio `ModuleNotFoundError: No module named 'hy3dgen'`: la instalación editable (`pip install -e .`) no quedó registrada, o algo falló en silencio. Colab ya usa Python 3.13. Corrección: la celda 5 agrega `/content/Hunyuan3D-2` a `sys.path` antes de importar. Si aparece otra dependencia faltante, se instala aparte. También se ajustó la celda 3 para que, tras un reinicio, reuse las fotos ya descomprimidas.
- El `No module named 'hy3dgen'` persistió porque la sesión había quedado inactiva y Colab **recicló la máquina**: no estaban ni el repo clonado ni las dependencias (`trimesh`, `pymeshlab`, `pygltflib`, `xatlas`). El notebook ahora avisa que, si la sesión queda inactiva, hay que volver a empezar desde la celda 2, y la celda 5 llama a `importlib.invalidate_caches()` por si la ruta se agregó antes de que existiera la carpeta. Se le reenvió a Sebastian el notebook corregido para empezar de cero.
- Con la máquina nueva, la celda 5 bajó el modelo (9,86 GB, ~2 min) pero falló al cargarlo: `Error(s) in loading state_dict for SingleImageEncoder`. El checkpoint usa los nombres de parámetros de DINOv2 de `transformers` 4.x (`attention.attention.query`, `mlp.weights_in`) y Colab trae la 5.x (`q_proj`, `gate_proj`). Corrección: `pip install "transformers>=4.48,<5"` al final de la celda 2, antes del reinicio. Si no alcanza, fijar `transformers==4.49.0`. Lección para el pipeline (Fase 4): fijar versiones exactas de las dependencias de Hunyuan3D.
- Inconsistencia en el repo de Hunyuan3D: el encabezado de `setup.py` habla de "TENCENT HUNYUAN NON-COMMERCIAL LICENSE", pero el archivo `LICENSE` es la licencia comunitaria que permite uso comercial (fuera de la UE, el Reino Unido y Corea del Sur). Vale el `LICENSE`; conviene confirmarlo antes de usarlo en producción (P-02). Necesita fotos reales de 3 marcos (frente, perfil, arriba y tres cuartos, fondo blanco; protocolo en `02-arquitectura.md`) y una cuenta de Colab o Kaggle. Eso lo tiene que conseguir Sebastian.

**Pregunta de Sebastian sobre el LICENSE:** el que falta es el del repo original, y solo su autor puede agregarlo; nuestra copia ya tiene `widget/LICENSE-UPSTREAM.md`. Otra cosa es la licencia de **nuestro** repo: hoy no tiene ninguna, lo que en la práctica equivale a "todos los derechos reservados". Si se quiere dejarlo explícito, es una decisión de Sebastian (`TBD`).

---

## 2026-10-18 — Sesión 2: Fase 0, primer día del spike

**Qué se hizo**
- **Licencia:** el repo original no tiene archivo `LICENSE` (GitHub: "sin licencia"); el README dice MIT. Sebastian decidió copiar igual y documentarlo (ADR-023). Se excluyeron GSAP (licencia propia, no usado), jQuery (no usado) y los modelos `public/obj/*` (sin procedencia, no usados).
- **Copia en `widget/`** desde el commit `a1413d5`, sin `.git`. Crédito y licencia en `widget/README.md` y `widget/LICENSE-UPSTREAM.md`. El `CLAUDE.md` del autor se renombró a `CLAUDE.upstream.md` para que Claude Code no lo tome como instrucciones de este proyecto; su README quedó como `README.upstream.md`.
- **Hallazgo:** el repo es JavaScript + React 16 + react-scripts 3.4 + three 0.113, no TypeScript + Vite como decía el plan. Queda como P-13.
- **HTTPS local** con el certificado autofirmado de react-scripts (ADR-024), sin dependencias nuevas. `npm install` del original anduvo en Node 22.13. Cambios necesarios: los scripts `start`/`build` usaban sintaxis de bash (no andan en Windows) y el campo `homepage` servía todo bajo `/basic-virtual-tryon-glasses/`. Comandos documentados en `04-desarrollo.md`. El server responde por `https://localhost:3000` y por `https://192.168.100.4:3000` (verificado con `curl` desde la PC). La IP que muestra react-scripts (`192.168.56.1`) es la de VirtualBox y no sirve.
- **GLB:** Sebastian eligió `sun_glasses.glb` (de los tres que hay en `models-dev/`). Nuevo cargador `widget/src/engine/glbGlasses.js`; se borró el procedural (`glasses.js`). Correcciones para ADR-015: cm → mm, rotación −90° en Y, origen al puente (tabla en `04-desarrollo.md`). La escala ahora sale del iris (ADR-025).
- **Fondo lavado:** el tone mapping ACES del renderer se aplicaba también al video de la cámara. Se desactivó para el video (`toneMapped: false`, una línea en `scene.js`). Era lo que más hacía ver el anteojo como pegado encima.
- **Verificación visual:** el panel de navegador de Claude Code no da cámara ni acepta el certificado. Con permiso de Sebastian se bajó la foto de muestra de MediaPipe (`portrait.jpg`) y se usó como cámara falsa en una página temporal, por HTTP en el puerto 3001. Página y foto se borraron al terminar.

**Cómo se ve (sobre foto fija, de frente)**
- Escala y posición: bien. El frente queda del ancho de la cara a la altura de las sienes, las lentes tapan los ojos y el puente se apoya en la nariz. Modelo: 156,6 mm de ancho con las patillas abiertas, 124 mm el frente.
- Más "sticker" que natural, por el modelo más que por el tracking: lentes negras opacas de una sola malla, sin reflejos ni transparencia (ADR-015 pide planos de vidrio: es trabajo del script de Blender); sin sombra del marco sobre la cara; marco metálico muy fino y plano en la iluminación.
- **No se pudo probar:** giro de cabeza, oclusión de patillas, estabilidad (jitter) y rendimiento en el celular. Una foto fija no sirve para eso. Lo tiene que probar Sebastian con la cámara.

**P-14 (dónde viven los GLB de prueba): resuelto → ADR-026**
- Sebastian decidió: fuera del repo. Se creó el `.gitignore` de la raíz (`models-dev/`, `widget/public/models-dev/`) y la lista de descargas de los tres GLB en `widget/README.md`. La recomendación de Claude (commitear los 3) quedó anotada como objeción en el ADR.

**Propuesta original de P-14**
- Recomendación: commitear solo los 3 GLB de referencia en `widget/public/models-dev/` (un solo lugar: se borra `models-dev/` de la raíz), con autor y licencia CC-BY en `widget/README.md`, y poner en `.gitignore` cualquier otro GLB. Costo: ~7 MB para siempre en el historial de git. Alternativa: `.gitignore` y una lista de descargas (cada uno los baja de Sketchfab con su cuenta; no es reproducible).
- Hoy hay dos copias de `sun_glasses.glb` (raíz y `widget/public/models-dev/`) hasta que se decida.

**Prueba con cámara real (Sebastian, PC y celular)**
- Oclusión: las patillas se esconden bien al girar, pero quedan por delante de la oreja y del pelo. El oclusor es solo el óvalo de la cara: no cubre ni orejas ni pelo. Es ajuste fino; queda para después (ver `05-roadmap.md`).
- Lag: al moverse rápido tardaba bastante en acomodarse. Causa: suavizado heredado del original, con pisos de 15–20 % por frame. Se subieron a 35–40 %, hasta 90 % con movimiento rápido.
- Escala: se agrandaba y achicaba al acercarse. Causa: la mediana de 15 frames sobre px/mm (ADR-025). Se cambió el método: el iris calibra el ancho de cara en mm y la escala sale de cada frame.
- Posición: quedaba un poco bajo. El puente se subió 3 mm.
- Celular: se comporta igual que en la PC (Chrome con certificado autofirmado: anda).
- **Falta volver a probar** con estos cambios; desde Claude Code no hay cámara.

**Segunda prueba con cámara (video de 13,6 s de Sebastian)**
- "Anduvo muchísimo mejor": sigue bien en giros, inclinaciones y al acercarse; la altura quedó bien.
- Quedaba la imagen de la cámara pálida en todo el video. Causa: la textura del video estaba declarada lineal y el renderer convierte a sRGB, así que se aclaraba dos veces. Se declaró `sRGBEncoding` (una línea en `scene.js`). Falta confirmar a la vista.

**Tercera prueba con cámara (video de 8,3 s)**
- Color: mejor.
- Al girar, el anteojo se achicaba: el ancho de mejilla a mejilla se acorta en un giro. Ahora se usa la mayor de dos escalas, ancho y alto de la cara, ambas calibradas con el iris (ADR-025).
- A destiempo: el fondo se dibujaba con el video al instante y el anteojo con la posición del cuadro anterior. Ahora cada cuadro se dibuja en la misma tarea que `detectForVideo`, así que video y anteojo corresponden al mismo cuadro. Costo: el video en pantalla se demora lo que tarda MediaPipe (decenas de ms).
- De perfil completo el anteojo desaparece: MediaPipe pierde la cara. Es un límite del tracking, no se corrige.

**Cuarta prueba con cámara (captura)**
- Los tiempos mejoraron.
- Falla: al mirar abajo y a un costado, la patilla de atrás se veía sobre la frente y el pelo. El oclusor heredado es solo el óvalo de la cara, que termina en la frente. Se agregó un elipsoide invisible con forma de cabeza (`createHeadOccluder`, medidas en `CFG.headOccluder`), hijo del anteojo, así que hereda su pose y su escala en mm. Verificado con la geometría del GLB: ningún vértice queda adentro y la patilla más cercana pasa un 18 % por fuera, así que no tapa la patilla del lado de la cámara. Falta verlo con cámara.

**Quinta prueba con cámara (video): "perfecto"**
- Revisado cuadro por cuadro: sigue bien en giros, inclinaciones y cabeceos, sin cambios de tamaño y sin que asome la patilla de atrás. **El objetivo del primer día de la Fase 0 está cumplido.**

**Pendiente**
- ~~Inicializar git y hacer el primer commit~~: hecho. Sebastian creó el repo vacío en GitHub y Claude inicializó git (rama `main`), hizo el primer commit (`15b0fa0`, 44 archivos, sin `node_modules` ni GLB) y lo subió. `gh` no está instalado, por eso la creación del repo la hizo Sebastian.
- Sebastian: probar desde el celular (Chrome Android y, si hay, Safari iOS) y con la cámara de la PC girando la cabeza; abrir el issue de `LICENSE` en el repo original.
- Ajustar los offsets de `CFG` (2 mm adelante y 2 mm abajo) con la cámara real.
- Sugerencia menor: el `.gitignore` del original ignora `package-lock.json`. Para builds reproducibles conviene commitearlo; se decide con el primer commit.

---

## 2026-10-18 — Sesión 1 (continuación): primeras decisiones pendientes

**Qué se hizo**
- Los 12 pendientes se ordenaron según cuándo bloquean: Fase 0, Fase 1, piloto y más adelante.
- Se explicaron a Sebastian el concepto de spike, la columna `kind` y la diferencia entre Vercel Pro y Cloudflare Pages.
- P-06 resuelto: el spike va en `widget/` (ADR-020).
- P-01 resuelto: Cloudflare Pages, con costo cero verificado en la documentación oficial (ADR-021). Vercel Pro también servía; se eligió Pages para tener un solo proveedor y no atar el producto a otra suscripción.
- Corrección propia: la regla del proyecto ("nombres de archivos, tablas, variables y código en inglés") cubre los *nombres*, no los *valores* de una columna. P-05 es convención, no obligación; quedó reformulado en `07-decisiones.md`.

- P-05 resuelto: `sun | reading` (ADR-022).
- Sebastian preguntó si había que diseñar antes de entrar a Claude Code. No: según ADR-017, el diseño del panel espera a la Fase 3 y el del widget se hace en código. El spike lleva UI mínima pero prolija, porque termina en un video para ópticas. Lo único de diseño que se decide en la Fase 0 es el formato del widget (modal o incrustado), al empaquetar `widget.js`.

**Pendiente**
- P-03 (nombre comercial y dominio): tarea de Sebastian antes de la Fase 1.
- Subir el repo a GitHub y arrancar la Fase 0 en Claude Code.

---

## 2026-10-18 — Sesión 1: arranque de la documentación

**Qué se hizo**
- Lectura completa de `plan-espejo-virtual.md`, `prompt-inicial-espejo-virtual.md` e `instrucciones-proyecto-espejo-virtual.md`.
- Estructura propuesta y tres preguntas a Sebastian. Respuestas:
  1. Los tenants en `trial` reciben catálogo (ADR-018).
  2. Esta carpeta es la raíz del repo; Sebastian lo sube a GitHub (ADR-019).
  3. Investigar a fondo Fittingbox y Jeeliz.
- Investigación de competencia: Fittingbox, Jeeliz y, además, Auglio, que no estaba en el plan y resultó ser el competidor más cercano al posicionamiento local.
- Creación de `CLAUDE.md` y `docs/01` a `docs/08`, con contenido del plan.
- Los tres documentos originales se movieron a `docs/source/`.

**Hallazgos que corrigen o completan el plan**
- "Español + WordPress/WooCommerce" ya no diferencia: Fittingbox y Auglio los cubren. → P-09.
- La vista pública solo para tenants "activos" contradecía el trial gratis. → ADR-018.
- El plan prevé `try_on_events`, pero no dice cómo escribe en ella un widget anónimo. → P-04.
- Un Cloudflare Worker no puede correr Blender; en la Fase 4 "worker" tiene que ser otra cosa. → P-11.
- La baja de un tenant borra filas en cascada, pero no los objetos de R2. → Documentado en `06-mantenimiento.md`.
- `frames.kind` usa valores en español, contra la regla de código en inglés. → P-05.
- El dominio del producto tiene un costo anual que el plan no menciona. → P-03.

**Pendiente**
- 12 pendientes de decisión en `07-decisiones.md` (P-01 a P-12). P-06 se resuelve al arrancar la Fase 0.
- Inicializar git y subir a GitHub (lo hace Sebastian).
- Empezar la Fase 0.

**Dudas abiertas**
- Precios del abono y del cargo por marco, y duración del trial.
- Mercado inicial (AMBA / Argentina / LATAM).
- Cómo se vincula un producto de WooCommerce con un `frame`.
- Los límites de las capas gratuitas marcados "(verificar)" en `06-mantenimiento.md`.
