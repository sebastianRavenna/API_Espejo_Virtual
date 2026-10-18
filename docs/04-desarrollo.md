# 04 — Desarrollo

El spike arrancó el 2026-10-18: el código está en `widget/`. Lo demás combina lo que dice el plan con lo que queda `TBD`.

## Estructura del repo

Esta carpeta es la raíz del repo: https://github.com/sebastianRavenna/API_Espejo_Virtual (rama `main`). El código del spike va en `widget/` (ADR-020). El resto de la estructura es una propuesta:

```
/
├── CLAUDE.md                 # documento troncal (leer siempre)
├── docs/                     # memoria del proyecto (01–08)
│   └── source/               # plan, prompt inicial e instrucciones originales (congelados)
├── widget/                   # widget.js: spike → producto. Hoy: JavaScript + React 16 + react-scripts 3.4 (P-13)
├── worker/                   # endpoint público (Cloudflare Worker, TypeScript)
├── panel/                    # panel de ópticas (TypeScript); framework TBD
├── supabase/migrations/      # SQL de esquema y RLS
├── blender/                  # scripts de post-proceso (Python)
└── test-pages/               # HTML pelada para probar el embed
```

`TBD`: el framework del panel. No está en el plan; se decide antes de la Fase 2 y se registra como decisión.

## Setup local

- **HTTPS local es obligatorio:** sin HTTPS el navegador no da acceso a la cámara. `localhost` cuenta como contexto seguro en el escritorio, pero para probar desde el celular por la LAN hace falta HTTPS de verdad.
- **Cómo se resuelve (ADR-024):** el dev server de `react-scripts` (el que trae el repo original) genera solo un certificado autofirmado con `HTTPS=true`. No hace falta instalar nada más. La configuración está en `widget/.env.development` (`HTTPS=true`, `PORT=3000`, `BROWSER=none`). El server escucha en todas las interfaces (`0.0.0.0`) por defecto.
- **Requisitos:** Node 22.13 (el que hay en la PC de Sebastian) funciona, aunque el `package.json` original pide `>=18 <21`. npm 11. Blender: versión `TBD` (para `blender/`, más adelante).
- **Primera vez:** `npm install` dentro de `widget/` (unos 3 minutos, ~1850 paquetes, muchos avisos de paquetes deprecados: es react-scripts 3.4, de 2020).
- **MediaPipe** no se instala por npm: el código lo baja en tiempo de ejecución de `unpkg.com` (`@mediapipe/tasks-vision@0.10.7`, JS + WASM) y el modelo `face_landmarker.task` de `storage.googleapis.com`. Hace falta internet. Si conviene servirlo desde nuestro CDN sigue `TBD` (ver "Build y publicación").
- Variables de entorno con secretos (URL de Supabase, claves, bucket de R2): `TBD`. Nunca se commitean. `widget/.env.development` no tiene secretos y sí se commitea.

### Probar en la PC

1. `cd widget` y `npm start`.
2. Abrir **https://localhost:3000** en Chrome. Aparece el aviso de certificado no válido: "Configuración avanzada" → "Continuar a localhost". Aceptar el permiso de cámara.

### Probar desde el celular (misma red Wi-Fi)

1. Con `npm start` corriendo, averiguar la IP de la PC en la LAN: `ipconfig` → "Dirección IPv4" del adaptador Wi-Fi/Ethernet. **Ojo:** react-scripts muestra "On Your Network: https://192.168.56.1:3000", que es el adaptador de VirtualBox y **no sirve** desde el celular. El 2026-10-18 la IP correcta era `192.168.100.4` (puede cambiar si el router la reasigna).
2. En el celular abrir `https://<IP>:3000`, aceptar el aviso de certificado ("Avanzado" → "Continuar" en Chrome Android; "Mostrar detalles" → "visitar este sitio web" en Safari iOS) y dar permiso de cámara.
3. Si no carga: la primera vez que Node escucha en la red, Windows pregunta si permite el acceso en redes privadas. Si se rechazó, habilitar Node.js en el Firewall de Windows para redes privadas, y verificar que la red Wi-Fi de la PC esté marcada como "Privada".
4. Pendiente de verificar en dispositivos reales (Sebastian): Chrome Android y Safari iOS con el certificado autofirmado.

### Probar sin cámara (Claude Code)

El panel de navegador de Claude Code no acepta certificados autofirmados ni da cámara. Para verificar el render se usó una segunda instancia por HTTP (`widget-http` en `.claude/launch.json`, puerto 3001) y una página temporal que reemplaza `getUserMedia` por una foto fija. Esa página no se dejó en el repo; con una foto no se puede probar el giro de cabeza ni la oclusión de patillas.

## Comandos

| Tarea | Comando |
|---|---|
| Instalar dependencias del widget | `cd widget && npm install` |
| Dev server del widget (HTTPS, LAN) | `cd widget && npm start` → `https://localhost:3000` y `https://<IP-LAN>:3000` |
| Build del spike (no es todavía `widget.js`) | `cd widget && npm run build` → `widget/build/` |
| Build de `widget.js` (Vite) | `TBD` (tarea posterior de la Fase 0) |
| Dev del Worker | `TBD` |
| Aplicar migraciones | `TBD` |
| Post-proceso de un marco | `TBD` (ver más abajo) |

