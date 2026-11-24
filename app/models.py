"""Modelos Pydantic de Rutas Puebla."""
import re
import uuid
from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel, Field, field_validator


def _nuevo_id() -> str:
    return f"pue-{uuid.uuid4().hex[:8]}"


def _nuevo_id_ruta() -> str:
    return f"ruta-{uuid.uuid4().hex[:8]}"


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Paradas ----------
class ParadaEntrada(BaseModel):
    """Datos que envía el cliente (crear / actualizar)."""

    nombre: str = Field(min_length=1, max_length=120)
    colonia: str = Field(min_length=1, max_length=120)
    municipio: str = "Puebla"
    # Redis GEO solo acepta latitudes entre -85.05 y 85.05
    latitud: float = Field(ge=-85, le=85)
    longitud: float = Field(ge=-180, le=180)
    rutas: List[str] = Field(default_factory=list)
    activa: bool = True


class Parada(ParadaEntrada):
    """Parada completa como se guarda en Redis."""

    id: str = Field(default_factory=_nuevo_id)
    creado_en: datetime = Field(default_factory=_ahora)


# ---------- Rutas ----------
class RutaEntrada(BaseModel):
    """Una ruta es una lista ORDENADA de ids de paradas."""

    nombre: str = Field(min_length=1, max_length=80)
    color: str = "#b4532e"
    paradas: List[str] = Field(default_factory=list)
    activa: bool = True

    @field_validator("color")
    @classmethod
    def _validar_color(cls, valor: str) -> str:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", valor):
            raise ValueError("El color debe tener formato #RRGGBB")
        return valor.lower()


class Ruta(RutaEntrada):
    id: str = Field(default_factory=_nuevo_id_ruta)
    creado_en: datetime = Field(default_factory=_ahora)


# ---------- Administración ----------
class LoginEntrada(BaseModel):
    password: str = Field(min_length=1, max_length=200)
