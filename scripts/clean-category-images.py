#!/usr/bin/env python3
"""Quita únicamente fondo blanco conectado al borde de los recortes originales.
Conserva los colores y la forma de los iconos elegidos para REPARADO.
Genera archivos RGBA transparentes: no hay rectángulos blancos que
puedan quedar expuestos cuando las ilustraciones se animan.
"""
from collections import deque
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "public" / "categories"
for name in ("plumbing", "masonry", "parquet", "renovation"):
    source = root / f"{name}.webp"
    target = root / f"{name}-transparent.png"
    picture = Image.open(source).convert("RGBA")
    w, h = picture.size
    pixels = picture.load()

    def white_bg(x, y):
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= 216 and max(r, g, b) - min(r, g, b) <= 38

    visited = bytearray(w*h)
    queue = deque()
    def seed(x, y):
        i = y*w+x
        if not visited[i] and white_bg(x, y):
            visited[i] = 1
            queue.append((x,y))
    for x in range(w):
        seed(x,0);seed(x,h-1)
    for y in range(h):
        seed(0,y);seed(w-1,y)

    while queue:
        x, y = queue.popleft()
        for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if xx>=0 and yy>=0 and xx<w and yy<h:
                seed(xx,yy)

    # Uniones de fondo blanco aisladas por líneas de compresión: cualquier
    # banda horizontal predominantemente blanca también es fondo, no dibujo.
    for y in range(h):
        row_whites=sum(white_bg(x,y) for x in range(w))
        if row_whites/w > 0.94:
            for x in range(w):
                if white_bg(x,y):visited[y*w+x]=1

    removed=sum(visited)
    out=Image.new("RGBA", (w,h))
    write=out.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a=pixels[x,y]
            if visited[y*w+x]:
                write[x,y]=(r,g,b,0)
            else:
                # Suavizar borde antialias blanco SOLO cuando toca el
                # fondo eliminado, sin borrar los reflejos blancos del objeto.
                touches=(
                   (x>0 and visited[y*w+x-1]) or
                   (x<w-1 and visited[y*w+x+1]) or
                   (y>0 and visited[(y-1)*w+x]) or
                   (y<h-1 and visited[(y+1)*w+x])
                )
                if touches and min(r,g,b)>188 and max(r,g,b)-min(r,g,b)<43:
                    opacity=max(0,min(255,int((227-min(r,g,b))*255/38)))
                    a=min(a,opacity)
                write[x,y]=(r,g,b,a)
    out.save(target, optimize=True)
    print(f"{name}: source={w}x{h} white_removed={removed}/{w*h} ({removed*100/(w*h):.1f}%), output={target.stat().st_size} bytes")
    if removed == 0:
        raise RuntimeError(f"{name}: no border white detected; inspect original image")
