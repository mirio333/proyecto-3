/* ============================================
   Rutas Puebla · administración (requiere sesión)
   Requiere comun.js y Leaflet
   ============================================ */

const vistaLogin = document.getElementById("vista-login");
const vistaPanel = document.getElementById("vista-panel");
const mensaje = document.getElementById("mensaje");
const mostrarMensaje = (texto, tipo) => mostrarMensajeEn(mensaje, texto, tipo);

// ============================================
// Sesión (el token se guarda solo mientras la pestaña esté abierta)
// ============================================
let token = "";
try { token = sessionStorage.getItem("rp_token") || ""; } catch (_) { /* sin almacenamiento */ }

function guardarToken(valor) {
  token = valor;
  try {
    if (valor) sessionStorage.setItem("rp_token", valor);
    else sessionStorage.removeItem("rp_token");
  } catch (_) { /* ignorar */ }
}

// fetch que agrega el token y cierra sesión si caduca
async function api(url, opciones = {}) {
  const headers = { ...(opciones.headers || {}), "X-Admin-Token": token };
  if (opciones.body) headers["Content-Type"] = "application/json";

  const respuesta = await fetch(url, { ...opciones, headers });
  if (respuesta.status === 401) {
    cerrarSesion("Tu sesión caducó. Inicia sesión de nuevo.");
    throw new Error("Sesión caducada");
  }
  return respuesta;
}

function mostrarLogin(texto) {
  vistaPanel.classList.add("oculto");
  vistaLogin.classList.remove("oculto");
  if (texto) mostrarMensajeEn(document.getElementById("mensaje-login"), texto, "error");
}

function cerrarSesion(texto) {
  guardarToken("");
  mostrarLogin(texto);
}

async function entrarAlPanel() {
  vistaLogin.classList.add("oculto");
  vistaPanel.classList.remove("oculto");
  mapa.invalidateSize();
  await cargarTodo();
}

document.getElementById("form-login").addEventListener("submit", async evento => {
  evento.preventDefault();
  const aviso = document.getElementById("mensaje-login");
  try {
    const respuesta = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("password").value })
    });
    if (!respuesta.ok) throw new Error(await leerError(respuesta, "No se pudo iniciar sesión"));

    guardarToken((await respuesta.json()).token);
    document.getElementById("password").value = "";
    mostrarMensajeEn(aviso, "", "");
    entrarAlPanel();
  } catch (error) {
    mostrarMensajeEn(aviso, error.message, "error");
  }
});

document.getElementById("btn-salir").addEventListener("click", () => cerrarSesion());

// ============================================
// Pestañas
// ============================================
document.querySelectorAll(".pestana").forEach(boton => {
  boton.addEventListener("click", () => {
    document.querySelectorAll(".pestana").forEach(b => b.classList.toggle("pestana--activa", b === boton));
    document.getElementById("tab-paradas").classList.toggle("oculto", boton.dataset.tab !== "paradas");
    document.getElementById("tab-rutas").classList.toggle("oculto", boton.dataset.tab !== "rutas");
    if (boton.dataset.tab === "paradas") mapa.invalidateSize();
  });
});

// ============================================
// Mapa (vista de administración)
// ============================================
const mapa = crearMapa("mapa");
const capaParadas = L.layerGroup().addTo(mapa);
let marcadorSeleccionado = null;
let marcadorNuevo = null;

mapa.on("click", evento => {
  const { lat, lng } = evento.latlng;
  document.getElementById("latitud").value = lat.toFixed(6);
  document.getElementById("longitud").value = lng.toFixed(6);

  if (marcadorNuevo) mapa.removeLayer(marcadorNuevo);
  marcadorNuevo = L.marker([lat, lng], { icon: crearIcono("pin--seleccion") })
    .addTo(mapa)
    .bindTooltip("Ubicación para la parada")
    .openTooltip();
});

// ============================================
// PARADAS
// ============================================
const form = document.getElementById("form-parada");
const lista = document.getElementById("lista-paradas");
const contador = document.getElementById("contador");
const buscador = document.getElementById("buscador");
const btnCancelar = document.getElementById("btn-cancelar");
const btnGuardar = document.getElementById("btn-guardar");
const titulo = document.getElementById("titulo-formulario");

let paradas = [];
let rutas = [];

function limpiarFormulario() {
  form.reset();
  document.getElementById("parada-id").value = "";
  btnCancelar.classList.add("oculto");
  btnGuardar.textContent = "Guardar parada";
  titulo.innerHTML = '<span class="icono">🪧</span> Registrar parada';
  if (marcadorNuevo) { mapa.removeLayer(marcadorNuevo); marcadorNuevo = null; }
}

