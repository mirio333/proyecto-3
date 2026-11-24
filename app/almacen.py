"""Funciones compartidas de acceso a Redis (claves, lectura masiva, índice GEO)."""
import json
from typing import List

import redis

from app.database import redis_client

GEO_KEY = "paradas:geo"   # índice geoespacial (sorted set) con todas las paradas


def clave_parada(parada_id: str) -> str:
    return f"parada:{parada_id}"


def clave_ruta(ruta_id: str) -> str:
    return f"ruta:{ruta_id}"


def cargar_docs(patron: str) -> List[dict]:
    """Lee todos los documentos JSON cuyas claves coinciden con el patrón."""
    claves = list(redis_client.scan_iter(match=patron))
    if not claves:
        return []
    return [json.loads(valor) for valor in redis_client.mget(claves) if valor]


def geo_guardar(parada: dict) -> None:
    redis_client.geoadd(GEO_KEY, (parada["longitud"], parada["latitud"], parada["id"]))


def geo_quitar(parada_id: str) -> None:
    redis_client.zrem(GEO_KEY, parada_id)


def reindexar_geo() -> int:
    """Reconstruye el índice GEO a partir de las paradas guardadas.

    Se ejecuta al arrancar, así las paradas creadas antes de esta versión
    (o editadas a mano en Redis) también aparecen en "cerca de mí".
    """
    paradas = cargar_docs("parada:*")
    redis_client.delete(GEO_KEY)
    indexadas = 0
    for parada in paradas:
        try:
            geo_guardar(parada)
            indexadas += 1
        except (redis.ResponseError, KeyError, TypeError):
            continue  # coordenadas inválidas: se omite
    return indexadas
