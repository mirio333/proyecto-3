/* ============================================
   Rutas Puebla · vista pública (pasajeros)
   Requiere comun.js, Leaflet y markercluster
   ============================================ */

const lista = document.getElementById("lista-paradas");
const mensaje = document.getElementById("mensaje");
const contador = document.getElementById("contador");
const buscador = document.getElementById("buscador");
const filtroRuta = document.getElementById("filtro-ruta");
const soloActivas = document.getElementById("solo-activas");
const chipsRutas = document.getElementById("chips-rutas");
const btnCerca = document.getElementById("btn-cerca");
const btnTodas = document.getElementById("btn-todas");

const mapa = crearMapa("mapa");
const capaParadas = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
const capaLineas = L.layerGroup();
const capaUsuario = L.layerGroup();
capaLineas.addTo(mapa);
mapa.addLayer(capaParadas);
capaUsuario.addTo(mapa);

let paradas = [];          // todas las paradas
let rutas = [];            // todas las rutas (con trazado)
let cercanas = null;       // resultado de "cerca de mí" (o null)
let ubicacion = null;      // {lat, lng} del pasajero
let marcadorResaltado = null;

const mostrarMensaje = (texto, tipo) => mostrarMensajeEn(mensaje, texto, tipo);

// ============================================
// Datos
// ============================================
async function cargarDatos() {
  try {
    const [rp, rr] = await Promise.all([fetch("/paradas"), fetch("/rutas")]);
    if (!rp.ok) throw new Error("No se pudieron cargar las paradas");

    paradas = (await rp.json()).paradas || [];
    rutas = rr.ok ? (await rr.json()).rutas || [] : [];

    llenarSelectorRutas();
    pintar(true);
  } catch (error) {
    mostrarMensaje(error.message + ". Revisa tu conexión.", "error");
  }
}

function llenarSelectorRutas() {
  const actual = filtroRuta.value;
  filtroRuta.innerHTML = '<option value="">Todas las rutas</option>';

  // Rutas definidas + nombres de ruta que solo aparecen dentro de las paradas
  const nombres = new Set(rutas.filter(r => r.activa).map(r => r.nombre));
  paradas.forEach(p => p.rutas.forEach(n => nombres.add(n)));

  [...nombres].sort((a, b) => a.localeCompare(b, "es", { numeric: true })).forEach(nombre => {
    const op = document.createElement("option");
    op.value = nombre;
    op.textContent = nombre;
    filtroRuta.appendChild(op);
  });
  filtroRuta.value = [...nombres].includes(actual) ? actual : "";

  chipsRutas.innerHTML = "";
  rutas.filter(r => r.activa && r.trazado.length > 1).forEach(r => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.style.setProperty("--color", r.color);
    chip.textContent = r.nombre;
    chip.addEventListener("click", () => {
      filtroRuta.value = filtroRuta.value === r.nombre ? "" : r.nombre;
      pintar(true);
    });
    chipsRutas.appendChild(chip);
  });
}

// ============================================
// Filtrado y pintado
// ============================================
function rutaSeleccionada() {
  return rutas.find(r => r.nombre === filtroRuta.value) || null;
}

function paradasVisibles() {
  let base = cercanas ? cercanas : paradas;

  if (soloActivas.checked) base = base.filter(p => p.activa);

  const nombreRuta = filtroRuta.value;
  if (nombreRuta) {
    const ruta = rutaSeleccionada();
    const idsRuta = new Set(ruta ? ruta.paradas : []);
    base = base.filter(p => p.rutas.includes(nombreRuta) || idsRuta.has(p.id));
  }

  const t = buscador.value.trim().toLowerCase();
  if (t) {
    base = base.filter(p =>
      p.nombre.toLowerCase().includes(t) ||
      p.colonia.toLowerCase().includes(t) ||
      p.rutas.some(r => r.toLowerCase().includes(t))
    );
  }
  return base;
}

function pintarLineas() {
  capaLineas.clearLayers();
  const seleccionada = rutaSeleccionada();

  rutas.filter(r => r.activa && r.trazado.length > 1).forEach(r => {
    if (seleccionada && seleccionada.id !== r.id) return;   // solo la elegida
    L.polyline(r.trazado, {
      color: r.color,
      weight: seleccionada ? 6 : 4,
      opacity: seleccionada ? 0.9 : 0.55,
      dashArray: seleccionada ? null : "2 8",
      lineCap: "round"
    }).bindTooltip(r.nombre, { sticky: true }).addTo(capaLineas);
  });
}

