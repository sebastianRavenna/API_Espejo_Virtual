# widget/ — Espejo Virtual (spike, Fase 0)

Código del spike técnico del Espejo Virtual. Evoluciona hasta ser el `widget.js` del producto (ADR-020).
Cómo se levanta y qué comandos se usan: ver `docs/04-desarrollo.md`.

## Origen y crédito

Este código parte de **[basic-virtual-tryon-glasses](https://github.com/alperenuzun/basic-virtual-tryon-glasses)**,
de **Alperen Uzun** ([@alperenuzun](https://github.com/alperenuzun)), copiado el 2026-10-18 desde el commit
`a1413d5` sin su historial git. Gracias al autor por publicarlo.

- Licencia: MIT, según declara el README original. El repo original **no trae archivo `LICENSE`**;
  el texto y la nota están en [`LICENSE-UPSTREAM.md`](LICENSE-UPSTREAM.md) (ADR-023).
- El README original se conserva en [`README.upstream.md`](README.upstream.md) y las instrucciones
  para agentes del autor en `CLAUDE.upstream.md` (renombrado para que Claude Code no lo cargue como
  instrucciones de este proyecto).

### Qué no se copió

- `public/js/gsap.min.js` (GSAP 3.2.4, licencia propia de GreenSock, no MIT) y
  `public/js/jquery-3.4.1.min.js`: se cargaban en `index.html` pero ningún archivo de `src/` los usa.
- `public/obj/*` (`.gltf`, `.obj`, textura): el código no los carga (el modelo era procedural) y no
  tienen licencia ni procedencia declaradas.

### Qué se cambió respecto del original

Ver `docs/08-bitacora.md` (sesión del 2026-10-18, Fase 0 día 1). En resumen: el modelo procedural
se reemplazó por un GLB cargado con `GLTFLoader`, normalizado a la convención de ADR-015, y el
script `start` se cambió para que corra también en Windows.

## Modelos 3D de prueba

Los GLB de prueba **no están en el repo** (ADR-026): `models-dev/` y `widget/public/models-dev/` están en `.gitignore`.
Para que el dev server los sirva, bajalos a **`widget/public/models-dev/`** con estos nombres:

| Archivo | Uso en el spike | Autor | Licencia | Dónde bajarlo |
|---|---|---|---|---|
| `sun_glasses.glb` | Marco "Sol" | Long Nguyễn | CC-BY-4.0 | [Sketchfab: Sun Glasses](https://sketchfab.com/3d-models/sun-glasses-18b31f8c855943a0ba4af57b93be8e60) |
| `acetate.glb` | Marco "Acetato" (acetato grueso) | Marius.Eder | CC-BY-4.0 | [Sketchfab: Glasses (Marius.Eder)](https://sketchfab.com/3d-models/glasses-007651a9450746a5b6c5a126d484cd52) |
| `metal.glb` | Marco "Metal" (metálico fino al aire) | Lamis | CC-BY-4.0 | [Sketchfab: Glasses (Lamis)](https://sketchfab.com/3d-models/glasses-0a51db978635499cbce9cc57c434ffdf) |

Cómo bajarlos: en la página del modelo, "Download 3D Model" → formato **glTF Binary (.glb)**, versión original
(no la "autoconverted" reducida, si aparece). Hace falta una cuenta de Sketchfab, gratuita. Renombrar el archivo al
nombre de la tabla: el código lo busca por ese nombre (`widget/src/engine/glbGlasses.js`).

Si se reemplaza un archivo por otra descarga, verificar que la consola muestre el mismo tamaño en mm
(`[glasses] ... size mm`): las correcciones de la spec (unidades, rotación, puente) dependen del archivo exacto.

CC-BY-4.0 exige atribución: si alguno de estos modelos aparece en un video o demo, hay que acreditar al autor.
