# Convierte el catálogo CSV de Kinguin (Admitad) en feeds/kinguin.json, solo con lo que vale en España.
# Fuera: cuentas (GAME_ACCOUNT y nombres con «Account»), regalos de Steam (Altergift / Gift) y claves bloqueadas en España.
import csv, json, re, sys, gzip
csv.field_size_limit(10**9)
origen, destino = sys.argv[1], sys.argv[2]
abrir = gzip.open if origen.endswith(".gz") else open
# Nada de apuestas, casinos ni webs de abrir cajas de skins (Pol no las quiere y en España su publicidad está muy limitada)
APUESTAS = re.compile(r"\b(casino|casinos|bet|bets|betting|apuestas|poker|slots?|lootbox|loot ?boxes|case ?opening|rainbet|csgoroll|csgoempire|csgofast|csgorun|csgowin|csgocasino|csgolombard|cscomps|csmarket|cs2land|csland|vscsgo|hypedrop|keydrop|key-drop|skinclub|clash\.gg|gamdom|stake|roobet|rollbit|duel|winna|rakebit|jemlit|gambagames|rustyloot|rustprofit|runehall|plunder|pirateswap|royale\.gg|empiredrop|forcedrop|ggdrop|diceblox|rorush|juice\.gg|paidskills|dotaboom|opduel|betterplayerwin|playersvipclub|spinarium|magic rust|bizzo|plg\.bet|upgrader|splits\.gg|tradeit|lootbox\.com|raided|datdrop|farmskins|hellcase|daddyskins|csgo500|bloodycase|g4skins)\b", re.I)
SALDO = re.compile(r"gift ?card|coins?\b|balance|wallet|voucher|gems\b|[$€£₺]|\b(usd|eur|gbp|pln|chf)\b", re.I)
# Cajas de skins (se abren con llave y dan algo al azar): fuera
CAJAS = re.compile(r"\b(case|cases|capsule|souvenir package|package|caja|cajas)\b", re.I)
filas = []
with abrir(origen, "rt", encoding="utf-8", errors="replace", newline="") as f:
    for x in csv.DictReader(f, delimiter=";"):
        c, n = x.get("categoryId", ""), x.get("name", "")
        if c in ("GAME_ACCOUNT", "GAME_ACCOUNT_PREPAID", "ALTERGIFT"): continue
        if re.search(r"\baccount\b|altergift|\bgift\b(?! card)", n, re.I): continue
        if APUESTAS.search(n) and SALDO.search(n): continue
        if c == "CSGO_SKINS" and CAJAS.search(n): continue
        if re.search(r"(^|,)ES(,|$)", x.get("country_limitations", "")): continue
        try: pr = float(x.get("price") or 0); op = float(x.get("oldprice") or 0)
        except ValueError: continue
        if pr <= 0: continue
        filas.append({"n": n, "c": c, "p": x.get("platform", ""), "r": x.get("region", ""), "pr": pr, "op": op, "u": re.sub(r"%3Fnosalesbooster%3D1%26currency%3DEUR$", "", x.get("url", "")), "s": x.get("steam_id", ""), "i": (x.get("picture") or x.get("image") or "").split(",")[0].strip()})
json.dump(filas, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Kinguin: {len(filas)} productos válidos en España guardados")
