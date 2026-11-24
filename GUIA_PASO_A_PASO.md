# Guía paso a paso — Rutas Puebla (Sprint 1)

Sigue los pasos en orden. Cada uno tiene una forma de **comprobar que salió bien**.

---

## Paso 1 · Requisitos

- Python **3.11 o superior** → comprueba con `python --version`
- Cuenta gratuita en Redis Cloud → <https://redis.io/cloud/>
- Editor de código (VS Code) y navegador

## Paso 2 · Crear la base de datos en Redis Cloud

1. Inicia sesión en Redis Cloud y crea una **suscripción gratuita (Free)**.
2. Crea una **base de datos** dentro de la suscripción.
3. Entra a la base de datos → botón **Connect** → copia:
   - **Endpoint** (host:puerto), por ejemplo `redis-12345.c1.us-east-1-2.ec2.redns.redis-cloud.com:12345`
   - **Usuario** (normalmente `default`)
   - **Contraseña**
4. Arma tu cadena de conexión:

   ```
   REDIS_URL=rediss://default:TU_PASSWORD@TU_HOST:PUERTO
   ```

> ⚠️ Si tu base **no** tiene TLS activado, usa `redis://` en lugar de `rediss://`.
> Si tu contraseña tiene caracteres especiales (`@`, `#`, `/`), codifícalos (por ejemplo `@` → `%40`).

## Paso 3 · Preparar el proyecto

Descomprime el ZIP, entra a la carpeta y crea el entorno virtual:

```bash
cd rutas-puebla
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

✅ Comprobación: `pip list` muestra `fastapi`, `uvicorn`, `redis`, `python-dotenv`.

## Paso 4 · Configurar `.env`

```bash
cp .env.example .env            # Windows: copy .env.example .env
```

Abre `.env` y pega tu cadena real. **No agregues comillas ni espacios.**

## Paso 5 · Probar la conexión a Redis

```bash
python -c "from app.database import probar_conexion; print(probar_conexion())"
```

✅ Debe imprimir `True`. Si imprime `False`, ve a *Problemas comunes*.

## Paso 6 · (Opcional) Cargar paradas de ejemplo

```bash
python -m scripts.cargar_ejemplos
```

✅ Verás 4 paradas guardadas (Zócalo, BUAP, CAPU, Paseo Bravo).

## Paso 7 · Ejecutar la aplicación

```bash
uvicorn app.main:app --reload
```

| Qué | URL |
|---|---|
| Aplicación web | http://127.0.0.1:8000/ |
| Swagger (API) | http://127.0.0.1:8000/docs |
| Estado de Redis | http://127.0.0.1:8000/estado → `"redis_conectado": true` |

## Paso 8 · Pruebas manuales del CRUD (entregable)

Hazlas en **Swagger** (`/docs`) y toma capturas de pantalla para tu evidencia.

| # | Prueba | Cómo | Resultado esperado |
|---|---|---|---|
| 1 | Crear | `POST /paradas` con el JSON de abajo | **201** y un `id` tipo `pue-a1b2c3d4` |
| 2 | Consultar | `GET /paradas/{id}` con ese id | **200** y los datos de la parada |
| 3 | Listar | `GET /paradas` | **200**, `total` ≥ 1 |
| 4 | Actualizar | `PUT /paradas/{id}` cambiando `activa` a `false` | **200** "Parada actualizada" |
| 5 | Eliminar | `DELETE /paradas/{id}` | **200** "Parada eliminada" |
| 6 | Error claro | `GET /paradas/no-existe` | **404** "Parada no encontrada" |

JSON para crear:

```json
{
  "nombre": "Parada BUAP",
  "colonia": "Los Volcanes",
  "municipio": "Puebla",
  "latitud": 19.0467,
  "longitud": -98.2065,
  "rutas": ["Ruta 4", "Ruta 61"],
  "activa": true
}
```

> El `id` y `creado_en` los genera el servidor; no hace falta enviarlos.

## Paso 9 · Pruebas en la interfaz web

1. Abre http://127.0.0.1:8000/
2. **Registrar**: llena el formulario o **toca el mapa** para autocompletar latitud/longitud → *Guardar parada*.
3. **Buscar**: escribe una colonia, nombre o ruta en el buscador.
4. **Ver en mapa**: centra y resalta la parada.
5. **Editar**: carga los datos al formulario → *Actualizar parada*.
6. **Eliminar**: confirma el aviso.

## Paso 10 · Verificar en Redis Cloud (HU-06)

En el panel de Redis Cloud abre **Redis Insight** (o el navegador de datos) y busca las claves `parada:*`.
✅ Eso demuestra que los datos viven en la nube y no en tu equipo.

## Paso 11 · Subir a GitHub

```bash
git init
git add .
git commit -m "Sprint 1: CRUD de paradas con FastAPI y Redis Cloud"
```

Comprueba con `git status` que **`.env` no aparece** en la lista.

---

## Criterios de aceptación

- [ ] Crear parada y obtener ID único
- [ ] Consultar por ID
- [ ] Listar todas
- [ ] Actualizar existente
- [ ] Eliminar
- [ ] Errores claros si no existe (404)
- [ ] Conexión por variable `REDIS_URL`
- [ ] `PING` correcto (`/estado`)

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `RuntimeError: Falta la variable REDIS_URL` | No existe `.env` o está vacío | Repite el paso 4 |
| `redis_conectado: false` | URL, usuario o contraseña incorrectos | Copia de nuevo desde *Connect* en Redis Cloud |
| `ssl.SSLError` / `Connection reset` | La base no tiene TLS | Cambia `rediss://` por `redis://` |
| `AuthenticationError` | Contraseña con caracteres especiales | Codifícalos en URL (`@` → `%40`) |
| Timeout al conectar | Firewall / IP bloqueada | Revisa *Security* y permisos de red en Redis Cloud |
| `ModuleNotFoundError: app` | Ejecutas desde otra carpeta | Corre los comandos dentro de `rutas-puebla/` |
| El mapa se ve gris | Sin internet (OpenStreetMap y Leaflet usan CDN) | Revisa tu conexión |
| `uvicorn` no se reconoce | Entorno virtual inactivo | Actívalo (paso 3) |

