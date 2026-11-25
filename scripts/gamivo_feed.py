# Catálogo de Gamivo por CJ (lo baja scripts/cj_catalogo.py) → feeds/gamivo.json, con la región y la plataforma sacadas del nombre.
# Gamivo es un mercado de claves: fuera cuentas y regalos de Steam. «reg»: global, eu, us, latam, es, de, fr u otra.
import json, re, sys, urllib.parse
origen, destino = sys.argv[1], sys.argv[2]
PLAT = re.compile(r"\s+(PC|Xbox( One| Series X\|?S| Series)?|PS4|PS5|PSN|PlayStation( 4| 5)?|Nintendo( Switch( 2)?)?|Switch( 2)?|Steam|EA App|Origin|Epic( Games)?|GOG|Ubisoft( Connect)?|Battle\.net|Rockstar|Microsoft Store|Windows 10)\b.*$", re.I)
REG = [("latam", r"\b(latam|latin america)\b"), ("us", r"\b(us|usa|united states|north america|na)\b"), ("eu", r"\b(eu|europe|emea)\b"),
       ("de", r"\b(de|germany|dach)\b"), ("fr", r"\b(fr|france)\b"), ("es", r"\b(es|spain)\b"), ("global", r"\b(global|worldwide|row|region free)\b")]
filas = []
for f in json.load(open(destino if False else origen)):
    n = (f.get("n") or "").strip()
    # Enlace de CJ: el del catálogo si viene; si no, el enlace profundo de nuestro anuncio de Gamivo (17269770) hacia el producto
    u = f.get("cu") or ("https://www.dpbolvw.net/click-101929112-17269770?url=" + urllib.parse.quote(f["l"], safe="") if f.get("l") else "")
    if not n or not u or not (f.get("p") or 0) > 0: continue
    if re.search(r"\baccount\b|\bgift\b(?! ?card)", n, re.I): continue
    low = n.lower()
    reg = next((k for k, r in REG if re.search(r, low)), "otra")
    pl = "Xbox Series" if re.search(r"\bxbox\b", low) else "PS5" if re.search(r"\b(ps5|playstation 5)\b", low) else "PS4" if re.search(r"\b(ps4|psn|playstation 4)\b", low) else \
         "Switch" if re.search(r"\b(nintendo|switch)\b", low) else "PC"
    drm = next((d for d, r in [("Steam", r"\bsteam\b"), ("EA App", r"\b(ea app|origin)\b"), ("Epic", r"\bepic\b"), ("GOG", r"\bgog\b"), ("Ubisoft", r"\bubisoft\b"), ("Battle.net", r"battle\.net"), ("Rockstar", r"\brockstar\b"), ("Microsoft Store", r"microsoft store|windows 10")] if re.search(r, low)), "")
    nombre = PLAT.sub("", n)
    nombre = re.sub(r"\s+(" + "|".join(r for _, r in REG) + r")(\s.*)?$", "", nombre, flags=re.I).strip(" -")
    if len(nombre) < 2: continue
    tipo = "tarjeta" if re.search(r"gift ?card|\bwallet\b|\bpoints?\b|\bcoins?\b|\bdiamonds?\b|\bv-?bucks\b|\brobux\b|\bsubscription\b|\bgame pass\b|\bmembership\b", low) else "dlc" if re.search(r"\b(dlc|season pass|expansion|soundtrack)\b", low) else ""
    filas.append({"n": nombre, "t": tipo, "pl": pl, "p": f["p"], "r": f.get("r") or 0, "u": u, "d": drm or pl, "reg": reg, "img": f.get("img", "")})
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
import collections
print(f"Gamivo: {len(filas)} productos · regiones: {dict(collections.Counter(x['reg'] for x in filas).most_common())}")
