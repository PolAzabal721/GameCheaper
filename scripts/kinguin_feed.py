# Convierte el catálogo CSV de Kinguin (Admitad) en feeds/kinguin.json, solo con lo que vale en España.
# Fuera: cuentas (GAME_ACCOUNT y nombres con «Account»), regalos de Steam (Altergift / Gift) y claves bloqueadas en España.
import csv, json, re, sys, gzip
csv.field_size_limit(10**9)
origen, destino = sys.argv[1], sys.argv[2]
destino_latam = sys.argv[3] if len(sys.argv) > 3 else None   # opcional: lo que vale en Latinoamérica (para pillaojuegos.com/latam/)
destino_us = sys.argv[4] if len(sys.argv) > 4 else None      # opcional: lo que vale en Estados Unidos (para pillaojuegos.com/us/)
destino_de = sys.argv[5] if len(sys.argv) > 5 else None      # opcional: lo que vale en Alemania (para pillaojuegos.com/de/)
destino_fr = sys.argv[6] if len(sys.argv) > 6 else None      # opcional: lo que vale en Francia (para pillaojuegos.com/fr/)
LATAM = ("AR", "MX", "CL", "CO", "PE")
PAISES = {"AR": "Argentina", "MX": "Mexico", "CL": "Chile", "CO": "Colombia", "PE": "Peru", "BR": "Brazil", "UY": "Uruguay", "EC": "Ecuador", "VE": "Venezuela", "BO": "Bolivia", "PY": "Paraguay", "CR": "Costa Rica", "PA": "Panama", "GT": "Guatemala", "DO": "Dominican Republic"}                       # si la clave está bloqueada en alguno de estos, no vale para «LATAM»
abrir = gzip.open if origen.endswith(".gz") else open
# Nada de apuestas, casinos ni webs de abrir cajas de skins (Pol no las quiere y en España su publicidad está muy limitada)
APUESTAS = re.compile(r"\b(casino|casinos|bet|bets|betting|apuestas|poker|slots?|lootbox|loot ?boxes|case ?opening|rainbet|csgoroll|csgoempire|csgofast|csgorun|csgowin|csgocasino|csgolombard|cscomps|csmarket|cs2land|csland|vscsgo|hypedrop|keydrop|key-drop|skinclub|clash\.gg|gamdom|stake|roobet|rollbit|duel|winna|rakebit|jemlit|gambagames|rustyloot|rustprofit|runehall|plunder|pirateswap|royale\.gg|empiredrop|forcedrop|ggdrop|diceblox|rorush|juice\.gg|paidskills|dotaboom|opduel|betterplayerwin|playersvipclub|spinarium|magic rust|bizzo|plg\.bet|upgrader|splits\.gg|tradeit|lootbox\.com|raided|datdrop|farmskins|hellcase|daddyskins|csgo500|bloodycase|g4skins)\b", re.I)
SALDO = re.compile(r"gift ?card|coins?\b|balance|wallet|voucher|gems\b|[$€£₺]|\b(usd|eur|gbp|pln|chf)\b", re.I)
# Cajas de skins (se abren con llave y dan algo al azar): fuera
CAJAS = re.compile(r"\b(case|cases|capsule|souvenir package|package|caja|cajas)\b", re.I)
MERCADOS_SKINS = re.compile(r"^(dmarket|skinsmonkey|skinflow\.gg|swap\.gg|cs\.trade|shadowpay(\.com)?|qqskins|skinswap|tradeit(\.gg)?|cs\.money|skinport|waxpeer|skinbaron|lis-skins|rapidskins)\b", re.I)
filas, latam, us, de, fr = [], [], [], [], []
with abrir(origen, "rt", encoding="utf-8", errors="replace", newline="") as f:
    for x in csv.DictReader(f, delimiter=";"):
        c, n = x.get("categoryId", ""), x.get("name", "")
        if c in ("GAME_ACCOUNT", "GAME_ACCOUNT_PREPAID", "ALTERGIFT"): continue
        if re.search(r"\baccount\b|altergift|\bgift\b(?! card)", n, re.I): continue
        if APUESTAS.search(n) and SALDO.search(n): continue
        if c == "CSGO_SKINS" and CAJAS.search(n): continue
        # Skins: casi todo lo de esta categoría son saldos de webs de apuestas o de abrir cajas (CSGOluck, Skin.Club, Rain.gg…)
        # y «skin keys» al azar. Solo entran los mercados donde compras o cambias skins concretas (lista cerrada).
        if c == "CSGO_SKINS" and not MERCADOS_SKINS.search(n): continue
        try: pr = float(x.get("price") or 0); op = float(x.get("oldprice") or 0)
        except ValueError: continue
        if pr <= 0: continue
        lim = set(re.split(r"\s*,\s*", x.get("country_limitations", "").upper())) - {""}
        fila = {"n": n, "c": c, "p": x.get("platform", ""), "r": x.get("region", ""), "pr": pr, "op": op, "u": re.sub(r"%3Fnosalesbooster%3D1%26currency%3DEUR$", "", x.get("url", "")), "s": x.get("steam_id", ""), "i": (x.get("picture") or x.get("image") or "").split(",")[0].strip()}
        if "ES" not in lim: filas.append(fila)
        if destino_latam:
            # Vale en toda LATAM, o es de un país concreto de LATAM (p. ej. «Argentina»): entonces se marca «Solo …»
            pais = next((nombre for cod, nombre in PAISES.items() if re.search(r"\b" + nombre + r"\b", x.get("region", ""), re.I) and cod not in lim), None)
            if not lim.intersection(LATAM): latam.append(fila)
            elif pais: latam.append({**fila, "solo": pais})
        if destino_us and "US" not in lim: us.append(fila)
        if destino_de and "DE" not in lim: de.append(fila)
        if destino_fr and "FR" not in lim: fr.append(fila)   # incluidas las claves solo de Francia («France»)
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Kinguin: {len(filas)} productos válidos en España guardados")
if destino_latam:
    json.dump(latam, open(destino_latam, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Kinguin: {len(latam)} productos válidos en Latinoamérica guardados")
if destino_us:
    json.dump(us, open(destino_us, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Kinguin: {len(us)} productos válidos en Estados Unidos guardados")
if destino_de:
    json.dump(de, open(destino_de, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Kinguin: {len(de)} productos válidos en Alemania guardados")
if destino_fr:
    json.dump(fr, open(destino_fr, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Kinguin: {len(fr)} productos válidos en Francia guardados")
