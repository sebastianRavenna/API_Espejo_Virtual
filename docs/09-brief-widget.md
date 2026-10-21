# 09 — Brief de diseño del widget (para Claude Design)

Este documento se pega tal cual en Claude Design (ADR-030). Describe qué hay que diseñar, para quién y con qué restricciones. El resultado se implementa después en `widget/src/ui/` (estilos en Shadow DOM).

---

## 1. Qué es

Un **probador virtual de anteojos** que las ópticas agregan a su sitio web pegando una sola línea de código. En la ficha de un producto aparece un botón **"Probátelos"**: al tocarlo se abre una ventana (modal) con la cámara del usuario, que se ve a sí mismo con el anteojo puesto, en 3D y siguiendo los movimientos de la cara. Desde ahí puede cambiar de marco, sacarse una foto y estimar su distancia pupilar (DP).

- **Quién lo usa:** el cliente de la óptica, en general desde el **celular**, sin explicación previa. Adultos de todas las edades; muchos usan anteojos de lectura.
- **Dónde vive:** dentro de sitios ajenos (WordPress, tiendas, HTML simple), con estilos y colores que no controlamos.
- **Para qué se diseña ahora:** el producto se va a mostrar a ópticas con un video de 30 segundos. Tiene que verse **profesional y confiable**, a la altura de los probadores conocidos (Fittingbox, Auglio), sin parecer un experimento.

## 2. Restricciones (no negociables)

- **Encapsulado:** todo vive en un Shadow DOM. No hereda nada del sitio y no lo afecta. **Tipografía del sistema** (`system-ui`): sin fuentes externas.
- **Color de acento de cada óptica:** el botón "Probátelos" y los acentos del modal (marco seleccionado, botón principal, barras de progreso) usan el **color de marca de la óptica**, que puede ser cualquiera. El diseño tiene que funcionar con ejemplos muy distintos: azul `#1a5fb4`, bordó `#7a1f2b`, verde `#2e7d32`, negro `#111111` y un **amarillo claro `#f5c518`** (caso difícil). El texto sobre el acento es blanco o negro según el contraste.
- **El resto del modal es neutro y oscuro**, para que la imagen de la cámara y el anteojo se lean bien con cualquier acento.
- **La cara es la protagonista:** la zona central de la imagen de la cámara no se tapa con controles. La imagen está espejada (como un espejo).
- **Formatos de la cámara:** en escritorio el visor es horizontal (16:9) dentro de un modal de hasta ~760 px de ancho; en celular el modal ocupa **toda la pantalla** y el visor es vertical (3:4 o más alto).
- **Tactil y accesible:** botones de al menos 44 × 44 px, foco visible con teclado, se cierra con ✕, con Escape y tocando afuera (en escritorio). Contraste AA en textos.
- **Privacidad visible:** el video se procesa solo en el dispositivo; nunca se sube. Hay que decirlo de forma breve y tranquilizadora.
- **La DP nunca se presenta como medición clínica:** siempre "DP estimada" y con el aviso "No reemplaza la medición de tu óptico".
- **Idioma:** español rioplatense (voseo): "Probátelos", "Acercate", "Mirá".

## 3. Pantallas y estados a diseñar

Cada una en **escritorio y celular**.

### 3.1 Botón en la página de la óptica
- Botón **"Probátelos"** con un ícono de anteojos, en el color de la óptica.
- Mostrarlo sobre un fondo de ficha de producto claro y sobre uno oscuro.
- Estados: normal, hover, foco, presionado.

### 3.2 Modal: cargando
- Encabezado con título ("Probador virtual") y ✕.
- Tres pasos con progreso: "Abriendo la cámara" → "Preparando el probador" → "Cargando el seguimiento de la cara". Dura de 2 a 8 segundos.
- Antes de pedir la cámara, el navegador muestra su propio cartel de permiso: conviene que el modal anticipe por qué la necesitamos.

### 3.3 Modal: probador activo (la pantalla principal)
- Visor de la cámara con el anteojo puesto.
- **Selector de marcos:** miniaturas con el nombre del marco (de 3 a 30 marcos; con muchos, desplazamiento horizontal). El seleccionado se marca con el acento. Tocar uno cambia el anteojo al instante.
- Acciones: **Medir DP** y **Foto**. (La grabación de video es interna, no hace falta diseñarla.)
- Línea de privacidad y, abajo y discreta, la marca del producto ("Probador por …", nombre comercial pendiente: dejar el espacio).
- Pensar dónde van los controles en celular para no tapar la cara (abajo, sobre la imagen con fondo translúcido, o debajo del visor).

