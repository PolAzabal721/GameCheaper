# Catálogo de GamersGate a través de CJ (paga la comisión en dinero) → feeds/gamersgate.json
# Usa la API de productos de CJ con el token (CJ_TOKEN), solo el catálogo en euros, y pide para cada producto
# su enlace de afiliado con el PID de pillaojuegos.com. CJ no deja pasar de 10.000 resultados por consulta,
# así que se pide por tramos de precio.
import json, os, re, sys, html, urllib.request

CID, PID, ANUNCIANTE = "8127571", "101929112", "2821123"
TOKEN = os.environ.get("CJ_TOKEN", "").strip()
destino = sys.argv[1]
TRAMOS = [(0, 2), (2.0001, 5), (5.0001, 10), (10.0001, 20), (20.0001, 40), (40.0001, 100000)]

def consulta(q):
    r = urllib.request.Request("https://ads.api.cj.com/query", data=json.dumps({"query": q}).encode(),
                               headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as f:
        d = json.load(f)
    if "errors" in d or not d.get("data"):
        raise RuntimeError(str(d)[:300])
    return d["data"]["products"]

def texto(s):
    return re.sub(r"\s+", " ", html.unescape(html.unescape(s or ""))).strip()

vistos, filas = set(), []
for bajo, alto in TRAMOS:
    offset, total = 0, None
    while total is None or offset < total:
        lim = min(1000, 10000 - offset)
        if lim <= 0:
            print(f"Aviso: el tramo {bajo}-{alto} € pasa de 10.000 productos; faltan algunos")
            break
        p = consulta('{ products(companyId: "%s", partnerIds: ["%s"], currency: "EUR", lowPrice: %s, highPrice: %s, limit: %d, offset: %d) '
                     '{ totalCount count resultList { id title imageLink price { amount } salePrice { amount } linkCode(pid: "%s") { clickUrl } '
                     '... on Shopping { availability } } } }' % (CID, ANUNCIANTE, bajo, alto, lim, offset, PID))
        total = p["totalCount"]
        for x in p["resultList"]:
            if x["id"] in vistos or (x.get("availability") or "in stock") not in ("in stock", "preorder"):
                continue
            vistos.add(x["id"])
            nombre = texto(x["title"])
            if re.search(r"\b(soundtrack|ost|artbook|art book|guide)\b", nombre, re.I):
                continue
            pr = float((x.get("salePrice") or {}).get("amount") or 0) or float((x.get("price") or {}).get("amount") or 0)
            reg = float((x.get("price") or {}).get("amount") or 0)
            url = ((x.get("linkCode") or {}).get("clickUrl")) or ""
            if pr <= 0 or not url:
                continue
            nombre = re.sub(r"\s*\((steam|gog|epic)\)\s*$", "", nombre, flags=re.I)
            filas.append({"n": nombre, "t": "dlc" if x["id"].startswith("DLC-") else "", "p": pr, "r": reg, "u": url,
                          "d": "", "res": 1 if x.get("availability") == "preorder" else 0, "img": x.get("imageLink") or ""})
        offset += p["count"] or lim
        if not p["count"]:
            break
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"GamersGate (CJ): {len(filas)} productos con enlace de afiliado")