function coincide(parada, texto) {
  if (!texto) return true;
  const t = texto.toLowerCase();
  return parada.nombre.toLowerCase().includes(t) ||
         parada.colonia.toLowerCase().includes(t) ||
         parada.rutas.some(r => r.toLowerCase().includes(t));
}

function pintarParadas() {
  const filtradas = paradas.filter(p => coincide(p, buscador.value.trim()));

  lista.innerHTML = "";
  capaParadas.clearLayers();
  contador.textContent = paradas.length
    ? `Mostrando ${filtradas.length} de ${paradas.length} paradas` : "";

  if (filtradas.length === 0) {
    lista.innerHTML = `<div class="vacio">${
      paradas.length ? "Ninguna parada coincide con tu búsqueda." : "Aún no hay paradas registradas. ¡Agrega la primera! 🌱"
    }</div>`;
    return;
  }

  filtradas.forEach(parada => {
    const rutasHtml = parada.rutas.length
      ? parada.rutas.map(r => `<span class="ruta">${esc(r)}</span>`).join("")
      : "<em>Sin rutas</em>";

    const tarjeta = document.createElement("article");
    tarjeta.className = "parada" + (parada.activa ? "" : " parada--inactiva");
    tarjeta.innerHTML = `
      <div class="parada__cabecera">
        <h3>${esc(parada.nombre)}</h3>
        <span class="etiqueta ${parada.activa ? "" : "etiqueta--inactiva"}">${parada.activa ? "Activa" : "Inactiva"}</span>
      </div>
      <p class="id">ID: ${esc(parada.id)}</p>
      <p><strong>Colonia:</strong> ${esc(parada.colonia)} · ${esc(parada.municipio)}</p>
      <p><strong>Coordenadas:</strong> ${esc(parada.latitud)}, ${esc(parada.longitud)}</p>
      <div class="rutas">${rutasHtml}</div>
      <div class="acciones">
        <button class="btn btn--chico btn--mapa btn-ubicar" data-id="${esc(parada.id)}">Ver en mapa</button>
        <button class="btn btn--chico btn--editar btn-editar" data-id="${esc(parada.id)}">Editar</button>
        <button class="btn btn--chico btn--eliminar btn-eliminar" data-id="${esc(parada.id)}">Eliminar</button>
      </div>
    `;
    lista.appendChild(tarjeta);

    L.marker([parada.latitud, parada.longitud], {
      icon: crearIcono(parada.activa ? "" : "pin--inactiva")
    }).addTo(capaParadas).bindPopup(textoPopup(parada)).bindTooltip(parada.nombre);
  });
}

