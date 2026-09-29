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
// 1. Utilidades: notificaciones (toasts) y resiliencia
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

// Envuelve un MFE "casero" (expone window.renderX / window.unmountX) en el contrato
// que single-spa espera: { bootstrap, mount, unmount }.
function envolverFuncion(renderFn: string, unmountFn: string) {
  const idInterno = "mfe-" + renderFn.toLowerCase();

  return {
    bootstrap: () => Promise.resolve(),
    mount: (props: any) => {
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

// Envuelve un MFE Web Component (etiqueta <mfe-x>) en el contrato de single-spa.
function envolverWebComponent(tag: string) {
  const idInterno = "host-" + tag;

  return {
    bootstrap: () => Promise.resolve(),
    mount: (props: any) => {
      const host =
        props.domElement ||
        document.querySelector("single-spa-router main") ||
        document.querySelector("main") ||
        document.body;

      let div = document.getElementById(idInterno);
      if (!div) {
        div = document.createElement("div");
        div.id = idInterno;
        host.appendChild(div);
      }

      const el = document.createElement(tag);
      div.appendChild(el);
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
// 2. Carga de cada MFE: import + envoltorio según tipo
// ------------------------------------------------------------------
async function loadApp({ name }: { name: string }) {
  await import(/* webpackIgnore: true */ name);

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

  // Fallback: si algún MFE ya exporta bootstrap/mount/unmount, se usa tal cual
  return import(/* webpackIgnore: true */ name);
}

// ------------------------------------------------------------------
// 3. Construcción del layout y registro
// ------------------------------------------------------------------
const routes = constructRoutes(microfrontendLayout);
const applications = constructApplications({ routes, loadApp });
const layoutEngine = constructLayoutEngine({ routes, applications });

applications.forEach(registerApplication);
layoutEngine.activate();

// ------------------------------------------------------------------
// 4. Eventos públicos que el contenedor escucha
// ------------------------------------------------------------------
window.addEventListener("carrito:actualizado", (e: any) => {
  const contador = document.getElementById("app-contador");
  if (contador) contador.textContent = e.detail.cantidad;
});

window.addEventListener("usuario:cambio", (e: any) => {
  const saludo = document.getElementById("app-saludo");
  if (saludo) saludo.textContent = "Hola, " + e.detail.nombre;
});

window.addEventListener("pedido:estado", (e: any) => {
  notificar("Pedido #" + e.detail.pedidoId + ": " + e.detail.estado, "info");
});

// ------------------------------------------------------------------
// 5. Arranque
// ------------------------------------------------------------------
start();
