#!/usr/bin/env python3
"""Busca fotografías de Manitas en Wikimedia Commons con licencia abierta.

Primero muestra los candidatos sin descargar; solo tras revisar los
resultados se incorporarán fotos reales al repositorio de Reparado.
Nunca sustituye fotografías por dibujos ni inventa autor/licencia.
"""
from __future__ import annotations
import argparse
import json
import re
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API = "https://commons.wikimedia.org/w/api.php"
SEARCHES = {
    "furniture-assembly": ("furniture assembly", "wood furniture screwdriver", "assemble furniture"),
    "wall-shelf": ("wall shelves installation", "wall shelf", "shelving brackets"),
    "pictures-mirrors": ("hanging picture frames", "mirror on wall", "picture frames living room"),
    "curtain-rod": ("curtain rod", "curtain rail", "window curtains"),
    "tv-mount": ("television wall mount", "wall mounted television", "tv bracket"),
    "door-hinges": ("door hinge", "door hinges", "door repair"),
    "shutter-belt": ("roller shutter mechanism", "roller shutter", "roller shutter belt"),
    "bath-caulk": ("bathroom caulk", "silicone sealant", "bathtub repair"),
    "ceiling-lamp": ("installing ceiling light", "ceiling light fixture", "ceiling lamp"),
    "bath-accessories": ("bathroom towel holder", "bathroom accessories", "towel rail"),
    "furniture-repair": ("furniture restoration", "furniture repair wood", "woodworker furniture"),
    "door-handle": ("door handle", "door knob", "door handle repair")
}
# Estas licencias permiten mostrar imágenes (con los créditos y condiciones).
ALLOWED = ("cc0", "cc by", "cc-by", "public domain", "pd", "pdm")

def clean(value):
    return re.sub(r"<[^>]+>"," ",str(value or "")).replace("&amp;","&").strip()

def api_call(params):
    params = {"action":"query", "format":"json", "formatversion":"2", **params}
    url = API + "?" + urlencode(params)
    req = Request(url, headers={
        "User-Agent": "ReparadoPhotoAudit/1.0 (public beta; contact via github.com/warks1/REPARADO)",
        "Accept": "application/json",
    })
    for attempt in range(3):
        try:
            with urlopen(req, timeout=22) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt==2:
                raise RuntimeError(f"Wikimedia no responde: {error}") from error
            time.sleep(2*(attempt+1))

def candidates(query):
    response=api_call({
        "generator":"search", "gsrsearch":query,
        "gsrnamespace":"6", "gsrlimit":"15",
        "prop":"imageinfo", "iiprop":"url|extmetadata|mime|size",
        "iiurlwidth":"480"
    })
    found=[]
    for page in response.get("query",{}).get("pages",[]):
        info=(page.get("imageinfo") or [{}])[0]
        meta=info.get("extmetadata") or {}
        license=clean((meta.get("LicenseShortName") or {}).get("value")).lower()
        mime=info.get("mime","")
        if not mime.startswith("image/") or "svg" in mime or not any(x in license for x in ALLOWED):
            continue
        title=page.get("title","")
        if re.search(r"\.(svg|gif|tif|tiff|pdf|png)$",title,re.I):continue
        url=info.get("thumburl") or info.get("url")
        if not url:continue
        found.append({
            "title":title,"url":url,
            "source":info.get("descriptionurl") or "",
            "license":license,
            "author":clean((meta.get("Artist") or {}).get("value")),
            "credit":clean((meta.get("Credit") or {}).get("value")),
            "width":info.get("width"),"height":info.get("height"),
            "description":clean((meta.get("ImageDescription") or {}).get("value"))[:180],
        })
    return found

def score(photo,words):
    target=(photo["title"]+" "+photo["description"]).lower()
    return sum(4 if w in photo["title"].lower() else 1 for w in words if w in target) - (
        6 if any(s in target for s in ["logo","icon","diagram","advertisement","poster","map","museum exhibit"]) else 0
    )

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--limit",type=int,default=12)
    args=ap.parse_args()
    output={}
    for slug,queries in list(SEARCHES.items())[:args.limit]:
        options=[]
        for query in queries:
            try:
                found=candidates(query)
            except RuntimeError as e:
                print(f"{slug}: {e}", flush=True)
                continue
            print(f"{slug} / {query}: {len(found)} archivos libres",flush=True)
            options.extend(found)
            if len(options)>=4:break
        unique={o["title"]:o for o in options}
        terms=re.findall("[a-z]+"," ".join(queries).lower())
        ranked=sorted(unique.values(),key=lambda p:score(p,terms),reverse=True)[:5]
        output[slug]=ranked
        print(json.dumps({"service":slug,"candidates":[
           {"title":p["title"],"license":p["license"],"author":p["author"][:80],"source":p["source"]}
           for p in ranked
        ]},ensure_ascii=False),flush=True)
    with open("docs/manitas-photo-candidates.json","w",encoding="utf8") as file:
        json.dump(output,file,indent=2,ensure_ascii=False)
    print(f"TOTAL: {len(output)} servicios examinados",flush=True)

if __name__=="__main__":main()
