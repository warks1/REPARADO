#!/usr/bin/env python3
"""REPARADO V113: completa Info.plist del proyecto iOS generado por Capacitor.

Se ejecuta tras 'npx cap add ios'. Sin NSCameraUsageDescription, iOS cierra la
app al abrir la cámara (botón «Hacer una foto» del parte) y App Review la
rechaza. Conserva cualquier valor ya existente; no toca secretos.
"""
import plistlib
import sys
from pathlib import Path

DEFAULTS = {
    "NSCameraUsageDescription": "Reparado usa la cámara para que puedas hacer fotos de la avería o del trabajo realizado y adjuntarlas a tu servicio.",
    "NSPhotoLibraryUsageDescription": "Reparado accede a tus fotos solo para que elijas las imágenes que quieres adjuntar a una solicitud.",
    # La app solo usa el cifrado HTTPS del sistema.
    "ITSAppUsesNonExemptEncryption": False,
}


def merge_info(existing):
    if not isinstance(existing, dict):
        raise ValueError("Info.plist inválido.")
    result = dict(existing)
    for key, value in DEFAULTS.items():
        if key not in result or result[key] in ("", None):
            result[key] = value
    return result


def main(path):
    target = Path(path)
    data = plistlib.loads(target.read_bytes())
    target.write_bytes(plistlib.dumps(merge_info(data), fmt=plistlib.FMT_XML))
    check = plistlib.loads(target.read_bytes())
    missing = [k for k in DEFAULTS if k not in check]
    if missing:
        raise SystemExit("Faltan claves en Info.plist: " + ", ".join(missing))
    print("Info.plist preparado:", ", ".join(DEFAULTS))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/Info.plist")
