# 08 — Bitácora

Registro cronológico por sesión. La entrada más nueva va arriba.

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
