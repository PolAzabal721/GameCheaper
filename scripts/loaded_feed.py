# Catálogo de Loaded (antes CDKeys) para España → feeds/loaded.json
# Viene del FTP de Impact (catálogo «Loaded-ProductFeed_EUR_Spanish», en euros y con el enlace de afiliado puesto).
# Todas sus regiones valen en España (Worldwide, Europe & UK, Europe, EMEA, Europe & North America, Spain);
# por si acaso, se descarta cualquier otra. Nombres: «Sniper Elite 3 PC», «… Switch (Europe & UK)», «… PC - DLC».
import gzip, html, json, re, sys
import xml.etree.ElementTree as ET

origen, destino = sys.argv[1], sys.argv[2]
MODO = sys.argv[3] if len(sys.argv) > 3 else ""
LATAM = MODO in ("latam", "us")   # catálogo en dólares para pillaojuegos.com/latam/ y /us/
REGION_OK = re.compile(r"(worldwide|global|north america|united states|usa|\bus\b|americas)", re.I) if MODO == "us" else \
    re.compile(r"(worldwide|global|latin|latam|south america|americas|argentina|mexico|brazil|chile|colombia|peru)", re.I) if LATAM else \
    re.compile(r"^(worldwide|europe & uk|europe|europe middle east and africa|europe & north america|spain|)$", re.I)
PLAT_FIN = re.compile(r"\s+(PC|Mac|Xbox One & Xbox Series X\|S|Xbox One / Xbox Series X\|S|Xbox Series X\|S|Xbox Series X/S|Xbox One|Xbox|Switch 2|Nintendo Switch 2|Switch|Nintendo Switch|PS5|PS4|PlayStation 5|PlayStation 4)$", re.I)

def plataforma(cat, plat, titulo):
    t = titulo.lower()
    if cat.startswith("Gift Cards") or "Gift Cards" in cat or "Game Pass" in cat or "Switch Online" in cat or "Points" in cat:
        return "Tarjeta regalo", "tarjeta"
    if cat.startswith("Xbox") or "xbox" in plat.lower():
        return "Xbox Series", None
    if cat.startswith("Nintendo") or plat in ("Nintendo", "Switch 2"):
        return ("Switch 2" if plat == "Switch 2" or "switch 2" in t else "Switch"), None
    if cat.startswith("PlayStation") or plat == "PlayStation Network":
        return ("PS4" if re.search(r"\bps4\b", t) and not re.search(r"\bps5\b", t) else "PS5"), None
    if plat in ("McAfee", "Windows", "Microsoft") and not cat.startswith("PC > Games"):
        return "PC", "software"
    return "PC", None

filas = []
with gzip.open(origen) if origen.endswith(".gz") else open(origen, "rb") as f:
    for it in ET.parse(f).getroot().iter("item"):
        x = {c.tag: (c.text or "").strip() for c in it}
        if (x.get("availability") or "InStock") != "InStock" or not REGION_OK.search(x.get("region", "") or ("worldwide" if LATAM else "")):
            continue
        try:
            pr = float(x.get("price") or 0); rrp = float(x.get("rrp_price") or 0)
        except ValueError:
            continue
        if pr <= 0 or not x.get("link"):
            continue
        titulo = html.unescape(x.get("title", ""))
        if re.search(r"\baccount\b", titulo, re.I):
            continue
        plat, tipo = plataforma(x.get("category") or x.get("product_category") or "", x.get("platform", ""), titulo)
        nombre = re.sub(r"\s*\((europe[^)]*|worldwide|spain|emea|ww)\)\s*$", "", titulo, flags=re.I)
        if re.search(r"\s+-\s+DLC$", nombre, re.I) or "DLC" in (x.get("category") or "") or "Season Pass" in (x.get("category") or ""):
            tipo = tipo or "dlc"
        nombre = re.sub(r"\s+-\s+DLC$", "", nombre, flags=re.I)
        nombre = PLAT_FIN.sub("", nombre).strip()
        filas.append({"n": nombre, "t": tipo or "", "pl": plat, "p": pr, "r": rrp, "u": x["link"], "d": x.get("platform", ""),
                      "reg": x.get("region", ""), "img": x.get("image_link", "")})
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Loaded: {len(filas)} productos válidos ({MODO or 'España'}) guardados")
