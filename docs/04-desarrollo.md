# 04 — Desarrollo

El spike arrancó el 2026-10-18: el código está en `widget/`. Lo demás combina lo que dice el plan con lo que queda `TBD`.

## Estructura del repo

Esta carpeta es la raíz del repo: https://github.com/sebastianRavenna/API_Espejo_Virtual (rama `main`). El código del spike va en `widget/` (ADR-020). El resto de la estructura es una propuesta:

```
/
├── CLAUDE.md                 # documento troncal (leer siempre)
├── docs/                     # memoria del proyecto (01–08)
│   └── source/               # plan, prompt inicial e instrucciones originales (congelados)
├── widget/                   # widget.js: TypeScript + Vite, sin React (ADR-028)
├── test-pages/               # HTML pelada para probar el embed del build
├── worker/                   # endpoint público (Cloudflare Worker, TypeScript)
├── panel/                    # panel de ópticas (TypeScript); framework TBD
├── supabase/migrations/      # SQL de esquema y RLS
├── blender/                  # scripts de post-proceso (Python)
├── notebooks/                # notebooks de Colab para la generación 3D (Hunyuan3D, P-02)
```

`TBD`: el framework del panel. No está en el plan; se decide antes de la Fase 2 y se registra como decisión.

## Setup local

- **Stack del widget (ADR-028):** TypeScript + Vite, sin React. three.js 0.113.2 (la versión del repo original, para no cambiar el aspecto en la migración; actualizarla es P-17). 16 paquetes en total, versiones exactas en `widget/package-lock.json`, que se commitea.
- **Requisitos:** Node 22 (`widget/.node-version`; Vite 6 pide ≥ 20.19). npm 11. Para el certificado, el `openssl` que viene con Git para Windows. Blender: versión `TBD` (para `blender/`, más adelante).
- **Primera vez:** `cd widget`, `npm install` (unos segundos) y `npm run cert`, que crea un certificado autofirmado en `widget/.cert/` (fuera del repo) para localhost y las IP de la red local. Si cambia la IP de la PC, se vuelve a correr `npm run cert`.
- **HTTPS local es obligatorio:** sin HTTPS no hay cámara. `localhost` cuenta como contexto seguro en el escritorio, pero desde el celular por la LAN hace falta HTTPS de verdad (ADR-024).
- **MediaPipe** no se instala por npm: el widget lo baja en tiempo de ejecución de `unpkg.com` (`@mediapipe/tasks-vision@0.10.7`, JS + WASM) y el modelo `face_landmarker.task` de `storage.googleapis.com`. Hace falta internet. Si conviene servirlo desde nuestro CDN sigue `TBD` (ver "Build y publicación").
- Variables de entorno con secretos (URL de Supabase, claves, bucket de R2): `TBD`. Nunca se commitean.

### Probar en la PC

1. `cd widget` y `npm run dev`.
2. Abrir **https://localhost:3000** en Chrome. Aparece el aviso de certificado no válido: "Configuración avanzada" → "Continuar a localhost".
3. La página simula la ficha de un producto de una óptica. Tocar **"Probátelos"**: se abre el modal y recién ahí pide permiso de cámara. Al cerrar el modal, la cámara se apaga.

### Probar desde el celular (misma red Wi-Fi)

1. Con `npm run dev` corriendo, Vite muestra las direcciones "Network". La que sirve es la del adaptador Wi-Fi/Ethernet; `192.168.56.1` es VirtualBox y **no sirve** desde el celular. El 2026-10-18 la IP correcta era `192.168.100.4`.
2. En el celular abrir `https://<IP>:3000`, aceptar el aviso de certificado y dar permiso de cámara.
3. Si no carga: habilitar Node.js en el Firewall de Windows para redes privadas y verificar que la red Wi-Fi esté marcada como "Privada".

### Probar sin cámara (Claude Code)

El panel de navegador de Claude Code no acepta certificados autofirmados ni da cámara. Por eso `.claude/launch.json` tiene dos configuraciones por HTTP: `widget-http` (dev, puerto 3001) y `widget-plain` (build + HTML pelada, puerto 4174), que se levantan con `NO_HTTPS=1`. Para ejercitar el motor sin cara, se reemplaza `getUserMedia` por un canvas desde la consola: así se verifica que arranque la escena, cargue MediaPipe y los GLB, pero no el seguimiento de la cara.

## Comandos

Todos dentro de `widget/`:

