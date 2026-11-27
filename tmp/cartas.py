"""Pillao Cartas: baja los precios de las tiendas a las que ya tenemos acceso y deja datos/productos.json.

Fuentes (sin pedir permiso a nadie):
  - Todo Consolas: feed de Awin (afiliados aprobados).           Secreto: AWIN_TODOCONSOLAS_FEED
  - eBay España: API Browse (solo artículos nuevos, precio fijo).  Secretos: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

Solo producto sellado de juegos de cartas (sobres, blísters, ETB, latas, colecciones, barajas, cajas). Sin accesorios, manga ni películas.

Uso:  python3 scripts/actualizar.py                 (descarga y procesa)
      python3 scripts/actualizar.py --desde f.jsonl (procesa un volcado ya descargado)
"""
import base64, csv, io, json, os, re, statistics, sys, urllib.parse, urllib.request, zipfile, gzip
from datetime import datetime, timezone

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SALIDA = os.path.join(RAIZ, "datos", "productos.json")
TIENDAS = {"todoconsolas": {"nombre": "Todo Consolas", "afiliado": True}, "ebay": {"nombre": "eBay", "afiliado": False}}
JUEGOS = [("Pokémon", r"pok[eé]mon"), ("One Piece", r"one piece"), ("Lorcana", r"lorcana"), ("Magic", r"magic:? the gathering|\bmtg\b"),
          ("Yu-Gi-Oh!", r"yu-?gi-?oh"), ("Dragon Ball", r"dragon ball"), ("Digimon", r"digimon")]
TIPOS = [("Caja de sobres", r"\b(caja|booster box|display)\b"), ("Elite Trainer Box", r"\b(etb|elite trainer)\b"), ("Blíster", r"\bbl[ií]ster\b"),
         ("Lata", r"\b(lata|minilata|tin)\b"), ("Bundle", r"\bbundle\b"), ("Colección", r"\bcolecci[oó]n\b|\bcollection\b"),
         ("Baraja", r"\b(baraja|mazo|deck|starter)\b"), ("Sobre", r"\bsobres?\b|\bbooster\b")]
FUERA = re.compile(r"manga|dvd|blu-?ray|pel[ií]cula|steelbook|portafolio|portfolio|archivador|carpeta|fundas?|porta ?mazo|tapete|alfombrilla|"
                   r"rat[oó]n|auricular|figura|peluche|camiseta|taza|cromos|panini|pulsera|reacondicionado|abiert|opened|proxy|replica|r[eé]plica|custom|coreano|korean|chino|chinese", re.I)
IDIOMA = [("ES", r"\(es\)|espa[nñ]ol|spanish|\bspa\b"), ("EN", r"\(en\)|ingl[eé]s|english|\beng?\b"), ("JP", r"japon[eé]s|japanese|\bjp\b|\bjap\b"),
          ("LAT", r"\(lat\)|latam"), ("IT", r"\bita\b|italiano"), ("FR", r"franc[eé]s|french|\bfr\b"), ("DE", r"alem[aá]n|german|\bde\b")]


def pedir(url, datos=None, cab=None, tiempo=600):
    req = urllib.request.Request(url, data=datos, headers={"User-Agent": "PillaoCartas/1.0", **(cab or {})})
    with urllib.request.urlopen(req, timeout=tiempo) as r:
        return r.read()


def descomprimir(b):
    if b[:2] == b"PK":
        z = zipfile.ZipFile(io.BytesIO(b)); return z.read(z.namelist()[0])
    return gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b


def que(nombre, lista):
    return next((k for k, r in lista if re.search(r, nombre, re.I)), None)


def sellado(nombre):
    return bool(que(nombre, JUEGOS)) and bool(que(nombre, TIPOS)) and not FUERA.search(nombre)


def descargar():
    filas = []
    f = (os.environ.get("AWIN_TODOCONSOLAS_FEED") or "").strip()
    if f:
        txt = descomprimir(pedir(f)).decode("utf-8", "replace")
        for r in csv.DictReader(io.StringIO(txt)):
            n = r.get("product_name", "")
            if sellado(n):
                filas.append({"tienda": "todoconsolas", "nombre": n, "precio": r.get("search_price"), "url": r.get("aw_deep_link"),
                              "img": r.get("merchant_image_url") or r.get("aw_image_url"), "ean": r.get("ean"), "stock": r.get("in_stock"), "cat": r.get("merchant_category")})
    cid, sec = (os.environ.get("EBAY_CLIENT_ID") or "").strip(), (os.environ.get("EBAY_CLIENT_SECRET") or "").strip()
    if cid and sec:
        tok = json.loads(pedir("https://api.ebay.com/identity/v1/oauth2/token",
                               ("grant_type=client_credentials&scope=" + urllib.parse.quote("https://api.ebay.com/oauth/api_scope")).encode(),
                               {"Authorization": "Basic " + base64.b64encode(f"{cid}:{sec}".encode()).decode(), "Content-Type": "application/x-www-form-urlencoded"}))["access_token"]
        consultas = sorted({clave(x["nombre"])[1] for x in filas if x["tienda"] == "todoconsolas"})
        for q in consultas:
            u = "https://api.ebay.com/buy/browse/v1/item_summary/search?" + urllib.parse.urlencode(
                {"q": q, "limit": "40", "filter": "conditions:{NEW},deliveryCountry:ES,buyingOptions:{FIXED_PRICE}"})
            r = json.loads(pedir(u, cab={"Authorization": "Bearer " + tok, "X-EBAY-C-MARKETPLACE-ID": "EBAY_ES"}))
            for it in r.get("itemSummaries", []):
                filas.append({"tienda": "ebay", "nombre": it.get("title"), "precio": (it.get("price") or {}).get("value"), "url": it.get("itemWebUrl"),
                              "img": (it.get("image") or {}).get("imageUrl"), "stock": "1", "cat": "ebay: " + q,
                              "envio": ((it.get("shippingOptions") or [{}])[0].get("shippingCost") or {}).get("value")})
    return filas