Los scripts `start` y `build` se cambiaron respecto del original: pasaban `NODE_OPTIONS=--openssl-legacy-provider` con sintaxis de bash, que no anda en Windows. Ahora usan `react-scripts --openssl-legacy-provider start`, que react-scripts reenvía a Node. La opción hace falta porque webpack 4 usa un hash que OpenSSL 3 (Node ≥ 17) ya no permite por defecto. Los scripts `predeploy`/`deploy` (GitHub Pages del autor original) quedaron pero no se usan; el campo `homepage` se borró para que el sitio se sirva en la raíz.

## Modelos 3D en el spike

- El widget carga el GLB con `GLTFLoader` (`widget/src/engine/glbGlasses.js`). Cada modelo tiene una "spec" con las correcciones para llevarlo a ADR-015: `unitToMm`, `bridge` (punto del puente en coordenadas del archivo) y `rotationY`. Son exactamente lo que después tiene que hacer el script de Blender.
- **Modo diagnóstico (`?debug=1`):** muestra la resolución real de la cámara, el iris en px, el ancho y el alto de cara calibrados, la escala y el giro. Tiene además una **verificación con tarjeta**: con una tarjeta tamaño ISO (85,6 mm, mostrando el dorso) apoyada plana en la frente, "Congelar" detiene la imagen; dos clics en los bordes de la tarjeta comparan su escala con la del iris y dan la DP y el ancho de cara según cada regla.
- Los tres marcos están en `FRAMES` (`glbGlasses.js`) y se eligen con los botones "Sol", "Acetato" y "Metal". Cada GLB se baja la primera vez que se elige y queda en memoria.
- Al cargar, la consola muestra el tamaño resultante en mm (`[glasses] ... size mm (w x h x d)`): sirve para verificar la escala.
- La escala en pantalla sale de una regla: el diámetro del iris (11,7 mm) calibra el ancho de cara y el alto de la parte superior de la cara de la persona, en mm (medianas de 30 frames, solo con la cara de frente). En cada frame se toma la mayor de las dos escalas en píxeles, para que no se achique al girar ni al cabecear (ADR-025). El origen del modelo (puente) se apoya en el landmark 168 de MediaPipe (entrecejo, sobre el puente nasal). Los ajustes finos están en `CFG` de `widget/src/engine/constants.js`, en mm (ADR-025).
- **Los GLB de prueba no están en el repo (ADR-026).** Después de clonar hay que bajarlos a `widget/public/models-dev/` siguiendo la lista de `widget/README.md`; sin ellos el widget arranca pero no muestra anteojo. `models-dev/` (raíz) y `widget/public/models-dev/` están en `.gitignore`.

## Convenciones de código

- **TypeScript** en el widget, el Worker y el panel. **Python** en los scripts de Blender. **SQL** en las migraciones de Supabase.
- Nombres de archivos, tablas, columnas, variables y código en **inglés**. Textos visibles al usuario en español.
- Las unidades van en el nombre: `_mm` para milímetros (como en `eye_size_mm`).
- Convención 3D: origen en el puente, X hacia la sien, Y hacia arriba, Z hacia adelante, unidades en mm.
- **El código del spike hoy no cumple la convención de TypeScript:** el repo original es JavaScript con React. La migración está pendiente (P-13).
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

- Vite empaqueta todo en **un solo `widget.js`** (modo librería).
- El script lee su `data-key`, crea su host con **Shadow DOM** y monta ahí la UI y el canvas.
- MediaPipe necesita su modelo `.task` y sus archivos WASM. `TBD`: ¿se sirven desde nuestro CDN o desde el de Google? Afecta la privacidad percibida y el costo de egreso.
- Se publica en Cloudflare Pages (ADR-021), en `https://cdn.<dominio>/widget.js` (P-03).
- `TBD`: versionado. Pregunta: ¿las ópticas cargan siempre `widget.js` (la última versión) o una versión fija (`widget.v1.js`)? Con la última versión, un bug llega a todos los clientes a la vez.

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

- **HTML pelada:** `test-pages/index.html` con solo el `<script>` y una clave de prueba, servida por HTTPS. Sirve para validar que el widget funciona sin ningún framework.
- **WordPress:** pegar el snippet en una página (bloque HTML personalizado) de un WordPress de prueba servido por HTTPS. Hay que verificar que el tema no rompe estilos (Shadow DOM) y que no choca con jQuery u otros scripts del tema. `TBD`: ¿qué instalación de WordPress se usa para probar (un sitio de staging de Raven-Net, un WordPress local)?
- **WooCommerce (Fase 2/3):** el widget en la ficha de producto, asociado al marco correspondiente. `TBD`: cómo se vincula un producto de WooCommerce con un `frame` (atributo, SKU, ID). Pregunta abierta para la Fase 2.
