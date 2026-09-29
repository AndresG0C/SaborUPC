# SaborUPC — Root Config (contenedor single-spa)

Contenedor principal de la aplicación **SaborUPC**, construido con
[single-spa](https://single-spa.js.org/). Se encarga de orquestar el montaje
y desmontaje de los micro frontends según la ruta del navegador, y de aplicar
el sistema de diseño compartido.

---

## 1. ¿Qué hace este contenedor?

- **Enruta por hash** entre cuatro micro frontends:
  - `#/catalogo` — lista de platos (Vue 3, desplegado en Netlify)
  - `#/carrito` — carrito de compras (JS puro, desplegado en Render)
  - `#/pedidos` — seguimiento de pedidos (Lit, desplegado en Render)
  - `#/perfil` — perfil del usuario (Web Component nativo)
- **Monta y desmonta** cada micro frontend usando el ciclo de vida de single-spa
  (`bootstrap`, `mount`, `unmount`).
- **Carga los MFEs por import map** desde sus URLs públicas o locales.
- **Envuelve los MFEs** que no exponen el ciclo de vida directamente
  (porque fueron construidos como scripts que definen funciones globales).
- **Aplica el sistema de diseño** (`tokens.css`) servido desde su propio
  origen en Render.
- **Escucha eventos públicos** entre micro frontends y actualiza la UI:
  - `carrito:actualizado` → actualiza el badge del carrito en el header.
  - `usuario:cambio` → actualiza el saludo del header.
  - `pedido:estado` → muestra un toast de notificación.
- **Muestra notificaciones breves (toasts)** cuando un pedido cambia de estado.

---

## 2. Estructura del proyecto

```
contenedor/
├── src/
│   ├── SaborUPC-root-config.ts   → registro de apps, eventos, toasts
│   ├── contenedor.css            → estilos del shell (header, nav, toasts, footer)
│   ├── declarations.d.ts         → declaraciones de tipos para imports de CSS
│   └── microfrontend-layout.html → layout HTML (header, rutas, footer)
├── public/
│   └── index.html                → se genera desde index.ejs
├── index.ejs                     → plantilla principal (import map, CSP, scripts)
├── package.json
├── webpack.config.js
├── tsconfig.json
└── README.md
```

---

## 3. Requisitos previos

- **Node.js** 18 o superior.
- **pnpm** (recomendado) o **npm**.
- El sistema de diseño desplegado y accesible (por defecto, apunta a
  `https://design-tokens-saborupc.onrender.com/tokens.css`).
- Los micro frontends accesibles (desplegados en sus URLs o corriendo en local).

### Instalar pnpm (si no lo tienes)

```bash
npm install -g pnpm
```

---

## 4. Instalación

Dentro de la carpeta del contenedor:

```bash
pnpm install
```

Si usas npm:

```bash
npm install
```

---

## 5. Ejecución en desarrollo

```bash
pnpm start
```

El contenedor se sirve en:

```
http://localhost:9000
```

Al abrirlo, se carga por defecto la ruta `#/catalogo`.

### Scripts disponibles

| Comando      | Qué hace                                                     |
| ------------ | ------------------------------------------------------------ |
| `pnpm start` | Arranca el servidor de desarrollo en `http://localhost:9000` |
| `pnpm build` | Genera el bundle de producción en `dist/`                    |
| `pnpm lint`  | Ejecuta ESLint sobre `src/`                                  |
| `pnpm test`  | Ejecuta las pruebas (si las hay)                             |

---

## 6. ¿Qué micro frontends consume?

Los micro frontends están declarados en el **import map** dentro de `index.ejs`.
Cada uno vive en su propio origen:

| Ruta        | Nombre single-spa    | URL actual | Tecnología           |
| ----------- | -------------------- | ---------- | -------------------- |
| `/catalogo` | `@SaborUPC/catalogo` | Netlify    | Vue 3                |
| `/carrito`  | `@SaborUPC/carrito`  | Render     | JS puro              |
| `/perfil`   | `@SaborUPC/perfil`   | Render     | Web Component nativo |
| `/pedidos`  | `@SaborUPC/pedidos`  | Render     | Lit                  |

### Import map

```html
<script type="injector-importmap">
  {
    "imports": {
      "@SaborUPC/root-config": "//localhost:9000/SaborUPC-root-config.js",
      "@SaborUPC/catalogo": "https://charming-maamoul-b29685.netlify.app//catalogo.js",
      "@SaborUPC/carrito": "https://<tu-carrito>.onrender.com/carrito.js",
      "@SaborUPC/perfil": "https://<tu-perfil>.onrender.com/perfil.js",
      "@SaborUPC/pedidos": "https://mfe-pedidos.onrender.com//pedidos.js"
    }
  }
</script>
```

Cambiar una URL aquí es lo único que necesitas para apuntar a otro despliegue.

---

## 7. Layout y rutas

El layout está en `src/microfrontend-layout.html`. Define:

- **Header** con logo, nav (catálogo, carrito, pedidos, perfil), badge del
  carrito y saludo del usuario.
- **`<main>`** que contiene las rutas.
- **Zona de toasts** para notificaciones.
- **Footer**.

Cada ruta usa `<route path="...">` y `<application name="...">`.
La ruta del catálogo está marcada con `default` para que se active cuando
la URL no coincide con ninguna otra.

---

## 8. Sistema de diseño (tokens.css)

El contenedor carga `tokens.css` desde su propio origen:

```html
<link
  rel="stylesheet"
  href="https://design-tokens-saborupc.onrender.com/tokens.css"
/>
```

Ese archivo define variables CSS (`--color-primario`, `--espaciado-3`, etc.)
que el contenedor consume en `contenedor.css` con fallbacks:

```css
.app-header {
  background: var(--color-primario, #0b4f8a);
}
```

**Nota:** los micro frontends también pueden consumir `tokens.css`, pero **no
deben redefinirlo**. Es un recurso compartido que se sirve desde su propio
origen.

---

## 9. Resiliencia y observabilidad

- **Resiliencia:** si un micro frontend no carga (URL caída, error de red),
  single-spa lo marca como `SKIP_BECAUSE_BROKEN`. Se puede detectar y mostrar
  un mensaje al usuario desde el root-config.
- **Observabilidad:** los tiempos de carga y montaje se pueden registrar con
  `performance.now()` dentro de cada `mount` del envoltorio.

---

## 10. Cómo desplegar

Este contenedor es una aplicación web normal (bundle de webpack). Se puede
desplegar en cualquier hosting estático o en un servicio que soporte SPA
con History API.

### Ejemplo: Netlify

1. `pnpm build` genera los archivos estáticos en `dist/`.
2. Sube `dist/` a Netlify como sitio estático.
3. Asegúrate de que todas las rutas redirigen a `index.html`. Añade un archivo
   `_redirects` en `public/` con:
   ```
   /*    /index.html   200
   ```
4. Actualiza el import map del `index.ejs` para que `@SaborUPC/root-config`
   apunte a la URL pública del bundle.

### Ejemplo: Vercel / Render

Idéntico: sirve `dist/` como sitio estático y ajusta el import map.

---

## 11. Solución de problemas

### El header se ve sin estilos

- Verifica que `contenedor.css` está en `src/`.
- Verifica que `SaborUPC-root-config.ts` tiene `import "./contenedor.css";`.
- Verifica que `src/declarations.d.ts` existe con `declare module "*.css";`.

### Error `regeneratorRuntime is not defined`

- Añade `import "regenerator-runtime/runtime";` al principio de
  `SaborUPC-root-config.ts`.
- O añade `regenerator-runtime/runtime` al entry del `webpack.config.js`.

### Error `Invalid routesConfig.routes[1].routes[0]`

- Una `<route>` en `microfrontend-layout.html` tiene `path` **y** `default`
  a la vez. Son mutuamente excluyentes. Quita uno de los dos.

### Error CORS al cargar un MFE

- Cada MFE debe servirse con `Access-Control-Allow-Origin: *`.
- En Netlify: añade un archivo `_headers` con:
  ```
  /*
    Access-Control-Allow-Origin: *
  ```
- En Render: añade una cabecera personalizada en Settings → Headers.

### El CSS no se aplica desde tokens

- Verifica que la URL de `tokens.css` responde con contenido CSS.
- En consola, ejecuta:
  ```js
  getComputedStyle(document.documentElement).getPropertyValue(
    "--color-primario"
  );
  ```
  Debe devolver un color, no una cadena vacía.

### El micro frontend no monta, pero no hay error

- Abre la pestaña **Network** y verifica que el script del MFE se descarga.
- Abre la pestaña **Elements** y busca el `<div>` interno del MFE
  (`mfe-rendercatalogo`, etc.). Si no existe, el `mount` no se ejecutó.
- Verifica que el nombre del MFE en el import map coincide exactamente con
  el que aparece en `microfrontend-layout.html`.

---

## 12. Relación con el resto del proyecto

```
┌──────────────────────────────────────────────────────────┐
│  CONTENEDOR single-spa (este repo)                       │
│  • Root config                                           │
│  • Layout (header, rutas, footer)                        │
│  • Import map                                            │
│  • Eventos públicos y toasts                             │
└──────────────────────────────────────────────────────────┘
        │                │              │              │
        ▼                ▼              ▼              ▼
   mfe-catalogo    mfe-carrito     mfe-perfil     mfe-pedidos
   (Vue 3)         (JS puro)    (Web Component)     (Lit)

                    design-tokens
                    (tokens.css en Render)
```

- **Cada MFE vive en su propio origen** (URL pública).
- **Cada MFE se despliega de forma independiente.**
- **La comunicación entre MFEs es siempre por eventos** (`carrito:agregar`,
  `pedido:confirmado`, `pedido:estado`, etc.), nunca por llamadas directas.
- **El contrato de eventos está documentado** en el `CONTRATOS.md` del
  repositorio original del taller (o donde corresponda).

---

## 13. Referencias

- [single-spa](https://single-spa.js.org/)
- [single-spa-layout](https://single-spa.js.org/docs/layout-overview)
- [Import maps](https://github.com/WICG/import-maps)
- [import-map-overrides](https://github.com/single-spa/import-map-overrides)
