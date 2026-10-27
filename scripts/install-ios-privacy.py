#!/usr/bin/env python3
"""REPARADO V47: instala la declaración de FileTimestamp, conservando ajustes
de privacidad preexistentes. No modifica el Xcode project: ver link-ios-privacy.rb.
"""
import argparse
import plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "native/ios/PrivacyInfo.xcprivacy"
CATEGORY = "NSPrivacyAccessedAPICategoryFileTimestamp"
REASON = "C617.1"


def require_reason(manifest):
    for entry in manifest.get("NSPrivacyAccessedAPITypes", []):
        if entry.get("NSPrivacyAccessedAPIType") == CATEGORY:
            if REASON in entry.get("NSPrivacyAccessedAPITypeReasons", []):
                return True
    return False


def merge_manifest(existing, required):
    """Add only our required reason, preserve other Apple keys & SDK reasons."""
    if not isinstance(existing, dict) or not isinstance(required, dict):
        raise ValueError("Manifiesto de privacidad inválido.")
    result = dict(existing)
    entries = list(result.get("NSPrivacyAccessedAPITypes", []))
    if not all(isinstance(entry, dict) for entry in entries):
        raise ValueError("Entradas NSPrivacyAccessedAPITypes inválidas.")
    if not require_reason({"NSPrivacyAccessedAPITypes": entries}):
        match = next((e for e in entries if e.get("NSPrivacyAccessedAPIType") == CATEGORY), None)
        if match is None:
            match = {"NSPrivacyAccessedAPIType": CATEGORY, "NSPrivacyAccessedAPITypeReasons": []}
            entries.append(match)
        else:
            match = dict(match)
            entries[entries.index(next(e for e in entries if e.get("NSPrivacyAccessedAPIType") == CATEGORY))] = match
        reasons = list(match.get("NSPrivacyAccessedAPITypeReasons", []))
        if REASON not in reasons:
            reasons.append(REASON)
        match["NSPrivacyAccessedAPITypeReasons"] = reasons
    result["NSPrivacyAccessedAPITypes"] = entries
    if not require_reason(result):
        raise ValueError("No se pudo incorporar el motivo de acceso exigido.")
    # Nunca inventar NSPrivacyCollectedDataTypes=[]: los datos de REPARADO
    # deben declararse tras una evaluación legal completa antes de producción.
    return result


def install(ios_root):
    ios_root = Path(ios_root)
    project = ios_root / "App.xcodeproj/project.pbxproj"
    if not project.is_file():
        raise FileNotFoundError("Primero genera iOS con 'npx cap add ios' y 'npx cap sync ios'.")
    target = ios_root / "App/PrivacyInfo.xcprivacy"
    required = plistlib.loads(TEMPLATE.read_bytes())
    current = plistlib.loads(target.read_bytes()) if target.exists() else {}
    merged = merge_manifest(current, required)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as file:
        plistlib.dump(merged, file, fmt=plistlib.FMT_XML, sort_keys=False)
    print("Manifiesto iOS preparado. Falta asociarlo al target y verificar el bundle.")
    return target


def verify_bundle(app):
    target = Path(app) / "PrivacyInfo.xcprivacy"
    if not target.is_file():
        raise ValueError("Falta PrivacyInfo.xcprivacy en la raíz del bundle App.app.")
    obj = plistlib.loads(target.read_bytes())
    if not require_reason(obj):
        raise ValueError("Falta el motivo C617.1 FileTimestamp en el bundle de iOS.")
    print("Bundle iOS verificado: PrivacyInfo.xcprivacy contiene FileTimestamp/C617.1.")


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--ios-root",default=str(ROOT / "ios/App"))
    cli.add_argument("--verify-bundle",help="Ruta a un App.app compilado (no escribe).")
    args = cli.parse_args()
    if args.verify_bundle:
        verify_bundle(args.verify_bundle)
    else:
        install(args.ios_root)
