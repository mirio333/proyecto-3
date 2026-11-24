"""Autenticación sencilla para administradores.

- La contraseña vive en .env (ADMIN_PASSWORD), nunca en el código.
- /auth/login devuelve un token firmado (HMAC) que caduca en 8 horas.
- El token se envía en el encabezado  X-Admin-Token.
- Los intentos fallidos se limitan usando Redis (5 por IP cada 5 minutos).
"""
import hashlib
import hmac
import os
import time

from fastapi import Header, HTTPException, Request

from app.database import redis_client

DURACION_TOKEN = 8 * 3600
MAX_FALLOS = 5
VENTANA_FALLOS = 300


def _password() -> str:
    pwd = os.getenv("ADMIN_PASSWORD")
    if not pwd:
        raise HTTPException(
            status_code=503,
            detail="Administración deshabilitada: define ADMIN_PASSWORD en el archivo .env",
        )
    return pwd


def _firma(expira: int) -> str:
    secreto = (os.getenv("ADMIN_SECRET") or _password()).encode()
    return hmac.new(secreto, str(expira).encode(), hashlib.sha256).hexdigest()


def crear_token() -> tuple[str, int]:
    expira = int(time.time()) + DURACION_TOKEN
    return f"{expira}.{_firma(expira)}", expira


def validar_login(request: Request, password: str) -> None:
    pwd = _password()
    ip = request.client.host if request.client else "desconocida"
    clave = f"login:fallos:{ip}"

    fallos = int(redis_client.get(clave) or 0)
    if fallos >= MAX_FALLOS:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
        )

    if not hmac.compare_digest(password.encode(), pwd.encode()):
        pipe = redis_client.pipeline()
        pipe.incr(clave)
        pipe.expire(clave, VENTANA_FALLOS)
        pipe.execute()
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    redis_client.delete(clave)


def requiere_admin(x_admin_token: str = Header(default="")) -> None:
    """Dependencia de FastAPI: protege crear / editar / eliminar."""
    try:
        expira_txt, firma = x_admin_token.split(".", 1)
        expira = int(expira_txt)
    except ValueError:
        raise HTTPException(status_code=401, detail="Sesión de administrador requerida")

    if expira < time.time() or not hmac.compare_digest(firma, _firma(expira)):
        raise HTTPException(status_code=401, detail="Sesión caducada. Inicia sesión de nuevo")
