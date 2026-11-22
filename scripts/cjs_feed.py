# Catálogo de CJS CD Keys (feed XML público con nuestro utm_source=pillao) → JSON.
# Uso: python3 scripts/cjs_feed.py <feed.xml> <españa.json> <latam.json>
# Precios en euros. Solo lo que está en stock o en reserva (lo agotado viene a 200 € de relleno).
# España: claves Global, Europe y Spain. Latinoamérica: Global, Latin America y de cada país (Argentina, México, Brasil…).
# Fuera: cuentas y accesos, «Altergift», películas, Meta Quest, Xbox 360/3DS, skins al azar y DVD en caja.
import xml.etree.ElementTree as ET, json, re, sys
origen, es_dest, la_dest = sys.argv[1:4]
us_dest = sys.argv[4] if len(sys.argv) > 4 else None   # opcional: Estados Unidos (Global, USA, North America)
REG_US = re.compile(r"^(global|usa?|united states( of america)?|north america|americas|us ?& ?canada)$", re.I)
PAISES_LA = {"Argentina": "AR", "Mexico": "MX", "Brazil": "BR", "Chile": "CL", "Colombia": "CO", "Peru": "PE", "Paraguay": "PY", "Venezuela": "VE"}
CAT_FUERA = {"Movie Digital Downloads", "Meta Quest Keys", "Xbox Accounts", "Steam Accounts", "Counter Strike Global Offensive Skins", "Boxed PC Games", "Nintendo 3DS Games"}
FUERA = re.compile(r"\b(accounts?|access|altergift|shared|offline|xbox 360|3ds|casino|bet|betting|poker|prime gaming|bespoke|wholesale)\b", re.I)
TARJETA = re.compile(r"\b(gift ?card|giftcard|top-?up|wallet|voucher|subscription|membership|v-?bucks|robux|coins|points|credits?|plex|uc\b|game ?time|game pass|ps plus|playstation plus|nintendo switch online|ea play|ubisoft\+|netflix|spotify|itunes|app store|google play|eur\b|usd\b|gbp\b|€|\$)", re.I)
SOFT = {"Software CD keys", "Windows and Office Keys"}
def limpia(n):
    n = re.sub(r"\s+", " ", n).strip()
    for _ in range(4):
        n = re.sub(r"\s*\((?:GLOBAL|Europe|EU|Global|United Kingdom|USA|NA|Latin America|Argentina|Mexico|Brazil|Spain|[A-Za-z ]+)\)\s*$", "", n)
        n = re.sub(r"\s*:\s*[A-Za-z ]+$", "", n)
    n = re.sub(r"\((?:Digital Download|Digital|Playstation|PS5|PS4|Xbox Series X\|S|Xbox One|Nintendo Switch 2?|EA App|Windows 10|PC|Apple Store|Android, IOS)\)", " ", n, flags=re.I)
    n = re.sub(r"\b(?:PSN )?Digital Download (?:Key|Code)\b|\bDownload Key\b|\bCD Key\b|\b(?:Steam|GOG|Epic Games|Ubisoft Connect|EA App|Origin|Battle\.net|Rockstar|Microsoft Store|PSN|Xbox Live) (?:Key|Code)\b|\bKey\b|\bCode\b|\bfor Windows 10\b|\bDigital Copy\b", " ", n, flags=re.I)
    n = re.sub(r"\b(?:EU|EUROPE|GLOBAL|UNITED KINGDOM|XBOX One / Xbox Series X\|S|Xbox One / Series X\|S|Xbox Series X\|S|PS4 & PS5|PS5|PS4)\b", " ", n)
    n = re.sub(r"\(\s*(?:without\s*)?\)|\s-\s*$|\s*-\s*(?=\s|$)", " ", n)
    return re.sub(r"\s+", " ", n).strip(" -:")
es, la, us = [], [], []
for ev, el in ET.iterparse(origen):
    if el.tag != "product": continue
    g = lambda k: (el.findtext(k) or "").strip()
    n, cat, reg, plat, drm, st = g("name"), g("category"), g("region"), g("platform"), g("drm"), g("stock")
    precio_txt, link, img = g("price"), g("link"), g("image")
    el.clear()
    if st not in ("in stock", "preorder") or cat in CAT_FUERA or FUERA.search(n): continue
    try: pr = float(precio_txt or 0)
    except ValueError: continue
    if not (0 < pr < 1000): continue
    tarjeta = bool(TARJETA.search(n)) and not re.search(r"\b(edition|bundle|upgrade|dlc|season pass)\b", n, re.I)
    if cat in SOFT: t, pl = "software", "PC"
    elif tarjeta: t, pl = "tarjeta", "Tarjeta regalo"
    else:
        t = "dlc" if re.search(r"\b(dlc|add-on|season pass|expansion|upgrade|pack)\b", re.sub(r"pre-?order bonus( dlc)?", "", n, flags=re.I), re.I) else ""
        if "Xbox" in plat or "Xbox" in cat: pl = "Xbox Series"
        elif "PlayStation" in plat or "Playstation" in cat or "PSN" in cat: pl = "PS4" if re.search(r"\bPS4\b", n) and not re.search(r"\bPS5\b", n) else "PS5"
        elif "Nintendo" in plat or "Nintendo" in cat: pl = "Switch 2" if re.search(r"switch 2", n, re.I) else "Switch"
        elif drm or plat: pl = "PC"
        else: continue
    nombre = limpia(n)
    if len(nombre) < 2: continue
    d = re.sub(r"\s*\(DRM-free\)|\s*/\s*Origin|Xbox Live / ", "", drm).strip() or plat
    fila = {"n": nombre, "t": t, "pl": pl, "d": d, "p": pr, "u": link, "img": img, "pre": st == "preorder",
            "s": 1 if re.search(r"\brandom\b", n, re.I) else 0}
    if not fila["u"]: continue
    if reg in ("Global", "Europe", "Spain"): es.append({**fila, "reg": reg})
    if reg in ("Global", "Latin America") or reg in PAISES_LA: la.append({**fila, "reg": PAISES_LA.get(reg, reg)})
    if REG_US.match(reg): us.append({**fila, "reg": reg})
json.dump(es, open(es_dest, "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(la, open(la_dest, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"CJS: {len(es)} productos válidos en España y {len(la)} en Latinoamérica")
if us_dest:
    json.dump(us, open(us_dest, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"CJS: {len(us)} productos válidos en Estados Unidos")
