#!/usr/bin/env python3
"""Lista de fotos Wikimedia para revisión: no selecciona imágenes a ciegas."""
from importlib.machinery import SourceFileLoader
import json
import pathlib
source=SourceFileLoader("photoaudit","scripts/audit-manitas-photos.py").load_module()
queries={
 "furniture-assembly":["cabinet assembly","furniture maker","carpenter furniture workshop"],
 "wall-shelf":["wall-mounted shelf","wall shelves","wooden shelves"],
 "pictures-mirrors":["framed pictures wall","wall mirror","wall mounted mirror"],
 "curtain-rod":["curtain rod","curtain rail","window curtains"],
 "tv-mount":["TV wall mount","wall mounted TV","television wall mount"],
 "door-hinges":["door hinge","wooden door hinge","door hinge installation"],
 "shutter-belt":["window shutters","roller shutter","window roller blind"],
 "bath-caulk":["bathroom silicone caulking","caulking bathroom sink","silicone sealant bath"],
 "ceiling-lamp":["ceiling lamp","ceiling light","hanging lamp"],
 "bath-accessories":["bathroom towel rack","towel rail bathroom","towel rack"],
 "furniture-repair":["furniture restoration","wood furniture repair","carpenter restoring chair"],
 "door-handle":["door handle wooden door","modern door handle","door knob"]
}
results={}
for key,terms in queries.items():
    found=[]
    for q in terms:
        try:arr=source.candidates(q)
        except RuntimeError as error:
            print(key,repr(error),flush=True)
            continue
        found += arr[:12]
        if len(found)>=12:break
    uniq={x["source"]:x for x in found}
    results[key]=list(uniq.values())[:15]
    print(json.dumps({"service":key,"candidates":[{
        "name":x["title"],"license":x["license"],"description":x["description"][:90]
    } for x in results[key]]},ensure_ascii=False),flush=True)
pathlib.Path("docs").mkdir(exist_ok=True)
with open("docs/manitas-wikimedia-targeted.json","w",encoding="utf8") as f:
    json.dump(results,f,ensure_ascii=False,indent=2)
print("Terminada selección manual preliminar",flush=True)
