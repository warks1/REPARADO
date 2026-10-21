#!/usr/bin/env python3
"""Publica 12 fotografías documentadas de Wikimedia Commons para Manitas.

Cada fotografía es una imagen ILUSTRATIVA del trabajo, nunca una foto de
un técnico de REPARADO o del resultado de un servicio realizado por la app.
Conserva una tabla de autor/licencia/fuente para cumplir la atribución.
"""
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
import io
import json
import re
import time

ROOT=Path(__file__).resolve().parents[1]
FILES={
 "furniture-assembly":"Ikea Sektion Cabinet Frame Assembly 2.jpg",
 "wall-shelf":"Black metal wall shelf with potted artificial flowers.jpg",
 "pictures-mirrors":"EFTA00000541 - Bathroom with light wood flooring beige walls and three framed pictures on the wall above the toilet and sink A white vanity with a round sink is visible.jpg",
 "curtain-rod":"Curtain hanging from ready-made curtain rod (--wiki68).jpg",
 "tv-mount":"Wall-mounted 36 inch flat panel Panasonic TV.JPG",
 "door-hinges":"Door hinge with spring less self closing mechanism.jpg",
 "shutter-belt":"Roller Shutter - Kolkata 2011-02-25 1740.JPG",
 "bath-caulk":"Caulking underneath bathroom sink.jpg",
 "ceiling-lamp":"Electric ceiling lamp.JPG",
 "bath-accessories":"EFTA00000188 - Bathroom hallway viewed from the doorway featuring a towel rack with two white towels a framed picture on the wall and light-colored walls and carpeting.jpg",
 "furniture-repair":"Furniture Restoration - Cabinet Making (6998060619).jpg",
 "door-handle":"Modern door handle.jpg"
}
LABELS={
 "furniture-assembly":"Montaje de mueble en kit (mediano)",
 "wall-shelf":"Colocación de estantería",
 "pictures-mirrors":"Colgar cuadros o espejos (hasta 3)",
 "curtain-rod":"Instalación de barras de cortina o estores",
 "tv-mount":"Instalación de soporte de TV en pared",
 "door-hinges":"Ajuste de puertas y bisagras",
 "shutter-belt":"Cambio de cinta de persiana",
 "bath-caulk":"Renovación de silicona de bañera o ducha",
 "ceiling-lamp":"Instalación de lámpara sencilla",
 "bath-accessories":"Colocación de accesorios de baño",
 "furniture-repair":"Reparación menor de muebles",
 "door-handle":"Cambio de manilla de puerta"
}
UA="ReparadoProject/1.0 (public image attribution at github.com/warks1/REPARADO)"
def get(url,accept=None):
    for attempt in range(4):
        try:
            req=Request(url,headers={"User-Agent":UA,"Accept":accept or "*/*"})
            with urlopen(req,timeout=28) as response:
                data=response.read(3500000)
                if len(data)>=3500000:raise ValueError("Imagen demasiado grande")
                return data
        except (HTTPError,URLError,TimeoutError,ValueError) as e:
            if attempt==3:raise RuntimeError(f"Error descargando: {url[:140]}: {e}") from e
            time.sleep(2*(attempt+1))
def info_for(title):
    url="https://commons.wikimedia.org/w/api.php?"+urlencode({
       "action":"query","format":"json","formatversion":"2",
       "titles":"File:"+title,"prop":"imageinfo",
       "iiprop":"url|extmetadata|size|mime","iiurlwidth":"480"})
    data=json.loads(get(url,"application/json"))
    pages=data.get("query",{}).get("pages",[])
    if not pages or not pages[0].get("imageinfo"):
        raise RuntimeError(f"Commons no encontró imagen: {title}")
    i=pages[0]["imageinfo"][0]
    meta=i.get("extmetadata",{})
    def field(key):
        return re.sub(r"<[^>]*>","",meta.get(key,{}).get("value","")).strip()
    return dict(title=title,url=i.get("thumburl") or i["url"],
        source=i.get("descriptionurl"),author=field("Artist")[:160],
        license=field("LicenseShortName"),license_url=field("LicenseUrl"),
        mime=i.get("mime"))