| Tarea | Comando |
|---|---|
| Instalar dependencias | `npm install` |
| Crear el certificado HTTPS (una vez) | `npm run cert` |
| Dev server (HTTPS, LAN) | `npm run dev` → `https://localhost:3000` y `https://<IP-LAN>:3000` |
| Chequeo de tipos | `npm run typecheck` |
| Build de `widget.js` | `npm run build` → `widget/dist/widget.js` (+ `dist/models-dev/`) |
| Probar el build en una HTML pelada | `npm run preview:plain` → `https://localhost:4173` (sirve `test-pages/index.html` junto a `dist/widget.js`) |
| Dev del Worker | `TBD` |
| Aplicar migraciones | `TBD` |
| Post-proceso de un marco | `python blender/prototype_postprocess.py …` (prototipo, ver más abajo) |

## Estructura de `widget/`

```
widget/
├── index.html            # página de desarrollo: simula la ficha de producto de una óptica
├── src/main.ts           # entrada de widget.js: busca su <script>, crea el host y monta el widget
├── src/ui/widget.ts      # botón + modal en Shadow DOM, DP, foto, grabación, diagnóstico (?debug=1)
├── src/ui/styles.css     # estilos encapsulados en el Shadow DOM
├── src/engine/           # motor: engine.ts (clase con start/stop), frames.ts (catálogo y GLB),
│                         #   scene.ts, occluder.ts, mediapipe.ts, helpers.ts, constants.ts (CFG)
├── scripts/              # make-cert.mjs (HTTPS), copy-test-page.mjs (HTML pelada)
├── public/models-dev/    # GLB de prueba (fuera del repo, ADR-026)
└── vite.config.ts        # build en modo librería: un solo dist/widget.js (IIFE)
```

## Modelos 3D en el spike

- El widget carga el GLB con `GLTFLoader` (`widget/src/engine/glbGlasses.js`). Cada modelo tiene una "spec" con las correcciones para llevarlo a ADR-015: `unitToMm`, `bridge` (punto del puente en coordenadas del archivo) y `rotationY`. Son exactamente lo que después tiene que hacer el script de Blender.
- **Modo diagnóstico (`?debug=1`):** muestra la resolución real de la cámara, el iris en px, el ancho y el alto de cara calibrados, la escala y el giro. Tiene además una **verificación con tarjeta**: con una tarjeta tamaño ISO (85,6 mm, mostrando el dorso) apoyada plana en la frente, "Congelar" detiene la imagen; dos clics en los bordes de la tarjeta comparan su escala con la del iris y dan la DP y el ancho de cara según cada regla.
- **Inclinación de las patillas:** `CFG.pitchCorrectionDeg` (7°) corrige que la línea frente-mentón no sea la vertical real de la cabeza. Para afinarlo con la cámara: `https://localhost:3000/?pitch=10` (se combina con `&debug=1`).
- Los tres marcos están en `FRAMES` (`glbGlasses.js`) y se eligen con los botones "Sol", "Acetato" y "Metal". Cada GLB se baja la primera vez que se elige y queda en memoria.
- Al cargar, la consola muestra el tamaño resultante en mm (`[glasses] ... size mm (w x h x d)`): sirve para verificar la escala.
- La escala en pantalla sale de una regla: el diámetro del iris (11,7 mm) calibra el ancho de cara y el alto de la parte superior de la cara de la persona, en mm (medianas de 30 frames, solo con la cara de frente). En cada frame se toma la mayor de las dos escalas en píxeles, para que no se achique al girar ni al cabecear (ADR-025). El origen del modelo (puente) se apoya en el landmark 168 de MediaPipe (entrecejo, sobre el puente nasal). Los ajustes finos están en `CFG` de `widget/src/engine/constants.js`, en mm (ADR-025).
- **Los GLB de prueba no están en el repo (ADR-026).** Después de clonar hay que bajarlos a `widget/public/models-dev/` siguiendo la lista de `widget/README.md`; sin ellos el widget arranca pero no muestra anteojo. `models-dev/` (raíz) y `widget/public/models-dev/` están en `.gitignore`.

## Convenciones de código

- **TypeScript** en el widget, el Worker y el panel. **Python** en los scripts de Blender. **SQL** en las migraciones de Supabase.
- Nombres de archivos, tablas, columnas, variables y código en **inglés**. Textos visibles al usuario en español.
- Las unidades van en el nombre: `_mm` para milímetros (como en `eye_size_mm`).
- Convención 3D: origen en el puente, X hacia la sien, Y hacia arriba, Z hacia adelante, unidades en mm.
- El widget está en TypeScript estricto desde el 2026-10-19 (ADR-028). Los scripts auxiliares (`widget/scripts/`) son JavaScript de Node.
- Ninguna dependencia nueva sin registrarla antes como decisión en `07-decisiones.md`.
- Commits: `TBD` (convención de mensajes).

