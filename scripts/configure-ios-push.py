#!/usr/bin/env python3
"""REPARADO V113: crea App.entitlements con Push Notifications (aps-environment).

Ejecutar tras 'npx cap add ios'. Después, scripts/link-ios-push.rb lo enlaza
al target App. El App ID com.ams.reparado y el perfil de distribución deben
tener la capacidad Push Notifications activada en Apple Developer.
"""
import plistlib
import sys
from pathlib import Path

def entitlements(environment="production"):
    if environment not in ("production", "development"):
        raise ValueError("aps-environment inválido")
    return {"aps-environment": environment}

def main(path="ios/App/App/App.entitlements", environment="production"):
    target = Path(path)
    existing = plistlib.loads(target.read_bytes()) if target.exists() else {}
    existing.update(entitlements(environment))
    target.write_bytes(plistlib.dumps(existing, fmt=plistlib.FMT_XML))
    assert plistlib.loads(target.read_bytes())["aps-environment"] == environment
    print("Entitlements preparados:", environment)

if __name__ == "__main__":
    main(*(sys.argv[1:3]))
