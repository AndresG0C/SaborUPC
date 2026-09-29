import { registerApplication, start } from "single-spa";
import "./contenedor.css";
import "regenerator-runtime/runtime";
import {
  constructApplications,
  constructRoutes,
  constructLayoutEngine,
} from "single-spa-layout";
import microfrontendLayout from "./microfrontend-layout.html";

// ------------------------------------------------------------------
// 0. Estado del contenedor (persistente entre reconstrucciones del layout)
// ------------------------------------------------------------------
// single-spa-layout reconstruye el header cada vez que cambias de ruta,
// así que hay que guardar estos valores y volver a pintarlos tras cada mount.
let nombreUsuario: string = "invitado";
let cantidadCarrito: number = 0;

function actualizarSaludo() {
  const saludo = document.getElementById("app-saludo");
  if (saludo) saludo.textContent = "Hola, " + nombreUsuario;
}

function actualizarBadge() {
  const contador = document.getElementById("app-contador");
  if (contador) contador.textContent = String(cantidadCarrito);
}

function refrescarHeader() {
  actualizarSaludo();
  actualizarBadge();
}

// ------------------------------------------------------------------
// 1. Utilidades: notificaciones (toasts)
// ------------------------------------------------------------------
function notificar(texto: string, tipo: string = "info") {
  const zona = document.getElementById("app-toasts");
  if (!zona) return;

  const toast = document.createElement("div");
  toast.className = "app-toast app-toast--" + tipo;
  toast.textContent = texto;
  zona.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("app-toast--visible"));

  setTimeout(() => {
    toast.classList.remove("app-toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ------------------------------------------------------------------
// 2. Resiliencia: mostrar mensaje + botón Reintentar
// ------------------------------------------------------------------
function mostrarErrorApp(nombre: string, err: any) {
  console.error("[resiliencia] App caída:", nombre, err);

  const main =
    (document.querySelector("single-spa-router main") as HTMLElement) ||
    (document.querySelector("main") as HTMLElement);
  if (!main) return;

  // Nombres bonitos para mostrar al usuario
  const nombresBonitos: Record<string, string> = {
    "@SaborUPC/catalogo": "Catálogo",
    "@SaborUPC/carrito": "Carrito",
    "@SaborUPC/perfil": "Perfil",
    "@SaborUPC/pedidos": "Pedidos",
  };
  const etiqueta = nombresBonitos[nombre] || nombre;

  // Contenedor específico para el error (no rompemos el resto del main)
  let contenedorError = document.getElementById("mfe-error");
  if (!contenedorError) {
    contenedorError = document.createElement("div");
    contenedorError.id = "mfe-error";
    main.appendChild(contenedorError);
  }

  contenedorError.innerHTML =
    '<div class="app-error">' +
    "<p>El micro frontend <b>" +
    etiqueta +
    "</b> no está disponible en este momento. " +
    "El resto de la aplicación sigue funcionando.</p>" +
    '<button class="app-reintentar">Reintentar</button>' +
    "</div>";

  const boton = contenedorError.querySelector(
    ".app-reintentar"
  ) as HTMLButtonElement;
  boton.addEventListener("click", () => {
    // Recargar la página es lo más simple y suficiente para el taller.
    // single-spa vuelve a intentar cargar el MFE desde cero.
    window.location.reload();
  });
}

// ------------------------------------------------------------------
// 3. Envoltorios: adaptan los MFEs "caseros" al ciclo de vida de single-spa
// ------------------------------------------------------------------

// Envuelve un MFE que expone window.renderX / window.unmountX
function envolverFuncion(renderFn: string, unmountFn: string) {
  const idInterno = "mfe-" + renderFn.toLowerCase();

  return {
    bootstrap: () => Promise.resolve(),
    mount: (props: any) => {
      // Limpiar cualquier mensaje de error previo
      const errDiv = document.getElementById("mfe-error");
      if (errDiv) errDiv.remove();

      // Elegir host: domElement de single-spa, o el <main> del layout como fallback
      const host =
        props.domElement ||
        document.querySelector("single-spa-router main") ||
        document.querySelector("main") ||
        document.body;

      // Crear (o reutilizar) un <div> interno con id estable
      let div = document.getElementById(idInterno);
      if (!div) {
        div = document.createElement("div");
        div.id = idInterno;
        host.appendChild(div);
      }

      // Llamar al MFE con ese id
      if (typeof (window as any)[renderFn] === "function") {
        (window as any)[renderFn](idInterno);
      } else {
        console.error("[root-config] Falta la función", renderFn);
      }

      refrescarHeader();

      return Promise.resolve();
    },
    unmount: (props: any) => {
      const fn = (window as any)[unmountFn];
      if (typeof fn === "function") fn(idInterno);
      const div = document.getElementById(idInterno);
      if (div) div.remove();
      return Promise.resolve();
    },
  };
}

// Envuelve un MFE Web Component (etiqueta <mfe-x>)
function envolverWebComponent(tag: string) {
  const idInterno = "host-" + tag;

  return {
    bootstrap: () => Promise.resolve(),
    mount: (props: any) => {
      // Limpiar cualquier mensaje de error previo
      const errDiv = document.getElementById("mfe-error");
      if (errDiv) errDiv.remove();

      // Elegir host
      const host =
        props.domElement ||
        document.querySelector("single-spa-router main") ||
        document.querySelector("main") ||
        document.body;

      // Crear (o reutilizar) el div host
      let div = document.getElementById(idInterno);
      if (!div) {
        div = document.createElement("div");
        div.id = idInterno;
        host.appendChild(div);
      }

      // Insertar el Web Component
      const el = document.createElement(tag);
      div.appendChild(el);

      refrescarHeader();

      return Promise.resolve();
    },
    unmount: (props: any) => {
      const div = document.getElementById(idInterno);
      if (div) div.remove();
      return Promise.resolve();
    },
  };
}

// ------------------------------------------------------------------
// 4. Carga de cada MFE: import + envoltorio según tipo
// ------------------------------------------------------------------
async function loadApp({ name }: { name: string }) {
  // 1. Medir el tiempo de descarga del bundle
  const t0 = performance.now();

  try {
    await import(/* webpackIgnore: true */ name);
  } catch (e) {
    mostrarErrorApp(name, e);
    throw e;
  }

  const ms = (performance.now() - t0).toFixed(1);
  console.info(`[mfe] ${name} cargó en ${ms} ms`);

  // 2. Devolver el ciclo de vida que single-spa espera
  if (name === "@SaborUPC/catalogo") {
    return envolverFuncion("renderCatalogo", "unmountCatalogo");
  }
  if (name === "@SaborUPC/carrito") {
    return envolverFuncion("renderCarrito", "unmountCarrito");
  }
  if (name === "@SaborUPC/pedidos") {
    return envolverFuncion("renderPedidos", "unmountPedidos");
  }
  if (name === "@SaborUPC/perfil") {
    return envolverWebComponent("mfe-perfil");
  }

  return import(/* webpackIgnore: true */ name);
}

// ------------------------------------------------------------------
// 5. Construcción del layout y registro
// ------------------------------------------------------------------
const routes = constructRoutes(microfrontendLayout);
const applications = constructApplications({ routes, loadApp });
const layoutEngine = constructLayoutEngine({ routes, applications });

applications.forEach(registerApplication);
layoutEngine.activate();

// ------------------------------------------------------------------
// 6. Eventos públicos que el contenedor escucha
// ------------------------------------------------------------------
window.addEventListener("carrito:actualizado", (e: any) => {
  cantidadCarrito = e.detail.cantidad;
  actualizarBadge();
});

window.addEventListener("usuario:cambio", (e: any) => {
  nombreUsuario = e.detail.nombre;
  actualizarSaludo();
});

window.addEventListener("pedido:estado", (e: any) => {
  notificar("Pedido #" + e.detail.pedidoId + ": " + e.detail.estado, "info");
});

// Precargar MFEs que solo escuchan eventos (aunque no estén visibles)
import(/* webpackIgnore: true */ "@SaborUPC/carrito" as any).catch(
  console.error
);
import(/* webpackIgnore: true */ "@SaborUPC/pedidos" as any).catch(
  console.error
);

// ------------------------------------------------------------------
// 7. Arranque
// ------------------------------------------------------------------
start();
