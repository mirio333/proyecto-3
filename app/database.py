"""Conexión a Redis Cloud usando redis-py."""
import os

import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    raise RuntimeError(
        "Falta la variable REDIS_URL. Crea un archivo .env con:\n"
        "REDIS_URL=rediss://default:TU_PASSWORD@TU_HOST:PUERTO"
    )

redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def probar_conexion() -> bool:
    """Devuelve True si Redis responde al PING, False si no."""
    try:
        return bool(redis_client.ping())
    except redis.RedisError:
        return False
