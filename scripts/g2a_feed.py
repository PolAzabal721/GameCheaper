# Catálogo de G2A (Admitad) → JSON. Uso: python3 scripts/g2a_feed.py <feed.csv> <destino.json> [latam]
# Feed de Alemania (en euros) para España: claves GLOBAL, EUROPE y EU. Feed de México (en pesos) para Latinoamérica:
# GLOBAL, LATAM y MEXICO. El nombre trae plataforma, tienda de la clave y región: «Juego (PC) - Steam Key - GLOBAL».
# Fuera: cuentas, «gifts», cajas sorpresa «Try to Get…», cripto, apuestas, monederos y tarjetas que no son de videojuegos.
import csv, json, re, sys, html
origen, destino = sys.argv[1], sys.argv[2]
LATAM = len(sys.argv) > 3 and sys.argv[3] == "latam"
REG_OK = {"GLOBAL", "LATAM", "LATIN AMERICA", "MEXICO"} if LATAM else {"GLOBAL", "EUROPE", "EU", "SPAIN"}
FUERA = re.compile(r"\b(account|gift\b(?! card)|try to get|random|mystery|casino|bet|betting|poker|skin\.?club|case|cases)\b", re.I)
TARJETAS = re.compile(r"\b(psn|playstation|xbox|nintendo|steam|ea play|ubisoft|battle\.?net|blizzard|roblox|v-?bucks|fortnite|riot|valorant|league of legends|game pass|ps plus|playstation plus|nintendo switch online)\b", re.I)
CAT_FUERA = set()
filas = []
for x in csv.DictReader(open(origen, encoding="utf-8", errors="replace"), delimiter=";"):
    n = html.unescape(x.get("name", "")).strip()
    if not n or x.get("categoryId") in CAT_FUERA or FUERA.search(n): continue
    m = re.match(r"^(.*)\s-\s(.+?)\s-\s([A-Z][A-Z &/]+)$", n)
    if not m: continue
    nombre, llave, region = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
    if region not in REG_OK: continue
    try: pr = float(x.get("price") or 0); op = float(x.get("oldprice") or 0)
    except ValueError: continue
    if pr <= 0 or not x.get("url"): continue
    tarjeta = x.get("categoryId") in ("Cash gift cards", "Gift Me Crypto", "Crypto Voucher", "Rewarble", "Other") or re.search(r"\b(gift card|card|points|credits?|wallet|voucher|top ?up)\b", nombre, re.I)
    # Plataforma: lo que va entre paréntesis en el nombre, o la tienda de la clave
    pm = re.search(r"\((PC|Xbox Series X/S|Xbox One|Xbox One / Series X/S|PS5|PS4|Nintendo Switch|Nintendo Switch 2|Mac)\)\s*$", nombre)
    plat_txt = pm.group(1) if pm else llave
    nombre = re.sub(r"\s*\([^)]*\)\s*$", "", nombre).strip()
    if tarjeta: plat = "Tarjeta regalo"
    elif re.search(r"xbox", plat_txt, re.I): plat = "Xbox Series"
    elif re.search(r"switch 2", plat_txt, re.I): plat = "Switch 2"
    elif re.search(r"nintendo|switch|eshop", plat_txt, re.I): plat = "Switch"
    elif re.search(r"ps5|psn|playstation", plat_txt, re.I): plat = "PS5" if "PS4" not in plat_txt else "PS4"
    elif re.search(r"\bmac\b", plat_txt, re.I): continue
    else: plat = "PC"
    drm = re.sub(r"\s*(Key|Code|Gift)\s*$", "", llave, flags=re.I).strip()
    t = "tarjeta" if tarjeta else ("dlc" if re.search(r"\b(dlc|add-on|season pass|expansion|soundtrack)\b", nombre, re.I) else "")
    filas.append({"n": nombre, "t": t, "pl": plat, "p": pr, "r": op, "u": x["url"], "d": drm, "reg": region, "img": x.get("picture", "")})
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"G2A: {len(filas)} productos válidos ({'Latinoamérica' if LATAM else 'España'})")