## Estrategia de testing

`TBD` en su mayor parte. El plan no define herramientas de testing, y no se agregan sin decisión. Mínimos que no requieren dependencias nuevas:

- **Spike / widget:** checklist manual en dispositivos reales (celular Android, iPhone, escritorio) con los tres GLB de referencia. Se verifica la oclusión de patillas al girar, la escala respecto de la cara y la DP comparada contra una DP medida por un óptico.
- **RLS:** consultas SQL con distintos usuarios (dueño, otra óptica, operador, anónimo), verificando que cada uno ve solo lo suyo.
- **Worker:** pedidos con clave válida/inválida, dominio permitido/no permitido y tenant `trial`/`active`/`suspended`.
- **Embed:** las dos páginas de prueba descriptas abajo.

`TBD`: ¿tests automatizados? Pregunta: ¿qué framework y desde qué fase?

## Build y publicación de `widget.js`

- Vite empaqueta todo en **un solo `widget.js`** (modo librería, formato IIFE): hoy pesa 656 KB (169 KB comprimido), casi todo three.js. Actualizar three (P-17) e importar solo lo que se usa debería achicarlo.
- El script se ubica a sí mismo, inserta un botón **"Probátelos"** justo después de su `<script>` (o dentro de `data-target`) y abre el probador en un **modal** (ADR-029). Todo vive en un **Shadow DOM** (`<espejo-virtual>`).
- Atributos del `<script>`: `data-key` (clave del tenant; todavía sin uso), `data-label` (texto del botón), `data-target` (selector donde montarlo) y `data-models` (URL base de los GLB; por defecto, `models-dev/` al lado de `widget.js`).
- En la URL de la página: `?debug=1` muestra el diagnóstico de la regla del iris y la verificación con tarjeta (y deja el motor en `window.__espejoEngine`); `?pitch=<grados>` ajusta la inclinación de las patillas; `?fade=<inicio>,<fin>` (mm) el desvanecido de las patillas; `?light=<n>` la intensidad del reflejo de la pantalla; `?reflect=<sol>,<lectura>` la intensidad del reflejo en las lentes según el tipo de marco (por defecto 1 y 0,35, ADR-033).
- **Lentes:** los materiales llamados `lens` (o los de `lensMaterials` en `FRAMES`) se reemplazan por vidrio con Fresnel (`createLensMaterial` en `frames.ts`).
- MediaPipe necesita su modelo `.task` y sus archivos WASM. `TBD`: ¿se sirven desde nuestro CDN o desde el de Google? Afecta la privacidad percibida y el costo de egreso.
- Se publica en Cloudflare Pages (ADR-021), en `https://cdn.<dominio>/widget.js` (P-03).
- `TBD`: versionado. Pregunta: ¿las ópticas cargan siempre `widget.js` (la última versión) o una versión fija (`widget.v1.js`)? Con la última versión, un bug llega a todos los clientes a la vez.

## Generación 3D de prueba en Colab (P-02)

La PC de desarrollo no tiene GPU NVIDIA (solo Intel integrada), así que Hunyuan3D se corre en Google Colab con una T4 gratuita.

1. Abrir https://colab.research.google.com → *Subir* → `notebooks/hunyuan3d_mv_test.ipynb`.
2. *Entorno de ejecución → Cambiar tipo → GPU T4*.
3. Ejecutar las celdas en orden. En la celda 3 se sube `models-dev/hunyuan-test.zip` (fotos de prueba, fuera del repo).
4. Revisar en la celda 4 que el fondo se haya quitado bien y en la celda 7 la forma generada; la celda 8 descarga los GLB.

Notas del código de Hunyuan3D verificadas el 2026-10-18: el pipeline multivista acepta `front`, `left`, `back` y `right` (orden "front, front clockwise 90, back, front clockwise 270"); recentra cada vista por su canal alfa, así que **las fotos tienen que tener fondo transparente** (el notebook quita el blanco); solo genera forma.

## Prototipo del post-proceso (sin Blender)

`blender/prototype_postprocess.py` adelanta los pasos 2 a 4 del pipeline en Python (numpy, Pillow, OpenCV) sobre la salida de Hunyuan3D-2mv. Borra las lentes usando la foto de frente y lo que esa foto muestra como fondo, escala a mm con calibre y puente, pone el origen en el puente y asigna un material:

```
python blender/prototype_postprocess.py <malla.glb> <foto_frente> <salida.glb> --eye 53 --bridge 17 --material acetate_black --lens clear|tinted
```

