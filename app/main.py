"""Servidor principal de Rutas Puebla."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.almacen import reindexar_geo
from app.database import probar_conexion
from app.models import LoginEntrada
from app.routes import router as router_paradas
from app.rutas_api import router as router_rutas
from app.seguridad import crear_token, requiere_admin, validar_login

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    # Reconstruye el índice geoespacial para que "cerca de mí" incluya todas las paradas
    try:
        total = reindexar_geo()
        print(f"[Rutas Puebla] Índice GEO listo: {total} paradas")
    except Exception as error:  # la app debe arrancar aunque Redis falle
        print(f"[Rutas Puebla] No se pudo indexar: {error}")
    yield


app = FastAPI(
    title="Rutas Puebla",
    description="Paradas y rutas de transporte público en Puebla con Redis Cloud",
    version="2.0.0",
    lifespan=ciclo_de_vida,
)

# El token de administrador viaja en un encabezado (no en cookies), por eso "*" no
# expone sesiones. En producción conviene limitarlo a tu dominio.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router_paradas)
app.include_router(router_rutas)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ---------------- Páginas ----------------
@app.get("/", include_in_schema=False)
def inicio():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/admin", include_in_schema=False)
def admin():
    return FileResponse(STATIC_DIR / "admin.html")


# ---------------- PWA (deben servirse desde la raíz) ----------------
@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return FileResponse(
        STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json"
    )


@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(
        STATIC_DIR / "sw.js",
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache"},
    )


# ---------------- Sistema y autenticación ----------------
@app.get("/estado", tags=["Sistema"])
def estado():
    return {"proyecto": "Rutas Puebla", "redis_conectado": probar_conexion()}


@app.post("/auth/login", tags=["Administración"])
def login(datos: LoginEntrada, request: Request):
    validar_login(request, datos.password)
    token, expira = crear_token()
    return {"token": token, "expira": expira}


@app.get("/auth/verificar", tags=["Administración"], dependencies=[Depends(requiere_admin)])
def verificar():
    return {"ok": True}
