"""Pillao Bloques: baja los precios de las tiendas a las que ya tenemos acceso y deja datos/productos.json.

Fuentes (sin pedir permiso a nadie):
  - Todo Consolas: feed de Awin (afiliados aprobados).           Secreto: AWIN_TODOCONSOLAS_FEED
  - MediaMarkt: feed de Tradedoubler (afiliados aprobados).       Secreto: TRADEDOUBLER_TOKEN
  - eBay España: API Browse (solo artículos nuevos, precio fijo).  Secretos: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

Uso:  python3 scripts/actualizar.py                 (descarga y procesa)
      python3 scripts/actualizar.py --desde f.jsonl (procesa un volcado ya descargado)
"""
import base64, csv, io, json, os, re, statistics, sys, urllib.parse, urllib.request, zipfile, gzip
from datetime import datetime, timezone

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SALIDA = os.path.join(RAIZ, "datos", "productos.json")
TIENDAS = {
    "todoconsolas": {"nombre": "Todo Consolas", "afiliado": True},
    "mediamarkt": {"nombre": "MediaMarkt", "afiliado": True},
    "ebay": {"nombre": "eBay", "afiliado": False},
}
JUEGO = re.compile(r"\b(ps5|ps4|playstation|switch|xbox|nintendo|wii|3ds|vita|videojuego|monedas|coins)\b", re.I)
NO_SET = re.compile(r"minifig|figura|figur\b|\bled\b|iluminaci|light ?kit|luces|instrucciones|instructions|piezas sueltas|compatible|adecuado|bolsa|polybag|sticker|pegatina|vitrina|display case|dvd|blu-?ray|pel[ií]cula|libro|book", re.I)
NUM = re.compile(r"\b(\d{4,6})\b")


def pedir(url, datos=None, cab=None, tiempo=600):
    req = urllib.request.Request(url, data=datos, headers={"User-Agent": "PillaoBloques/1.0", **(cab or {})})
    with urllib.request.urlopen(req, timeout=tiempo) as r:
        return r.read()


def descomprimir(b):
    if b[:2] == b"PK":
        z = zipfile.ZipFile(io.BytesIO(b)); return z.read(z.namelist()[0])
    if b[:2] == b"\x1f\x8b":
        return gzip.decompress(b)
    return b


def es_lego(nombre, cat=""):
    t = f"{nombre} {cat}"
    return bool(re.search(r"\blego\b", nombre, re.I)) and not JUEGO.search(t) and not re.search(r"juegos? (>|&gt;)|^\s*juegos\b|videojueg", cat, re.I)


def descargar():
    filas = []
    f = (os.environ.get("AWIN_TODOCONSOLAS_FEED") or "").strip()
    if f:
        txt = descomprimir(pedir(f)).decode("utf-8", "replace")
        for r in csv.DictReader(io.StringIO(txt)):
            n, cat = r.get("product_name", ""), (r.get("merchant_category") or "") + " " + (r.get("category_name") or "")
            if es_lego(n, cat):
                filas.append({"tienda": "todoconsolas", "nombre": n, "precio": r.get("search_price"), "url": r.get("aw_deep_link"),
                              "img": r.get("merchant_image_url") or r.get("aw_image_url"), "ean": r.get("ean"), "stock": r.get("in_stock"), "cat": cat})
    t = (os.environ.get("TRADEDOUBLER_TOKEN") or "").strip()
    if t:
        d = json.loads(descomprimir(pedir(f"https://api.tradedoubler.com/1.0/productsUnlimited.json;compress=zip;fid=24915?token={t}")))
        for p in d.get("products", []):
            cat = " / ".join(c.get("name", "") for c in p.get("categories") or [])
            if not es_lego(p.get("name", ""), cat): continue
            of = (p.get("offers") or [{}])[0]; pr = (of.get("priceHistory") or [{}])[0].get("price", {})
            filas.append({"tienda": "mediamarkt", "nombre": p.get("name"), "precio": pr.get("value"), "url": of.get("productUrl"),
                          "img": (p.get("productImage") or {}).get("url"), "ean": (p.get("identifiers") or {}).get("ean"), "stock": of.get("availability"), "cat": cat})
    cid, sec = (os.environ.get("EBAY_CLIENT_ID") or "").strip(), (os.environ.get("EBAY_CLIENT_SECRET") or "").strip()
    if cid and sec:
        tok = json.loads(pedir("https://api.ebay.com/identity/v1/oauth2/token",
                               ("grant_type=client_credentials&scope=" + urllib.parse.quote("https://api.ebay.com/oauth/api_scope")).encode(),
                               {"Authorization": "Basic " + base64.b64encode(f"{cid}:{sec}".encode()).decode(), "Content-Type": "application/x-www-form-urlencoded"}))["access_token"]
        # Los sets que ya tenemos en tiendas, más los más buscados
        nums = sorted({m.group(1) for x in filas for m in [NUM.search(x["nombre"] or "")] if m}) + ["10316", "42143", "75313", "10311", "21348", "10318"]
        for q in dict.fromkeys(nums):
            u = "https://api.ebay.com/buy/browse/v1/item_summary/search?" + urllib.parse.urlencode(
                {"q": f"lego {q}", "limit": "30", "filter": "conditions:{NEW},deliveryCountry:ES,buyingOptions:{FIXED_PRICE}"})
            r = json.loads(pedir(u, cab={"Authorization": "Bearer " + tok, "X-EBAY-C-MARKETPLACE-ID": "EBAY_ES"}))
            for it in r.get("itemSummaries", []):
                filas.append({"tienda": "ebay", "nombre": it.get("title"), "precio": (it.get("price") or {}).get("value"), "url": it.get("itemWebUrl"),
                              "img": (it.get("image") or {}).get("imageUrl"), "ean": None, "stock": "InStock", "cat": "ebay: lego " + q,
                              "envio": ((it.get("shippingOptions") or [{}])[0].get("shippingCost") or {}).get("value")})
    return filas


