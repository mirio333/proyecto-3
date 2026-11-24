"""CRUD de paradas sobre Redis (clave: parada:{id}) + búsquedas para pasajeros."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.almacen import (
    GEO_KEY,
    cargar_docs,
    clave_parada,
    geo_guardar,
    geo_quitar,
)
from app.database import redis_client
from app.models import Parada, ParadaEntrada
from app.seguridad import requiere_admin

router = APIRouter(prefix="/paradas", tags=["Paradas"])


# ---------------- Lectura pública ----------------
@router.get("")
def listar_paradas(
    ruta: Optional[str] = Query(None, description="Nombre exacto de la ruta, ej. 'Ruta 15'"),
    colonia: Optional[str] = Query(None, description="Texto contenido en la colonia"),
    q: Optional[str] = Query(None, description="Busca en nombre, colonia o rutas"),
    solo_activas: bool = Query(False),
):
    paradas = cargar_docs("parada:*")

    if solo_activas:
        paradas = [p for p in paradas if p.get("activa")]
    if ruta:
        r = ruta.strip().lower()
        paradas = [p for p in paradas if r in [x.lower() for x in p.get("rutas", [])]]
    if colonia:
        c = colonia.strip().lower()
        paradas = [p for p in paradas if c in p.get("colonia", "").lower()]
    if q:
        t = q.strip().lower()
        paradas = [
            p for p in paradas
            if t in p.get("nombre", "").lower()
            or t in p.get("colonia", "").lower()
            or any(t in x.lower() for x in p.get("rutas", []))
        ]

    paradas.sort(key=lambda p: p.get("nombre", "").lower())
    return {"total": len(paradas), "paradas": paradas}


# IMPORTANTE: va antes de "/{parada_id}" para que "cercanas" no se tome como un id
@router.get("/cercanas")
def paradas_cercanas(
    lat: float = Query(..., ge=-85, le=85),
    lng: float = Query(..., ge=-180, le=180),
    radio_km: float = Query(5, gt=0, le=50),
    limite: int = Query(5, ge=1, le=50),
    solo_activas: bool = Query(True),
):
    """Paradas más cercanas a un punto, ordenadas por distancia (Redis GEOSEARCH)."""
    encontrados = redis_client.geosearch(
        GEO_KEY,
        longitude=lng,
        latitude=lat,
        radius=radio_km,
        unit="km",
        sort="ASC",
        withdist=True,
    )
    if not encontrados:
        return {"total": 0, "radio_km": radio_km, "paradas": []}

    ids = [item[0] for item in encontrados]
    distancias = {item[0]: float(item[1]) for item in encontrados}
    valores = redis_client.mget([clave_parada(i) for i in ids])

    resultado = []
    for parada_id, valor in zip(ids, valores):
        if not valor:
            continue
        parada = json.loads(valor)
        if solo_activas and not parada.get("activa"):
            continue
        parada["distancia_m"] = round(distancias[parada_id] * 1000)
        resultado.append(parada)
        if len(resultado) >= limite:
            break

    return {"total": len(resultado), "radio_km": radio_km, "paradas": resultado}


@router.get("/{parada_id}")
def obtener_parada(parada_id: str):
    valor = redis_client.get(clave_parada(parada_id))

    if not valor:
        raise HTTPException(status_code=404, detail="Parada no encontrada")

    return json.loads(valor)


# ---------------- Escritura (solo administrador) ----------------
@router.post("", status_code=201, dependencies=[Depends(requiere_admin)])
def crear_parada(datos: ParadaEntrada):
    parada = Parada(**datos.model_dump())
    clave = clave_parada(parada.id)

    # nx=True: solo guarda si la clave NO existe (evita sobrescribir)
    if not redis_client.set(clave, parada.model_dump_json(), nx=True):
        raise HTTPException(status_code=409, detail="La parada ya existe")

    geo_guardar(json.loads(parada.model_dump_json()))
    return {"mensaje": "Parada creada", "id": parada.id}


@router.put("/{parada_id}", dependencies=[Depends(requiere_admin)])
def actualizar_parada(parada_id: str, datos: ParadaEntrada):
    clave = clave_parada(parada_id)
    actual = redis_client.get(clave)

    if not actual:
        raise HTTPException(status_code=404, detail="Parada no encontrada")

    original = json.loads(actual)
    parada = Parada(
        **datos.model_dump(),
        id=parada_id,
        creado_en=original.get("creado_en"),  # se conserva la fecha de alta
    )
    redis_client.set(clave, parada.model_dump_json())

    doc = json.loads(parada.model_dump_json())
    geo_guardar(doc)
    return {"mensaje": "Parada actualizada", "parada": doc}


@router.delete("/{parada_id}", dependencies=[Depends(requiere_admin)])
def eliminar_parada(parada_id: str):
    if not redis_client.delete(clave_parada(parada_id)):
        raise HTTPException(status_code=404, detail="Parada no encontrada")

    geo_quitar(parada_id)
    return {"mensaje": "Parada eliminada", "id": parada_id}
