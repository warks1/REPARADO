#!/usr/bin/env python3
"""Explora Openverse (Creative Commons) como segunda fuente de fotos reales.

No publica ninguna imagen automáticamente: necesita selección visual.
"""
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json, time, re

QUERIES = {
    "furniture-assembly": ("furniture assembly handyman", "assembling cabinet screwdriver"),
    "wall-shelf": ("installing wall shelves drill", "wall shelf brackets"),
    "pictures-mirrors": ("hanging picture frame wall", "wall mirror"),
    "curtain-rod": ("curtain rod installation", "curtain rod window"),
    "tv-mount": ("television wall mount", "mount television wall"),
    "door-hinges": ("door hinge wooden door", "door hinge"),
    "shutter-belt": ("roller shutter repair", "rolling shutters window"),
    "bath-caulk": ("bathroom silicone caulking", "caulk bath"),
    "ceiling-lamp": ("ceiling lamp installation", "ceiling light"),
    "bath-accessories": ("bathroom towel rail installation", "bathroom towel holder"),
    "furniture-repair": ("restoring wooden furniture", "furniture repair"),
    "door-handle": ("door handle wooden door", "door handle")
}

def search(q):
    query=urlencode({"q":q,"page_size":35,"license_type":"commercial,modification","mature":"false"})
    req=Request("https://api.openverse.org/v1/images/?"+query,headers={
       "User-Agent":"ReparadoProject/1.0 (github.com/warks1/REPARADO)",
       "Accept":"application/json"})
    for try_no in range(3):
        try:
            with urlopen(req,timeout=18) as r: return json.load(r).get("results",[])
        except (HTTPError,URLError,TimeoutError) as error:
            if try_no==2: raise RuntimeError(str(error))
            time.sleep(2*(try_no+1))
    return []

def quality(d,q):
    title=str(d.get("title") or "").lower()
    if not title or title=="untitled":return -100
    qwords=set(re.findall(r"[a-z]{4,}",q.lower()))
    matched=sum(2 for w in qwords if w in title)
    penalties=sum(12 for bad in ("drawing","graphic","diagram","meme","illustration","render","poster","abstract","painting","logo","icon","museum","aircraft") if bad in title)
    return matched-penalties

def main():
    result={}
    for slug,terms in QUERIES.items():
        options=[]
        for q in terms:
            try: records=search(q)
            except RuntimeError as e:
                print(f"{slug} error {e}",flush=True)
                continue
            print(f"{slug} query={q} results={len(records)}",flush=True)
            for photo in records:
                if photo.get("category")!="photograph":continue
                if photo.get("license") not in ("cc0","by","by-sa","pdm"):continue
                if not photo.get("thumbnail") or not photo.get("foreign_landing_url"):continue
                options.append({"title":photo.get("title"),"thumbnail":photo["thumbnail"],
                  "source":photo["foreign_landing_url"],"license":photo.get("license"),
                  "license_version":photo.get("license_version"),"creator":photo.get("creator") or "",
                  "provider":photo.get("provider"),"download":photo.get("url"),
                  "score":quality(photo,q)})
            if len(options)>=8:break
        uniques={i["source"]:i for i in options}
        sorted_opts=sorted(uniques.values(),key=lambda o:o["score"],reverse=True)
        result[slug]=sorted_opts[:8]
        print(json.dumps({"service":slug,"candidates":[
           {"title":x["title"],"source":x["source"],"license":x["license"],"score":x["score"]}
           for x in sorted_opts[:8]]},ensure_ascii=False),flush=True)
    with open("docs/manitas-openverse-candidates.json","w",encoding="utf8") as f:
        json.dump(result,f,ensure_ascii=False,indent=2)
    print("TOTAL "+str(sum(len(v) for v in result.values())),flush=True)

if __name__=="__main__":main()
