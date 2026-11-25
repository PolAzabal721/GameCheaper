# Catálogo de Gamesporium (Admitad, CSV con «;») → feeds/gamesporium.json
# Tienda de claves oficiales en euros. Viene con nuestro enlace de afiliado. Sin columna de región: se usa en las regiones en euros.
import csv, json, re, sys, collections
csv.field_size_limit(10**9)
origen, destino = sys.argv[1], sys.argv[2]
MONEDA = sys.argv[3] if len(sys.argv) > 3 else "EUR"
mejor, plataformas, ediciones = {}, collections.Counter(), collections.Counter()
for x in csv.DictReader(open(origen, encoding="utf-8", errors="replace", newline=""), delimiter=";"):
    if (x.get("available") or "true").lower() != "true" or (x.get("currencyId") or MONEDA) != MONEDA: continue
    n = (x.get("name") or "").strip()
    if not n or re.search(r"\baccount\b", n, re.I): continue
    if (x.get("delivery_type") or "key").lower() not in ("key", ""): continue
    try: pr = float(x.get("price") or 0); op = float(x.get("oldprice") or 0)
    except ValueError: continue
    if pr <= 0 or not x.get("url"): continue
    act = (x.get("activation_platform") or "").strip(); plataformas[act] += 1
    ed = (x.get("edition") or "").strip(); ediciones[ed] += 1
    a = act.lower()
    pl = "Xbox Series" if "xbox" in a or "microsoft" in a else "PS5" if "playstation" in a or "psn" in a else "Switch" if "nintendo" in a else "PC"
    tipo = "dlc" if re.search(r"\b(dlc|season pass|expansion|soundtrack|add-?on)\b", n + " " + ed, re.I) else ""
    clave = (n.lower(), pl)
    if clave in mejor and mejor[clave]["p"] <= pr: continue
    mejor[clave] = {"n": n, "t": tipo, "pl": pl, "p": pr, "r": op, "u": x["url"], "d": act or "Steam", "img": (x.get("picture") or "").split(",")[0].strip()}
filas = list(mejor.values())
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Gamesporium: {len(filas)} productos guardados · activación: {dict(plataformas.most_common(8))} · ediciones: {dict(ediciones.most_common(8))}")
