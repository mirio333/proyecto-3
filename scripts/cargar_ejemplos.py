"""Carga paradas de ejemplo en Redis Cloud.

Uso (desde la carpeta rutas-puebla, con el venv activo):
    python -m scripts.cargar_ejemplos
"""
from app.database import redis_client
from app.models import Parada

EJEMPLOS = [
    dict(id="pue-001", nombre="Parada Zócalo", colonia="Centro",
         latitud=19.0431, longitud=-98.1977, rutas=["Ruta 1", "Ruta 15", "Ruta 72"]),
    dict(id="pue-002", nombre="Parada BUAP", colonia="Los Volcanes",
         latitud=19.0467, longitud=-98.2065, rutas=["Ruta 4", "Ruta 61"]),
    dict(id="pue-003", nombre="Parada CAPU", colonia="Centro de Autobuses",
         latitud=19.0723, longitud=-98.1696, rutas=["Ruta 12", "Ruta 40"]),
    dict(id="pue-004", nombre="Parada Paseo Bravo", colonia="Centro",
         latitud=19.0366, longitud=-98.2000, rutas=["Ruta 15", "Ruta 20"]),
]

for datos in EJEMPLOS:
    parada = Parada(**datos)
    redis_client.set(f"parada:{parada.id}", parada.model_dump_json())
    print("Guardada:", parada.id, parada.nombre)
