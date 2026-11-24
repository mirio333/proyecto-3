/* ============================================
   Rutas Puebla · utilidades compartidas
   (vista pública y vista de administración)
   ============================================ */

const CENTRO_PUEBLA = [19.0414, -98.2063];

// Evita inyección de HTML con datos escritos por usuarios
function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function crearMapa(idContenedor) {
  const mapa = L.map(idContenedor).setView(CENTRO_PUEBLA, 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mapa);
  return mapa;
}

function crearIcono(clase) {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${clase || ""}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

async function leerError(respuesta, porDefecto) {
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo.detail === "string") return cuerpo.detail;
    if (Array.isArray(cuerpo.detail)) {
      return cuerpo.detail.map(e => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join(" · ");
    }
  } catch (_) { /* sin cuerpo JSON */ }
  return porDefecto;
}

function formatoDistancia(metros) {
  if (metros == null) return "";
  return metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1)} km`;
}

function enlaceComoLlegar(parada) {
  return `https://www.google.com/maps/dir/?api=1&destination=${parada.latitud},${parada.longitud}&travelmode=walking`;
}

function textoPopup(parada) {
  const rutas = parada.rutas.length ? parada.rutas.map(esc).join(", ") : "Sin rutas";
  return `
    <div class="popup-titulo"><strong>${esc(parada.nombre)}</strong></div>
    ${esc(parada.colonia)}<br>
    Rutas: ${rutas}<br>
    Estado: ${parada.activa ? "Activa" : "Inactiva"}<br>
    <a href="${enlaceComoLlegar(parada)}" target="_blank" rel="noopener">Cómo llegar ↗</a>
  `;
}

function mostrarMensajeEn(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = tipo || "";
  clearTimeout(elemento._temporizador);
  if (texto) {
    elemento._temporizador = setTimeout(() => {
      elemento.textContent = "";
      elemento.className = "";
    }, 6000);
  }
}
