# Catálogo de Todo Consolas (Awin, Create-a-Feed, CSV en zip) → JSON. Uso: python3 scripts/todoconsolas_feed.py <feed.zip|csv> <destino.json>
# Solo videojuegos de plataformas actuales (PS5, PS4, Switch, Switch 2, Xbox Series y Xbox One), nuevos y de segunda mano.
import csv, json, re, sys, zipfile, io
origen, destino = sys.argv[1], sys.argv[2]
if zipfile.is_zipfile(origen):
    z = zipfile.ZipFile(origen); datos = io.TextIOWrapper(z.open(z.namelist()[0]), encoding="utf-8", errors="replace")
else:
    datos = open(origen, encoding="utf-8", errors="replace")
PLAT = {"PC": "PC", "PS5": "PS5", "PS4": "PS4", "Switch 2": "Switch 2", "Switch": "Switch", "Xbox Series": "Xbox Series", "Xbox Series X": "Xbox Series", "Xbox One": "Xbox Series"}
FIN = re.compile(r"\s*\((SP|ES|EU|UK|IT|FR|DE|PT|USA|JP|Import[^)]*)\)\s*$", re.I)
PL_FIN = re.compile(r"\s+(PS5|PS4|Switch 2|Switch|Xbox Series X\|?S?|Xbox Series X|Xbox Series|Xbox One|XboxOne|XBOne)\s*$", re.I)
filas = []
for x in csv.DictReader(datos):
    if x.get("merchant_category") != "Videojuego": continue
    tipo = (x.get("product_type") or "").replace("Gaming ", "").strip()
    if tipo not in PLAT: continue
    try: p = float(x.get("search_price") or 0); r = float(x.get("rrp_price") or 0); env = float(x.get("delivery_cost") or 0)
    except ValueError: continue
    if p <= 0: continue
    n = (x.get("product_name") or "").strip()
    region = (FIN.search(n).group(1).upper() if FIN.search(n) else "SP")
    for _ in range(3): n = FIN.sub("", n); n = PL_FIN.sub("", n)
    filas.append({"n": n.strip(), "pl": PLAT[tipo], "one": tipo == "Xbox One", "p": p, "r": r, "env": env, "usado": x.get("condition") in ("used", "refurbished"),
                  "stock": x.get("in_stock") == "1", "pre": x.get("pre_order") == "1", "imp": region not in ("SP", "ES", "EU"),
                  "u": x.get("aw_deep_link") or "", "img": x.get("merchant_image_url") or ""})
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Todo Consolas: {len(filas)} juegos ({sum(f['usado'] for f in filas)} de segunda mano)")