`--lens clear` (lectura) detecta las lentes como huecos transparentes de la foto; `--lens tinted` (sol) por el color del tinte (G-15). En los dos casos borra la lente de la IA y genera una superficie de vidrio plana por lente, como primitiva aparte con material `lens` (ADR-033). Supuesto de escala: ancho total del frente = 2 × calibre + puente + 12 mm de terminales. Hay que portarlo al script de Blender.

## Post-proceso 3D en Blender headless

Corre local, en la máquina de Sebastian:

```
blender --background --python blender/<script>.py -- <args>
```

El nombre del script y sus argumentos son `TBD`. Entradas previstas: el archivo generado por la IA, `kind`, `eye_size_mm`, `bridge_mm` y `temple_mm`. Pasos del script, según `02-arquitectura.md`:

1. Importar.
2. Reemplazar la zona de lentes por dos planos de vidrio.
3. Escalar a mm.
4. Origen en el puente y alinear ejes.
5. Exportar GLB comprimido.
6. Generar la miniatura.

### Correcciones que necesitó el primer GLB descargado

Registro para diseñar el script. `sun_glasses.glb` (Sketchfab, Long Nguyễn, CC-BY-4.0) vino así:

| Problema | Valor en el archivo | Corrección aplicada en el spike |
|---|---|---|
| Unidades | centímetros (frente de 12,4; ancho total 15,7 con patillas) | × 10 → mm |
| Ejes | frente mirando a **+X**, ancho sobre **Z**, Y arriba (el nodo raíz de Sketchfab ya pasa de Z-arriba a Y-arriba) | rotación −90° sobre Y → frente a +Z, ancho sobre X |
| Origen | en ningún punto útil (el centro de la caja queda entre las patillas) | trasladado al puente: cara trasera de la barra del puente, centrada (`[6.91, 0.87, 0.52]` cm en coordenadas del archivo) |
| Lentes | son parte de la misma malla y del mismo material que el marco; opacas, negras, sin transparencia | **sin corregir** en el spike; es el paso 2 del script (planos de vidrio) |
| Patillas | abiertas hacia afuera (ancho total 156,6 mm contra 124 mm del frente) | sin corregir; el oclusor las esconde, pero al girar puede notarse |
| Medidas | el archivo no dice calibre-puente-patilla | sin corregir; la escala real sale de las unidades del archivo, no de la patilla |

Los otros dos GLB de referencia:

| | `acetate.glb` (Marius.Eder, acetato grueso) | `metal.glb` (Lamis, metálico fino al aire) |
|---|---|---|
| Unidades | decímetros: × 100 (frente 140,6 mm, patilla 133 mm, coherente) | **incoherentes**: el frente mide 18,5 unidades y la patilla 14,6. Ninguna unidad da medidas reales. Se escaló para que el frente mida 140 mm (× 7,56) y las patillas quedan cortas (~110 mm) |
| Ejes | ya mira a +Z, Y arriba | ya mira a +Z, Y arriba |
| Origen | casi en el frente; el puente está en `[0, 0.121, 0.070]` | el modelo viene a la altura de una cabeza (Y ≈ 184); puente en `[0, 184.45, 16.18]` |
| Lentes | malla y material aparte (`Frame.1`, transparente) | malla aparte, con `KHR_materials_transmission`, que three 0.113 no soporta: se ven como transparencia común |
| Peso | **5 MB, 68.000 vértices**: el más pesado por lejos (P-07) | 1,6 MB, 7.600 vértices, 4 texturas PNG |

Conclusión para el script: no se puede asumir ni unidades, ni ejes, ni origen. Hay que detectar el frente (el lado con más vértices y la barra del puente en el centro) y el ancho, y escalar con las medidas de la patilla, no con las unidades del archivo.

## Probar el widget embebido

- **HTML pelada:** `test-pages/index.html` con solo el `<script>` y una clave de prueba; `npm run preview:plain` la sirve por HTTPS junto al build. **Verificado el 2026-10-19:** el botón aparece entre los dos párrafos, en Shadow DOM, y el modal carga los modelos y MediaPipe sin errores.
- **WordPress:** pegar el snippet en una página (bloque HTML personalizado) de un WordPress de prueba servido por HTTPS. Hay que verificar que el tema no rompe estilos (Shadow DOM) y que no choca con jQuery u otros scripts del tema. `TBD`: ¿qué instalación de WordPress se usa para probar (un sitio de staging de Raven-Net, un WordPress local)?
- **WooCommerce (Fase 2/3):** el widget en la ficha de producto, asociado al marco correspondiente. `TBD`: cómo se vincula un producto de WooCommerce con un `frame` (atributo, SKU, ID). Pregunta abierta para la Fase 2.
