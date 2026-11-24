"""CRUD de rutas (clave: ruta:{id}). Una ruta es una lista ordenada de paradas."""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.almacen import cargar_docs, clave_parada, clave_ruta
from app.database import redis_client
from app.models import Ruta, RutaEntrada
from app.seguridad import requiere_admin

router = APIRouter(prefix="/rutas", tags=["Rutas"])


def _con_detalle(ruta: dict, paradas_por_id: dict) -> dict:
    """Agrega las paradas completas y el trazado [[lat, lng], ...] para dibujar la línea."""
    detalle = [paradas_por_id[i] for i in ruta.get("paradas", []) if i in paradas_por_id]
    return {
        **ruta,
        "paradas_detalle": detalle,
        "trazado": [[p["latitud"], p["longitud"]] for p in detalle],
    }


def _validar_paradas(ids: List[str]) -> None:
    faltantes = [i for i in ids if not redis_client.exists(clave_parada(i))]
    if faltantes:
        raise HTTPException(
            status_code=422,
            detail=f"Estas paradas no existen: {', '.join(faltantes)}",
        )


# ---------------- Lectura pública ----------------
@router.get("")
def listar_rutas(solo_activas: bool = Query(False)):
    rutas = cargar_docs("ruta:*")
    if solo_activas:
        rutas = [r for r in rutas if r.get("activa")]

    paradas_por_id = {p["id"]: p for p in cargar_docs("parada:*")}
    rutas = [_con_detalle(r, paradas_por_id) for r in rutas]
    rutas.sort(key=lambda r: r.get("nombre", "").lower())
    return {"total": len(rutas), "rutas": rutas}


@router.get("/{ruta_id}")
def obtener_ruta(ruta_id: str):
    valor = redis_client.get(clave_ruta(ruta_id))
    if not valor:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")

    paradas_por_id = {p["id"]: p for p in cargar_docs("parada:*")}
    return _con_detalle(json.loads(valor), paradas_por_id)


# ---------------- Escritura (solo administrador) ----------------
@router.post("", status_code=201, dependencies=[Depends(requiere_admin)])
def crear_ruta(datos: RutaEntrada):
    _validar_paradas(datos.paradas)
    ruta = Ruta(**datos.model_dump())

    if not redis_client.set(clave_ruta(ruta.id), ruta.model_dump_json(), nx=True):
        raise HTTPException(status_code=409, detail="La ruta ya existe")

    return {"mensaje": "Ruta creada", "id": ruta.id}


@router.put("/{ruta_id}", dependencies=[Depends(requiere_admin)])
def actualizar_ruta(ruta_id: str, datos: RutaEntrada):
    actual = redis_client.get(clave_ruta(ruta_id))
    if not actual:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")

    _validar_paradas(datos.paradas)
    ruta = Ruta(
        **datos.model_dump(),
        id=ruta_id,
        creado_en=json.loads(actual).get("creado_en"),
    )
    redis_client.set(clave_ruta(ruta_id), ruta.model_dump_json())
    return {"mensaje": "Ruta actualizada", "ruta": json.loads(ruta.model_dump_json())}


@router.delete("/{ruta_id}", dependencies=[Depends(requiere_admin)])
def eliminar_ruta(ruta_id: str):
    if not redis_client.delete(clave_ruta(ruta_id)):
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    return {"mensaje": "Ruta eliminada", "id": ruta_id}