def limpio(n):
    n = re.sub(r"^(Juego de construcci[oó]n|Juguete|Juego)\s*-?\s*", "", n or "", flags=re.I)
    n = re.sub(r",\s*Edad recomendada.*$", "", n, flags=re.I)
    return re.sub(r"\s+", " ", n).strip()


def procesar(filas):
    fichas = {}
    for x in filas:
        try: precio = round(float(str(x.get("precio")).replace(",", ".")), 2)
        except (TypeError, ValueError): continue
        nombre = limpio(x.get("nombre"))
        if not precio or NO_SET.search(nombre): continue
        if x["tienda"] != "ebay" and not es_lego(nombre, x.get("cat", "")): continue
        m = NUM.search(nombre)
        if x["tienda"] == "ebay":
            q = (x.get("cat") or "").split()[-1]
            if not m or m.group(1) != q: continue  # en eBay solo anuncios que dicen el número del set buscado
        clave = m.group(1) if m else "n:" + re.sub(r"[^a-z0-9]+", " ", nombre.lower()).strip()
        envio = float(x.get("envio") or 0)
        f = fichas.setdefault(clave, {"set": m.group(1) if m else None, "nombre": None, "img": None, "ofertas": []})
        if x["tienda"] != "ebay" and not f["nombre"]: f["nombre"] = re.sub(r"\s*\b\d{4,6}\b\s*$", "", re.sub(r"^LEGO\s*", "", nombre, flags=re.I)).strip()
        if x.get("img") and (not f["img"] or x["tienda"] != "ebay"): f["img"] = x["img"]
        f["ofertas"].append({"tienda": x["tienda"], "precio": precio, "envio": envio, "total": round(precio + envio, 2), "url": x.get("url"),
                             "stock": str(x.get("stock")).lower() not in ("0", "false", "out of stock", "outofstock"), "titulo": nombre if x["tienda"] == "ebay" else None})
    salida = []
    for clave, f in fichas.items():
        tiendas = [o for o in f["ofertas"] if o["tienda"] != "ebay"]
        if not tiendas and not f["nombre"]: continue  # solo eBay y sin tienda: no sabemos el nombre bueno
        eb = sorted([o for o in f["ofertas"] if o["tienda"] == "ebay"], key=lambda o: o["total"])
        if eb and tiendas:
            ref = statistics.median([o["total"] for o in tiendas])
            eb = [o for o in eb if o["total"] >= 0.45 * ref][:3]  # fuera piezas sueltas y anuncios raros
        ofertas = sorted(tiendas + eb, key=lambda o: (not o["stock"], o["total"]))
        if not ofertas: continue
        salida.append({"id": clave, "set": f["set"], "nombre": f["nombre"] or clave, "img": f["img"], "ofertas": ofertas})
    salida.sort(key=lambda p: (-len({o["tienda"] for o in p["ofertas"]}), p["nombre"]))
    return {"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tiendas": TIENDAS, "productos": salida}


if __name__ == "__main__":
    if "--desde" in sys.argv:
        filas = [json.loads(l) for l in open(sys.argv[sys.argv.index("--desde") + 1]) if l.strip()]
    else:
        filas = descargar()
    datos = procesar(filas)
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    json.dump(datos, open(SALIDA, "w"), ensure_ascii=False, indent=1)
    print(f"{len(datos['productos'])} productos ·", {t: sum(1 for p in datos['productos'] for o in p['ofertas'] if o['tienda'] == t) for t in TIENDAS})
