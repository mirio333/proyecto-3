<<<<<<< HEAD
# 🚌 Rutas Puebla — Sprint 1

API REST + interfaz web para administrar **paradas de transporte público de la ciudad de Puebla**.
Los datos se guardan como documentos JSON en **Redis Cloud** (no en tu equipo).

| Elemento | Definición |
|---|---|
| Producto | API REST "Rutas Puebla" |
| Entidad | Parada |
| Base de datos | Redis Cloud (clave-valor / JSON) |
| Lenguaje | Python 3.11+ |
| Framework | FastAPI |
| Cliente Redis | redis-py |
| Frontend | HTML + CSS + JavaScript + Leaflet (OpenStreetMap) |

## Estructura

```
rutas-puebla/
├── app/
│   ├── __init__.py
│   ├── main.py        # servidor, CORS, archivos estáticos
│   ├── database.py    # conexión a Redis Cloud
│   ├── models.py      # modelos Pydantic (Parada)
│   └── routes.py      # CRUD /paradas
├── static/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── scripts/
│   └── cargar_ejemplos.py   # paradas de ejemplo
├── .env.example
├── requirements.txt
├── GUIA_PASO_A_PASO.md
└── README.md
```

## Instalación rápida

```bash
# 1. Entorno virtual
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Dependencias
pip install -r requirements.txt

# 3. Configuración
cp .env.example .env              # Windows: copy .env.example .env
# edita .env y pon tu REDIS_URL de Redis Cloud

# 4. (Opcional) cargar paradas de ejemplo
python -m scripts.cargar_ejemplos

# 5. Ejecutar
uvicorn app.main:app --reload
```

Abre:

- Aplicación: <http://127.0.0.1:8000/>
- Swagger: <http://127.0.0.1:8000/docs>
- Estado de Redis: <http://127.0.0.1:8000/estado>

## Endpoints

| Método | Ruta | Acción |
|---|---|---|
| POST | `/paradas` | Crear parada (devuelve ID único) |
| GET | `/paradas` | Listar paradas |
| GET | `/paradas/{id}` | Obtener una parada |
| PUT | `/paradas/{id}` | Actualizar parada |
| DELETE | `/paradas/{id}` | Eliminar parada |
| GET | `/estado` | Verifica conexión (PING) a Redis |

## Modelo de datos

Clave en Redis: `parada:{id}` (ejemplo `parada:pue-001`)

```json
{
  "id": "pue-001",
  "nombre": "Parada Zócalo",
  "colonia": "Centro",
  "municipio": "Puebla",
  "latitud": 19.0431,
  "longitud": -98.1977,
  "rutas": ["Ruta 1", "Ruta 15", "Ruta 72"],
  "activa": true,
  "creado_en": "2026-11-08T23:00:00Z"
}
```

## Seguridad

- **Nunca subas `.env` a GitHub** (ya está en `.gitignore`).
- `allow_origins=["*"]` en CORS es solo para desarrollo; en producción pon tu dominio.
- Si publicaste tu contraseña de Redis por accidente, cámbiala en el panel de Redis Cloud.

## Entregables del Sprint 1

- [x] Repositorio con estructura del proyecto
- [x] API CRUD de paradas en FastAPI
- [x] Conexión segura (TLS `rediss://`) a Redis Cloud
- [x] Documentación automática Swagger en `/docs`
- [x] Frontend responsive con mapa Leaflet
- [ ] Pruebas manuales de los 5 endpoints (ver `GUIA_PASO_A_PASO.md`, paso 8)
- [x] README con instrucciones de instalación y ejecución
=======
# proyecto-3
este proyecto es uno de rutas
>>>>>>> b71b7d3208fc447dcf0291dd5400029be2607654
