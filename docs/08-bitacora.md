# 08 — Bitácora

Registro cronológico por sesión. La entrada más nueva va arriba.

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

**Hunyuan3D:** no se arrancó. Necesita fotos reales de 3 marcos (frente, perfil, arriba y tres cuartos, fondo blanco; protocolo en `02-arquitectura.md`) y una cuenta de Colab o Kaggle. Eso lo tiene que conseguir Sebastian.

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
