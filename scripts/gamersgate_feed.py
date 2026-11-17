# Convierte el feed de productos de GamersGate para España (XML) en feeds/gamersgate.json.
# El feed ya viene filtrado por país (country=ESP), en euros y con el enlace de afiliado puesto.
# Fuera: bandas sonoras y guías (no son juegos) y lo que no está a la venta.
import json, re, sys, html
import xml.etree.ElementTree as ET

origen, destino = sys.argv[1], sys.argv[2]
filas = []
for it in ET.parse(origen).getroot().iter("item"):
    x = {c.tag: (c.text or "").strip() for c in it}
    tipo = x.get("type", "").lower()
    if tipo in ("soundtrack", "guide") or x.get("state") not in ("available", "preorder"):
        continue
    try:
        pr = float(x.get("price") or 0); srp = float(x.get("srp") or 0)
    except ValueError:
        continue
    if pr <= 0 or not x.get("link"):
        continue
    nombre = html.unescape(html.unescape(x.get("title", "")))  # viene doblemente escapado (&amp;#8482;)
    nombre = re.sub(r"\s*\((steam|gog|epic)\)\s*$", "", nombre, flags=re.I).strip()
    filas.append({"n": nombre, "t": tipo, "p": pr, "r": srp, "u": x["link"], "d": x.get("drm", ""),
                  "res": 1 if x.get("state") == "preorder" else 0, "img": x.get("boximg", "")})
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"GamersGate: {len(filas)} productos guardados")
