# Catálogo de Nuuvem (Rakuten Advertising, MID 46796) → feeds/nuuvem.json. Uso: python3 scripts/nuuvem_feed.py <feed(.xml|.txt)[.gz]> <destino.json>
# Formato «Merchandiser» de Rakuten: XML (<product name=… ><URL><product>…) o texto separado por «|». Precios en reales.
# Fuera: cuentas, saldos de webs de apuestas y lo que no está disponible.
import gzip, json, re, sys, html
import xml.etree.ElementTree as ET
origen, destino = sys.argv[1], sys.argv[2]
abrir = (lambda f: gzip.open(f, "rb")) if origen.endswith(".gz") else (lambda f: open(f, "rb"))
FUERA = re.compile(r"\b(account|conta|casino|bet|poker)\b", re.I)
TARJETA = re.compile(r"\b(gift ?card|cart[aã]o|cr[eé]ditos?|wallet|saldo|game pass|ps plus|playstation plus|nintendo switch online|xbox live|v-?bucks|robux|riot points|valorant points)\b", re.I)
filas = []
def num(s):
    try: return float(str(s or "0").replace(",", "."))
    except ValueError: return 0.0
def meter(nombre, cat, link, img, venta, normal, disp):
    nombre = html.unescape(nombre or "").strip()
    if not nombre or not link or FUERA.search(nombre) or (disp and re.search(r"out|indispon|esgotad", disp, re.I)): return
    p = venta or normal
    if not (p > 0): return
    t = "tarjeta" if TARJETA.search(nombre) else "dlc" if re.search(r"\b(dlc|season pass|expansion|expans[aã]o|pack)\b", nombre, re.I) else ""
    pl = "Tarjeta regalo" if t == "tarjeta" else "Xbox Series" if re.search(r"xbox", cat + " " + nombre, re.I) else "Switch" if re.search(r"nintendo|switch", cat + " " + nombre, re.I) else "PS5" if re.search(r"playstation|psn", cat + " " + nombre, re.I) else "PC"
    nombre = re.sub(r"\s*[-–]\s*(PC|Steam|Epic Games|GOG|Xbox( One| Series X\|S)?|Nintendo Switch)\b.*$", "", nombre, flags=re.I).strip()
    filas.append({"n": nombre, "t": t, "pl": pl, "p": p, "r": normal if normal > p else 0, "u": link, "img": img or ""})
with abrir(origen) as f:
    cabeza = f.read(200); f.seek(0)
    if cabeza.lstrip().startswith(b"<"):
        for ev, el in ET.iterparse(f):
            if el.tag != "product": continue
            g = lambda ruta: (el.findtext(ruta) or "").strip()
            pr = el.find("price")
            venta, normal = (num(pr.findtext("sale")), num(pr.findtext("retail"))) if pr is not None else (0, 0)
            meter(el.get("name"), g("category/primary") + " " + g("category/secondary"), g("URL/product"), g("URL/productImage"), venta, normal, g("shipping/availability"))
            el.clear()
    else:
        for linea in f.read().decode("utf-8", "replace").splitlines():
            c = linea.split("|")
            if len(c) < 15 or c[0] in ("HDR", "TRL"): continue
            # id | nombre | sku | categoría | subcategoría | enlace | imagen | … | venta | normal …: las columnas se buscan por forma
            link = next((x for x in c if x.startswith("http") and "click.linksynergy" in x), "") or next((x for x in c if x.startswith("http")), "")
            img = next((x for x in c if re.search(r"\.(jpe?g|png|webp)(\?|$)", x, re.I)), "")
            precios = [num(x) for x in c[12:16] if re.fullmatch(r"\d+([.,]\d+)?", x or "")]
            if not precios: continue
            meter(c[1], c[3] + " " + c[4], link, img, min(precios), max(precios), "")
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Nuuvem: {len(filas)} productos ({sum(1 for x in filas if x['t'] == 'tarjeta')} tarjetas)")