function pintar(ajustarMapa) {
  const visibles = paradasVisibles();

  // Chips activos
  chipsRutas.querySelectorAll(".chip").forEach(c =>
    c.classList.toggle("chip--activo", c.textContent === filtroRuta.value));

  // Lista
  lista.innerHTML = "";
  contador.textContent = cercanas
    ? `${visibles.length} parada(s) cerca de ti, de la más cercana a la más lejana`
    : `Mostrando ${visibles.length} de ${paradas.length} paradas`;
  btnTodas.classList.toggle("oculto", !cercanas);

  if (visibles.length === 0) {
    lista.innerHTML = `<div class="vacio">${
      paradas.length ? "No encontramos paradas con esos filtros." : "Aún no hay paradas registradas. 🌱"
    }</div>`;
  }

  visibles.forEach(p => {
    const rutasHtml = p.rutas.length
      ? p.rutas.map(r => `<span class="ruta">${esc(r)}</span>`).join("")
      : "<em>Sin rutas</em>";

    const tarjeta = document.createElement("article");
    tarjeta.className = "parada" + (p.activa ? "" : " parada--inactiva");
    tarjeta.innerHTML = `
      <div class="parada__cabecera">
        <h3>${esc(p.nombre)}</h3>
        ${p.distancia_m != null
          ? `<span class="distancia">${formatoDistancia(p.distancia_m)}</span>`
          : `<span class="etiqueta ${p.activa ? "" : "etiqueta--inactiva"}">${p.activa ? "Activa" : "Inactiva"}</span>`}
      </div>
      <p><strong>Colonia:</strong> ${esc(p.colonia)}</p>
      <div class="rutas">${rutasHtml}</div>
      <div class="acciones">
        <button class="btn btn--chico btn--mapa btn-ubicar" data-id="${esc(p.id)}">Ver en mapa</button>
        <a class="btn btn--chico btn--tierra" href="${enlaceComoLlegar(p)}" target="_blank" rel="noopener">Cómo llegar ↗</a>
      </div>
    `;
    lista.appendChild(tarjeta);
  });

  // Mapa
  capaParadas.clearLayers();
  visibles.forEach(p => {
    const marcador = L.marker([p.latitud, p.longitud], {
      icon: crearIcono(p.activa ? "" : "pin--inactiva")
    });
    marcador.bindPopup(textoPopup(p));
    marcador.bindTooltip(p.nombre);
    marcador._paradaId = p.id;
    capaParadas.addLayer(marcador);
  });
  pintarLineas();

  if (ajustarMapa) ajustarVista(visibles);
}

function ajustarVista(visibles) {
  const puntos = visibles.map(p => [p.latitud, p.longitud]);
  if (ubicacion) puntos.push([ubicacion.lat, ubicacion.lng]);
  const ruta = rutaSeleccionada();
  if (ruta) ruta.trazado.forEach(t => puntos.push(t));

  if (puntos.length > 1) {
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 16 });
  } else if (puntos.length === 1) {
    mapa.setView(puntos[0], 16);
  } else {
    mapa.setView(CENTRO_PUEBLA, 13);
  }
}

// ============================================
// Cerca de mí (GPS + Redis GEOSEARCH)
// ============================================
function dibujarUsuario() {
  capaUsuario.clearLayers();
  if (!ubicacion) return;
  L.circleMarker([ubicacion.lat, ubicacion.lng], {
    radius: 9, color: "#fff", weight: 3, fillColor: "#2f6f8f", fillOpacity: 1
  }).bindTooltip("Estás aquí").addTo(capaUsuario);
}

async function buscarCercanas() {
  if (!("geolocation" in navigator)) {
    mostrarMensaje("Tu navegador no permite usar la ubicación.", "error");
    return;
  }

  btnCerca.disabled = true;
  btnCerca.textContent = "Buscando tu ubicación…";

  navigator.geolocation.getCurrentPosition(
    async pos => {
      ubicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const url = `/paradas/cercanas?lat=${ubicacion.lat}&lng=${ubicacion.lng}` +
                    `&radio_km=5&limite=8&solo_activas=${soloActivas.checked}`;
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error(await leerError(respuesta, "No se pudo buscar cerca de ti"));

        const datos = await respuesta.json();
        dibujarUsuario();

        if (datos.total === 0) {
          cercanas = null;
          mostrarMensaje("No hay paradas a menos de 5 km de tu ubicación.", "error");
          mapa.setView([ubicacion.lat, ubicacion.lng], 14);
          pintar(false);
        } else {
          cercanas = datos.paradas;
          mostrarMensaje(`Encontramos ${datos.total} parada(s) cerca de ti.`, "exito");
          pintar(true);
        }
      } catch (error) {
        mostrarMensaje(error.message, "error");
      } finally {
        restaurarBotonCerca();
      }
    },
    error => {
      const motivos = {
        1: "Permiso de ubicación denegado. Actívalo en tu navegador para usar esta función.",
        2: "No se pudo determinar tu ubicación.",
        3: "Se agotó el tiempo buscando tu ubicación."
      };
      let texto = motivos[error.code] || "No se pudo obtener tu ubicación.";
      if (!window.isSecureContext) {
        texto += " (La ubicación requiere HTTPS o localhost.)";
      }
      mostrarMensaje(texto, "error");
      restaurarBotonCerca();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

function restaurarBotonCerca() {
  btnCerca.disabled = false;
  btnCerca.textContent = "📍 Paradas cerca de mí";
}

// ============================================
// Eventos
// ============================================
lista.addEventListener("click", evento => {
  const boton = evento.target.closest(".btn-ubicar");
  if (!boton) return;

  const parada = (cercanas || paradas).find(p => p.id === boton.dataset.id);
  if (!parada) return;

  if (marcadorResaltado) mapa.removeLayer(marcadorResaltado);
  marcadorResaltado = L.marker([parada.latitud, parada.longitud], {
    icon: crearIcono("pin--seleccion"), zIndexOffset: 1000
  }).addTo(mapa).bindPopup(textoPopup(parada)).openPopup();

  mapa.setView([parada.latitud, parada.longitud], 17);
  document.getElementById("mapa").scrollIntoView({ behavior: "smooth", block: "center" });
});

btnCerca.addEventListener("click", buscarCercanas);

btnTodas.addEventListener("click", () => {
  cercanas = null;
  ubicacion = null;
  capaUsuario.clearLayers();
  pintar(true);
});

filtroRuta.addEventListener("change", () => pintar(true));
soloActivas.addEventListener("change", () => pintar(false));
buscador.addEventListener("input", () => pintar(false));

// PWA: service worker (solo funciona en HTTPS o localhost)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* sin soporte offline */ });
  });
}

cargarDatos();