### 3.4 Alternativa sin cámara: "Ver en 3D" (se implementa más adelante)
- Además de probárselos con la cámara, el usuario puede ver el marco en 3D, girándolo con el dedo o el mouse, sin cámara.
- Diseñar cómo se pasa de una vista a la otra (por ejemplo, dos pestañas: "Probátelos" / "Ver en 3D") y cómo se ve el visor 3D sobre fondo neutro.

### 3.5 Medición de DP
- Al tocar "Medir DP": indicaciones en vivo según lo que hace la persona, con una barra de progreso (dura ~2 segundos con la cara bien ubicada):
  - "No vemos tu cara. Ponete frente a la cámara."
  - "Acercate más a la cámara."
  - "Mirá derecho a la cámara, con la cara de frente."
  - "Midiendo… quedate quieto mirando a la cámara."
- **Resultado:** "DP estimada: 61 mm" con una aclaración breve de que es la DP "de lejos" (la que usan los ópticos para anteojos de uso general) y el aviso obligatorio: "Es una estimación hecha con la cámara. No reemplaza la medición de tu óptico." Acciones: volver a medir, cerrar el resultado.
- **Errores:** "La medición salió inestable. Acercate un poco más, quedate quieto y probá de nuevo." y "No se pudo medir. Acercate a la cámara, mirala de frente y probá de nuevo."

### 3.6 Foto
- Feedback al sacar la foto (destello o confirmación breve). La foto se descarga en el dispositivo; no se sube.

### 3.7 Errores y casos borde
- **Permiso de cámara denegado:** "Para probarte los anteojos necesitamos permiso para usar la cámara. Habilitalo en el navegador y tocá Reintentar." Botones: Reintentar y, más adelante, "Ver en 3D".
- **Sin cámara en el dispositivo:** "No encontramos una cámara en este dispositivo." Ofrece "Ver en 3D".
- **Sitio sin conexión segura:** "El probador necesita una conexión segura (https)."
- **No se detecta la cara:** pista breve sobre el visor ("Acercate y mirá a la cámara con buena luz").
- **No cargó un modelo:** "No pudimos cargar este marco." El resto del catálogo sigue funcionando.
- **Error general:** "No pudimos iniciar el probador. Revisá tu conexión y tocá Reintentar."

## 4. Qué se espera de Claude Design

1. **Tokens:** colores (neutros del modal y cómo se aplica el acento, incluido el texto sobre el acento), radios, sombras, espaciados y escala tipográfica.
2. **Componentes con sus estados:** botón principal, botón secundario, chip o miniatura de marco (normal, hover, seleccionado, cargando), barra de progreso, pasos de carga, aviso de error, tarjeta de resultado de DP, ✕ de cierre.
3. **Las pantallas de la sección 3**, en escritorio y celular, mostradas con al menos dos colores de acento (uno oscuro y el amarillo claro).
4. **Si es posible, HTML y CSS** de las pantallas: se portan a mano al Shadow DOM del widget, así que conviene CSS simple con variables, sin frameworks.

**Fuera de alcance:** el panel de administración de las ópticas (se diseña en la Fase 3).

## 5. Crecimiento previsto (no se diseña ahora)

El widget va a sumar funciones (ver el backlog de `docs/05-roadmap.md`). No se diseñan ahora: solo se pide que **el layout no se rompa cuando lleguen**.

- **Barra de acciones de 2 a 6 botones.** Hoy son "Medir DP" y "Foto". A futuro: "Talle", "Tinte de lentes", "Compartir" y "Agregar al carrito", este último en el color de la óptica (ADR-031). Hace falta una solución para el celular cuando no entran todas, por ejemplo un menú "más".
- **La tarjeta de resultado de la DP es un componente reutilizable** para otras mediciones (por ejemplo, "Talle: te queda justo"), siempre con el mismo aviso de estimación (ADR-010): "Es una estimación hecha con la cámara. No reemplaza la medición de tu óptico."
- **Una segunda fila de opciones debajo del selector de marcos**, para colores del marco o tintes de lente. Hoy queda vacía, pero el espacio tiene que estar previsto, tanto en escritorio como en celular.