def coleccion(nombre):
    """El nombre de la colección: lo que queda al quitar el tipo, el juego y el idioma («Sobre Corona Astral Pokemon TCG (ES)» → «Corona Astral»)."""
    s = re.sub(r"\((es|en|lat|sp|jp)\)", " ", nombre, flags=re.I)
    s = re.sub(r"\b(pok[eé]mon|tcg|jcc|trading card game|one piece|card game|disney|lorcana|magic the gathering|yu-?gi-?oh!?|dragon ball( super)?( fusion world)?|digimon)\b", " ", s, flags=re.I)
    s = re.sub(r"\b(sobres?|bl[ií]ster|etb|elite trainer box|lata|minilata|bundle|colecci[oó]n|baraja de combate|baraja|mazo( de commander)?|caja|cart[oó]n|cartas|premium|de|del|con)\b", " ", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip(" -–:")


def clave(nombre):
    juego, tipo, idioma = que(nombre, JUEGOS), que(nombre, TIPOS), que(nombre, IDIOMA) or "?"
    col = coleccion(nombre)
    q = f"{juego} {col} {tipo if tipo != 'Elite Trainer Box' else 'elite trainer box'}"
    return (juego, tipo, col.lower(), idioma), q


def procesar(filas):
    fichas, ebay = {}, []
    for x in filas:
        try: precio = round(float(str(x.get("precio")).replace(",", ".")), 2)
        except (TypeError, ValueError): continue
        n = x.get("nombre") or ""
        if not precio or not sellado(n): continue
        if x["tienda"] == "ebay": ebay.append((x, precio)); continue
        k, _ = clave(n)
        f = fichas.setdefault(k, {"juego": k[0], "tipo": k[1], "coleccion": coleccion(n), "idioma": k[3], "nombre": n, "img": x.get("img"), "ofertas": []})
        f["ofertas"].append({"tienda": x["tienda"], "precio": precio, "envio": 0.0, "total": precio, "url": x.get("url"),
                             "stock": str(x.get("stock")) not in ("0", "False", "false"), "titulo": None})
    # eBay: un anuncio va a la ficha de su mismo juego, tipo e idioma cuyo nombre de colección sale entero en el título
    for x, precio in ebay:
        t = x["nombre"]; jg, tp, idi = que(t, JUEGOS), que(t, TIPOS), que(t, IDIOMA)
        for k, f in fichas.items():
            if f["juego"] == jg and f["tipo"] == tp and (idi is None or idi == f["idioma"]) and f["coleccion"] and \
               all(w in re.sub(r"[^a-z0-9 ]", "", t.lower()) for w in re.sub(r"[^a-z0-9 ]", "", f["coleccion"].lower()).split()):
                envio = float(x.get("envio") or 0)
                f["ofertas"].append({"tienda": "ebay", "precio": precio, "envio": envio, "total": round(precio + envio, 2), "url": x.get("url"), "stock": True, "titulo": t})
                break
    salida = []
    for k, f in fichas.items():
        tiendas = [o for o in f["ofertas"] if o["tienda"] != "ebay"]
        ref = statistics.median([o["total"] for o in tiendas]) if tiendas else 0
        eb = sorted([o for o in f["ofertas"] if o["tienda"] == "ebay" and o["total"] >= 0.5 * ref and (not ref or o["total"] <= 2.5 * ref)], key=lambda o: o["total"])[:3]
        ofertas = sorted(tiendas + eb, key=lambda o: (not o["stock"], o["total"]))
        m = re.search(r"(\d+)\s*sobres", f["nombre"], re.I)
        sobres = int(m.group(1)) if m else {"Sobre": 1, "Elite Trainer Box": 9, "Caja de sobres": 36}.get(f["tipo"])
        salida.append({"id": "|".join(map(str, k)), "juego": f["juego"], "tipo": f["tipo"], "coleccion": f["coleccion"], "idioma": f["idioma"],
                       "nombre": f["nombre"], "img": f["img"], "sobres": sobres, "ofertas": ofertas})
    salida.sort(key=lambda p: (p["juego"] != "Pokémon", -len({o["tienda"] for o in p["ofertas"]}), p["nombre"]))
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