async function cargarParadas() {
  try {
    const respuesta = await fetch("/paradas");
    if (!respuesta.ok) throw new Error("No se pudo obtener la lista de paradas");
    paradas = (await respuesta.json()).paradas || [];
    pintarParadas();
    llenarSelectorParadasRuta();
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

async function cargarParadaParaEditar(id) {
  const parada = paradas.find(p => p.id === id);
  if (!parada) return;

  document.getElementById("parada-id").value = parada.id;
  document.getElementById("nombre").value = parada.nombre;
  document.getElementById("colonia").value = parada.colonia;
  document.getElementById("latitud").value = parada.latitud;
  document.getElementById("longitud").value = parada.longitud;
  document.getElementById("rutas").value = parada.rutas.join(", ");
  document.getElementById("activa").value = String(parada.activa);

  btnCancelar.classList.remove("oculto");
  btnGuardar.textContent = "Actualizar parada";
  titulo.innerHTML = '<span class="icono">✏️</span> Editar parada';
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function eliminarParada(id) {
  if (!confirm("¿Deseas eliminar esta parada?")) return;
  try {
    const respuesta = await api(`/paradas/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!respuesta.ok) throw new Error(await leerError(respuesta, "No se pudo eliminar la parada"));
    mostrarMensaje("Parada eliminada correctamente.", "exito");
    await cargarTodo();
  } catch (error) {
    if (error.message !== "Sesión caducada") mostrarMensaje(error.message, "error");
  }
}

function ubicarParadaEnMapa(id) {
  const parada = paradas.find(p => p.id === id);
  if (!parada) return;

  if (marcadorSeleccionado) mapa.removeLayer(marcadorSeleccionado);
  marcadorSeleccionado = L.marker([parada.latitud, parada.longitud], {
    icon: crearIcono("pin--seleccion")
  }).addTo(mapa);
  marcadorSeleccionado.bindPopup(textoPopup(parada)).openPopup();
  mapa.setView([parada.latitud, parada.longitud], 16);
  document.querySelector(".panel-mapa").scrollIntoView({ behavior: "smooth" });
}

form.addEventListener("submit", async evento => {
  evento.preventDefault();

  const id = document.getElementById("parada-id").value;
  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    colonia: document.getElementById("colonia").value.trim(),
    municipio: "Puebla",
    latitud: parseFloat(document.getElementById("latitud").value),
    longitud: parseFloat(document.getElementById("longitud").value),
    rutas: document.getElementById("rutas").value.split(",").map(r => r.trim()).filter(Boolean),
    activa: document.getElementById("activa").value === "true"
  };

  try {
    const respuesta = await api(id ? `/paradas/${encodeURIComponent(id)}` : "/paradas", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(datos)
    });
    if (!respuesta.ok) throw new Error(await leerError(respuesta, "Error al guardar"));

    mostrarMensaje(id ? "Parada actualizada correctamente." : "Parada registrada correctamente.", "exito");
    limpiarFormulario();
    await cargarTodo();
  } catch (error) {
    if (error.message !== "Sesión caducada") mostrarMensaje(error.message, "error");
  }
});

lista.addEventListener("click", evento => {
  const boton = evento.target.closest("button");
  if (!boton || !boton.dataset.id) return;
  const id = boton.dataset.id;
  if (boton.classList.contains("btn-editar")) cargarParadaParaEditar(id);
  if (boton.classList.contains("btn-eliminar")) eliminarParada(id);
  if (boton.classList.contains("btn-ubicar")) ubicarParadaEnMapa(id);
});

btnCancelar.addEventListener("click", limpiarFormulario);
document.getElementById("btn-recargar").addEventListener("click", cargarTodo);
buscador.addEventListener("input", pintarParadas);

// ============================================
// RUTAS
// ============================================
const formRuta = document.getElementById("form-ruta");
const listaRutas = document.getElementById("lista-rutas");
const selectAgregar = document.getElementById("ruta-agregar");
const listaOrden = document.getElementById("ruta-orden");
const btnCancelarRuta = document.getElementById("btn-cancelar-ruta");
const btnGuardarRuta = document.getElementById("btn-guardar-ruta");
const tituloRuta = document.getElementById("titulo-form-ruta");

let ordenActual = [];   // ids de paradas, en orden de recorrido

function nombreParada(id) {
  const p = paradas.find(x => x.id === id);
  return p ? `${p.nombre} (${p.colonia})` : `⚠ ${id} (ya no existe)`;
}

function llenarSelectorParadasRuta() {
  selectAgregar.innerHTML = "";
  paradas.forEach(p => {
    const op = document.createElement("option");
    op.value = p.id;
    op.textContent = `${p.nombre} · ${p.colonia}`;
    selectAgregar.appendChild(op);
  });
}

function pintarOrden() {
  listaOrden.innerHTML = "";
  if (ordenActual.length === 0) {
    listaOrden.innerHTML = '<li class="orden__vacio">Aún no agregas paradas.</li>';
    return;
  }
  ordenActual.forEach((id, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="orden__nombre">${esc(nombreParada(id))}</span>
      <span class="orden__botones">
        <button type="button" class="btn btn--chico btn--gris" data-accion="subir" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
        <button type="button" class="btn btn--chico btn--gris" data-accion="bajar" data-i="${i}" ${i === ordenActual.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>
        <button type="button" class="btn btn--chico btn--eliminar" data-accion="quitar" data-i="${i}" aria-label="Quitar">✕</button>
      </span>`;
    listaOrden.appendChild(li);
  });
}

listaOrden.addEventListener("click", evento => {
  const boton = evento.target.closest("button");
  if (!boton) return;
  const i = Number(boton.dataset.i);
  if (boton.dataset.accion === "subir" && i > 0) {
    [ordenActual[i - 1], ordenActual[i]] = [ordenActual[i], ordenActual[i - 1]];
  } else if (boton.dataset.accion === "bajar" && i < ordenActual.length - 1) {
    [ordenActual[i + 1], ordenActual[i]] = [ordenActual[i], ordenActual[i + 1]];
  } else if (boton.dataset.accion === "quitar") {
    ordenActual.splice(i, 1);
  }
  pintarOrden();
});

document.getElementById("btn-agregar-parada").addEventListener("click", () => {
  if (selectAgregar.value) {
    ordenActual.push(selectAgregar.value);
    pintarOrden();
  }
});

function limpiarFormularioRuta() {
  formRuta.reset();
  document.getElementById("ruta-id").value = "";
  document.getElementById("ruta-color").value = "#b4532e";
  ordenActual = [];
  pintarOrden();
  btnCancelarRuta.classList.add("oculto");
  btnGuardarRuta.textContent = "Guardar ruta";
  tituloRuta.innerHTML = '<span class="icono">🧭</span> Registrar ruta';
}

function pintarRutas() {
  listaRutas.innerHTML = "";
  if (rutas.length === 0) {
    listaRutas.innerHTML = '<div class="vacio">Aún no hay rutas. Crea la primera con sus paradas en orden. 🧭</div>';
    return;
  }
  rutas.forEach(r => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "parada" + (r.activa ? "" : " parada--inactiva");
    tarjeta.style.borderLeftColor = r.color;
    tarjeta.innerHTML = `
      <div class="parada__cabecera">
        <h3>${esc(r.nombre)}</h3>
        <span class="etiqueta ${r.activa ? "" : "etiqueta--inactiva"}">${r.activa ? "Activa" : "Inactiva"}</span>
      </div>
      <p class="id">ID: ${esc(r.id)}</p>
      <p><strong>Recorrido:</strong> ${r.paradas_detalle.length
        ? r.paradas_detalle.map(p => esc(p.nombre)).join(" → ") : "Sin paradas"}</p>
      <div class="acciones">
        <button class="btn btn--chico btn--editar" data-accion="editar" data-id="${esc(r.id)}">Editar</button>
        <button class="btn btn--chico btn--eliminar" data-accion="eliminar" data-id="${esc(r.id)}">Eliminar</button>
      </div>`;
    listaRutas.appendChild(tarjeta);
  });
}

async function cargarRutas() {
  try {
    const respuesta = await fetch("/rutas");
    if (!respuesta.ok) throw new Error("No se pudo obtener la lista de rutas");
    rutas = (await respuesta.json()).rutas || [];
    pintarRutas();
  } catch (error) {
    mostrarMensaje(error.message, "error");
  }
}

formRuta.addEventListener("submit", async evento => {
  evento.preventDefault();
  const id = document.getElementById("ruta-id").value;

  if (ordenActual.length < 2) {
    mostrarMensaje("Una ruta necesita al menos 2 paradas para dibujar su recorrido.", "error");
    return;
  }

  const datos = {
    nombre: document.getElementById("ruta-nombre").value.trim(),
    color: document.getElementById("ruta-color").value,
    paradas: ordenActual,
    activa: document.getElementById("ruta-activa").value === "true"
  };

  try {
    const respuesta = await api(id ? `/rutas/${encodeURIComponent(id)}` : "/rutas", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(datos)
    });
    if (!respuesta.ok) throw new Error(await leerError(respuesta, "Error al guardar la ruta"));

    mostrarMensaje(id ? "Ruta actualizada correctamente." : "Ruta registrada correctamente.", "exito");
    limpiarFormularioRuta();
    await cargarRutas();
  } catch (error) {
    if (error.message !== "Sesión caducada") mostrarMensaje(error.message, "error");
  }
});

listaRutas.addEventListener("click", async evento => {
  const boton = evento.target.closest("button");
  if (!boton || !boton.dataset.id) return;
  const ruta = rutas.find(r => r.id === boton.dataset.id);
  if (!ruta) return;

  if (boton.dataset.accion === "editar") {
    document.getElementById("ruta-id").value = ruta.id;
    document.getElementById("ruta-nombre").value = ruta.nombre;
    document.getElementById("ruta-color").value = ruta.color;
    document.getElementById("ruta-activa").value = String(ruta.activa);
    ordenActual = [...ruta.paradas];
    pintarOrden();
    btnCancelarRuta.classList.remove("oculto");
    btnGuardarRuta.textContent = "Actualizar ruta";
    tituloRuta.innerHTML = '<span class="icono">✏️</span> Editar ruta';
    formRuta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (boton.dataset.accion === "eliminar") {
    if (!confirm(`¿Eliminar la ruta "${ruta.nombre}"? Las paradas no se borran.`)) return;
    try {
      const respuesta = await api(`/rutas/${encodeURIComponent(ruta.id)}`, { method: "DELETE" });
      if (!respuesta.ok) throw new Error(await leerError(respuesta, "No se pudo eliminar la ruta"));
      mostrarMensaje("Ruta eliminada correctamente.", "exito");
      await cargarRutas();
    } catch (error) {
      if (error.message !== "Sesión caducada") mostrarMensaje(error.message, "error");
    }
  }
});

btnCancelarRuta.addEventListener("click", limpiarFormularioRuta);

// ============================================
// Arranque
// ============================================
async function cargarTodo() {
  await cargarParadas();   // primero paradas: las rutas las usan para mostrar nombres
  await cargarRutas();
}

async function iniciar() {
  pintarOrden();
  if (!token) return mostrarLogin();

  // Comprueba que el token guardado siga siendo válido
  try {
    const respuesta = await fetch("/auth/verificar", { headers: { "X-Admin-Token": token } });
    if (!respuesta.ok) return cerrarSesion();
    entrarAlPanel();
  } catch (_) {
    mostrarLogin("No se pudo conectar con el servidor.");
  }
}

iniciar();