---

## Mejoras ya incluidas respecto al documento original

El documento base tenía fallos que impedían que funcionara; ya están corregidos:

1. **Plantillas de JavaScript rotas** (`parada.activa?"Activa":"Inactiva"` pegado sin `${}` y etiquetas `<divclass=...>` sin espacios) → reescritas.
2. **`fetch(\`API/{id}\`)`** apuntaba a una URL inexistente → ahora `${API}/${id}`.
3. **Funciones faltantes** (`cargarParadaParaEditar`, `eliminarParada`) que el documento llamaba pero nunca definía → implementadas.
4. **Redirección 307 en `POST /paradas`**: la ruta `"/"` con prefijo causaba redirecciones; ahora es `""`.
5. **El cliente podía mandar su propio `id`/`creado_en`** al crear o actualizar; ahora se usan modelos separados (`ParadaEntrada` y `Parada`) y el `PUT` conserva la fecha de creación.
6. **Creación atómica** con `SET ... NX` para no sobrescribir por carrera.
7. **XSS**: los textos de las paradas se escapan antes de pintarse en HTML.
8. **`datetime.utcnow()`** (obsoleto) → `datetime.now(timezone.utc)`.
9. **Coordenada del Zócalo**: el ejemplo traía longitud `-98.1937`; el Zócalo de Puebla ronda `-98.198`. Corregida a `-98.1977` en los ejemplos.

## Siguiente sprint (sugerido)

- Búsqueda por colonia en el backend (`GET /paradas?colonia=...`)
- Geolocalización del pasajero ("paradas cerca de mí") con `GEOADD` / `GEOSEARCH` de Redis
- Entidad **Ruta** con su recorrido dibujado en el mapa
- Autenticación para que solo administradores editen
- Convertir en PWA para usarla como app móvil
