# Catálogo de GameBillet (feed JSON propio, solo se puede descargar desde la IP fija del servidor) → feeds/gamebillet[-usd].json
# Uso: python3 gamebillet_feed.py origen.json destino.json
# Trae nombre, enlace, precio normal («price») y rebajado («special_price») y filtros «DRM > Steam», «Platform > Windows»…
# El enlace se guarda con nuestro código de afiliado.
import html, json, re, sys

AFILIADO = "18e597b9-17a3-449b-a8c4-26c16cc039ec"
origen, destino = sys.argv[1], sys.argv[2]
d = json.load(open(origen, encoding="utf-8"))
productos = d.get("product") or []

def precio(t):
    t = re.sub(r"[^\d.,]", "", str(t or ""))
    if not t: return 0.0
    if "," in t and "." in t: t = t.replace(".", "").replace(",", ".") if t.rfind(",") > t.rfind(".") else t.replace(",", "")
    elif "," in t: t = t.replace(",", ".")
    try: return float(t)
    except ValueError: return 0.0

filas = []
for x in productos:
    nombre = html.unescape(html.unescape(x.get("name") or "")).strip()
    url = (x.get("url") or "").strip()
    if not nombre or not url.startswith("https://www.gamebillet.com/"): continue
    regular, actual = precio(x.get("price")), precio(x.get("special_price"))
    p = actual or regular
    if p <= 0: continue
    filtros = [html.unescape(str(v)) for k, v in x.items() if k.startswith("filters")]
    drm = next((f.split(">", 1)[1].strip() for f in filtros if f.startswith("DRM")), "")
    if re.search(r"\b(account|cuenta)\b", nombre, re.I): continue
    tipo = "dlc" if re.search(r"\(DLC\)|\bDLC\b|season pass|soundtrack|expansion pack", nombre, re.I) else ""
    nombre = re.sub(r"\s*\(DLC\)\s*$", "", nombre)
    u = url + ("&" if "?" in url else "?") + "affiliate=" + AFILIADO
    filas.append({"n": nombre, "t": tipo, "pl": "PC", "p": round(p, 2), "r": round(regular, 2) if regular > p else 0, "u": u, "d": drm or "Steam"})

json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"GameBillet: {len(filas)} productos válidos de {len(productos)} guardados en {destino}")