def main():
    targeted=json.loads((ROOT/"docs/manitas-wikimedia-targeted.json").read_text(encoding="utf8"))
    basic=json.loads((ROOT/"docs/manitas-photo-candidates.json").read_text(encoding="utf8"))
    dst=ROOT/"public/services"
    dst.mkdir(parents=True,exist_ok=True)
    credits=[]
    for slug,title in FILES.items():
        known=next((p for p in targeted.get(slug,[])+basic.get(slug,[])
               if p["title"]=="File:"+title),None)
        # Las licencias y URLs de las primeras once fotos ya están
        # verificadas y guardadas; no repetir la consulta (límites 429).
        if known:
            data=dict(known)
        elif slug=="door-handle":
            # Ficha revisada manualmente en Commons, CC BY-SA 4.0,
            # autor Vicrubini. Imagen original de 960x1280, 51 KB.
            from hashlib import md5
            from urllib.parse import quote
            filename=title.replace(" ","_")
            digest=md5(filename.encode("utf8")).hexdigest()
            data={
              "title":title,
              "url":"https://thumb.wikimedia.org/wikipedia/commons/thumb/"+digest[0]+"/"+digest[:2]+"/"+quote(filename)+"/500px-"+quote(filename),
              "source":"https://commons.wikimedia.org/wiki/File:Modern_door_handle.jpg",
              "author":"Vicrubini","license":"CC BY-SA 4.0"
            }
        else:
            raise RuntimeError(f"Falta fuente verificada: {title}")
        lic=data.get("license","").lower().split()
        if lic[:2]==["cc","by-sa"]:
            data["license_url"]="https://creativecommons.org/licenses/by-sa/"+lic[2]+"/"
        elif lic[:2]==["cc","by"]:
            suffix="/"+lic[3] if len(lic)>3 else ""
            data["license_url"]="https://creativecommons.org/licenses/by/"+lic[2]+suffix+"/"
        elif "cc0" in lic:
            data["license_url"]="https://creativecommons.org/publicdomain/zero/1.0/"
        else:
            data["license_url"]="https://creativecommons.org/publicdomain/mark/1.0/"
        license=(data.get("license") or "").lower()
        if not any(x in license for x in ("cc by","cc-by","cc0","public domain","pdm")):
            raise RuntimeError(f"Licencia no verificada para {title}: {license}")
        url=data["url"]
        if not url.startswith(("https://upload.wikimedia.org/","https://thumb.wikimedia.org/")):
            raise RuntimeError(f"URL no autorizada: {url}")
        raw=get(url,"image/*")
        try:
            with Image.open(io.BytesIO(raw)) as original:
                photo=ImageOps.exif_transpose(original).convert("RGB")
                if min(photo.size)<160:
                    raise RuntimeError(f"Resolución insuficiente para {slug}: {photo.size}")
                photo=ImageOps.fit(photo,(360,240),Image.Resampling.LANCZOS,centering=(.5,.45))
                dest=dst/("handyman-"+slug+".webp")
                photo.save(dest,format="WEBP",quality=78,method=6)
        except (OSError,UnidentifiedImageError) as error:
            raise RuntimeError(f"No es foto legible: {slug}") from error
        credit={"slug":slug,"servicio":LABELS[slug],"archivo":f"services/handyman-{slug}.webp",
           "titulo_original":title,"autor":data.get("author") or "Ver ficha original",
           "licencia":data["license"],"licencia_url":data.get("license_url") or "",
           "origen":data["source"],
           "modificaciones":"Recorte 3:2, reducción a 360x240 y conversión WebP",
           "nota":"Fotografía ilustrativa de la categoría; no es un trabajo realizado por REPARADO"}
        credits.append(credit)
        print(f"{slug}: {title} ({license}) {dest.stat().st_size} bytes",flush=True)
    (ROOT/"docs/manitas-foto-creditos.json").write_text(json.dumps(credits,ensure_ascii=False,indent=2),encoding="utf8")
    html="""<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Créditos fotográficos de Manitas - Reparado</title><style>body{font:16px system-ui,sans-serif;line-height:1.55;color:#1a2b47;background:#fbfdff;max-width:850px;margin:20px auto;padding:14px}a{color:#0072bf}li{margin:16px 0}h1{font-size:1.7rem}</style><h1>Créditos de fotografías · Manitas</h1><p>Son fotografías ilustrativas, no trabajos realizados por Reparado. Las imágenes se han recortado y convertido a WebP. Autoría y condiciones de reutilización pertenecen a sus titulares. Las imágenes con licencia CC BY-SA conservan esa licencia; no se extiende a los demás contenidos de la app.</p><ol>"""
    from html import escape
    for c in credits:
        link=escape(c["origen"],quote=True)
        license_link=escape(c["licencia_url"],quote=True)
        html+=f'<li><strong>{escape(c["servicio"])}</strong>: <a href="{link}" rel="noopener noreferrer">{escape(c["titulo_original"])}</a> — {escape(c["autor"])}; <a href="{license_link}" rel="noopener noreferrer">{escape(c["licencia"])}</a>. {escape(c["modificaciones"])}.</li>'
    html+='</ol><p><a href="./">Volver a Reparado</a></p></html>'
    (ROOT/"public/creditos-fotos-manitas.html").write_text(html,encoding="utf8")
    print("Fotografías: "+str(len(credits))+"; licencias documentadas",flush=True)
if __name__=="__main__":main()
