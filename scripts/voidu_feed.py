# Catálogo de Voidu (Daisycon) → feeds/voidu.json
# El feed JSON de Daisycon ya trae el enlace de afiliado (lt45.net…) y los precios en euros.
# Se guardan todas las claves en stock con su región («region_lock»); cada región de la web filtra las suyas.
import collections, html, json, re, sys

origen, destino = sys.argv[1], sys.argv[2]
d = json.load(open(origen, encoding="utf-8"))
progs = (d.get("datafeed") or d).get("programs") or []

def plataforma(act, gam, titulo):
    a, g, t = (act or "").lower(), (gam or "").lower(), titulo.lower()
    if "xbox" in a or "xbox" in g: return "Xbox Series", "Xbox"
    if "playstation" in a or "psn" in a or "playstation" in g: return ("PS4" if "ps4" in t and "ps5" not in t else "PS5"), "PSN"
    if "nintendo" in a or "switch" in g: return "Switch", "Nintendo eShop"
    return "PC", (act or "").strip()

filas, regiones = [], collections.Counter()
for p in progs:
    for it in p.get("products") or []:
        u, x = it.get("update_info") or {}, it.get("product_info") or {}
        if u.get("status") not in (None, "active") or str(x.get("in_stock", "true")).lower() != "true":
            continue
        try:
            pr = float(x.get("price") or 0); old = float(x.get("price_old") or 0)
        except ValueError:
            continue
        titulo = html.unescape(x.get("title") or "").strip()
        if pr <= 0 or not x.get("link") or not titulo or re.search(r"\baccount\b", titulo, re.I):
            continue
        if (x.get("currency") or "EUR") != "EUR":
            continue
        pl, drm = plataforma(x.get("activation_platform"), x.get("gaming_platform"), titulo)
        cat = (x.get("category_path") or "")
        tipo = "dlc" if re.search(r"\b(dlc|season pass|expansion|soundtrack)\b", titulo + " " + cat, re.I) else ""
        img = ""
        for im in x.get("images") or []:
            if im.get("location"): img = im["location"]; break
        reg = (x.get("region_lock") or "").strip()
        regiones[reg.lower()] += 1
        filas.append({"n": titulo, "t": tipo, "pl": pl, "p": pr, "r": old, "u": x["link"], "d": drm, "reg": reg, "img": img})

json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Voidu: {len(filas)} productos válidos guardados · regiones: {dict(regiones.most_common(15))}")
