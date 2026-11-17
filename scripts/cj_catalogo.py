# Catálogo de un anunciante de CJ → JSON (lo usa el actualizador de precios). Ahora mismo: K4G.
# Uso: CJ_TOKEN=… python3 scripts/cj_catalogo.py <id del anunciante> <destino.json>
# Funciona aunque aún no estemos unidos al programa (los datos de producto son públicos para los editores de CJ);
# el enlace de afiliado solo existe cuando CJ nos acepta: entonces cada producto lleva «cu» (enlace de CJ con nuestro PID).
# CJ no deja pasar de 10.000 resultados por consulta: se pide por tramos de precio, partiendo los que se pasan.
import json, os, sys, urllib.request

CID, PID = "8127571", "101929112"
TOKEN = os.environ.get("CJ_TOKEN", "").strip()
anunciante, destino = sys.argv[1], sys.argv[2]

def consulta(q):
    r = urllib.request.Request("https://ads.api.cj.com/query", data=json.dumps({"query": q}).encode(),
                               headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=180) as f:
        d = json.load(f)
    if "errors" in d or not d.get("data"):
        raise RuntimeError(str(d)[:300])
    return d["data"]["products"]

def unido():
    try:
        return consulta('{ products(companyId: "%s", partnerIds: ["%s"], partnerStatus: JOINED, limit: 1) { totalCount } }' % (CID, anunciante))["totalCount"] > 0
    except Exception:
        return False

UNIDO = unido()
ESTADO = "JOINED" if UNIDO else "NOT_JOINED"
CAMPOS = "id catalogName title link imageLink price { amount currency } salePrice { amount currency }" + (' linkCode(pid: "%s") { clickUrl }' % PID if UNIDO else "")

def total(bajo, alto):
    return consulta('{ products(companyId: "%s", partnerIds: ["%s"], partnerStatus: %s, lowPrice: %s, highPrice: %s, limit: 1) { totalCount } }'
                    % (CID, anunciante, ESTADO, bajo, alto))["totalCount"]

def tramos(bajo, alto):
    n = total(bajo, alto)
    if n <= 9500 or alto - bajo < 0.02:
        return [(bajo, alto)] if n else []
    medio = round((bajo + alto) / 2, 2)
    return tramos(bajo, medio) + tramos(round(medio + 0.01, 2), alto)

vistos, filas = set(), []
import collections
monedas = collections.Counter()
print("tramos:", tramos(0, 5000))
for bajo, alto in tramos(0, 5000):
    offset = 0
    while offset < 10000:
        p = consulta('{ products(companyId: "%s", partnerIds: ["%s"], partnerStatus: %s, lowPrice: %s, highPrice: %s, limit: 1000, offset: %d) { count resultList { %s } } }'
                     % (CID, anunciante, ESTADO, bajo, alto, offset, CAMPOS))
        for x in p["resultList"]:
            precio = (x.get("salePrice") or None) or x.get("price") or {}
            clave = (x["id"], precio.get("currency"), x.get("link"))
            if clave in vistos:
                continue
            vistos.add(clave)
            monedas[(precio.get("currency"), x.get("catalogName"))] += 1
            if precio.get("currency") != "EUR":
                continue
            fila = {"l": x.get("link") or "", "n": x.get("title") or "", "p": float(precio.get("amount") or 0),
                    "r": float((x.get("price") or {}).get("amount") or 0), "img": x.get("imageLink") or ""}
            cu = (x.get("linkCode") or {}).get("clickUrl")
            if cu:
                fila["cu"] = cu
            if fila["l"] and fila["p"] > 0:
                filas.append(fila)
        if p["count"] < 1000:
            break
        offset += 1000
print("monedas:", monedas.most_common(8), "vistos:", len(vistos))
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"CJ {anunciante}: {len(filas)} productos en euros ({'unidos: con enlace de afiliado' if UNIDO else 'aún sin aceptar: enlaces normales'})")
