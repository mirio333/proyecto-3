/* Service worker de Rutas Puebla
   - Archivos de la app y datos (/paradas, /rutas): primero la red; si no hay internet, la última copia
   - Librerías externas (Leaflet, fuentes): primero la copia guardada
   - Administración y autenticación: nunca se guardan */
const VERSION = "rutas-puebla-v2";

const APP = [
  "/",
  "/static/styles.css",
  "/static/comun.js",
  "/static/app.js",
  "/static/icons/icon-192.png",
  "/manifest.webmanifest"
];

const LIBRERIAS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"
];

self.addEventListener("install", evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP);
    // Las librerías externas son "opacas"; si alguna falla, no se cancela la instalación
    await Promise.allSettled(
      LIBRERIAS.map(async url => {
        const respuesta = await fetch(new Request(url, { mode: "no-cors" }));
        await cache.put(url, respuesta);
      })
    );
    self.skipWaiting();
  })());
});

self.addEventListener("activate", evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function redPrimero(peticion) {
  const cache = await caches.open(VERSION);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch (_) {
    const guardada = await cache.match(peticion);
    if (guardada) return guardada;
    throw _;
  }
}

async function cachePrimero(peticion) {
  const cache = await caches.open(VERSION);
  const guardada = await cache.match(peticion);
  const actualizada = fetch(peticion)
    .then(respuesta => {
      if (respuesta.ok || respuesta.type === "opaque") cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);
  return guardada || (await actualizada) || Response.error();
}

self.addEventListener("fetch", evento => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);

  // Teselas del mapa: directo a la red (son muchas y pesadas)
  if (url.hostname.endsWith("tile.openstreetmap.org")) return;

  if (url.origin === self.location.origin) {
    // Nunca guardar administración ni autenticación
    if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/auth") ||
        url.pathname.startsWith("/static/admin") || url.pathname === "/sw.js") return;

    // /paradas/cercanas depende de la ubicación: no se guarda
    if (url.pathname.startsWith("/paradas/cercanas")) return;

    // Páginas, archivos propios y datos: primero la red (así siempre ves tus últimos cambios);
    // la copia guardada solo se usa cuando no hay internet.
    evento.respondWith(redPrimero(peticion));
    return;
  }

  // Librerías externas (Leaflet, markercluster, fuentes)
  if (url.hostname === "unpkg.com" || url.hostname.endsWith("gstatic.com") ||
      url.hostname.endsWith("googleapis.com")) {
    evento.respondWith(cachePrimero(peticion));
  }
});
