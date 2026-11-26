// Junta en una sola ficha las tarjetas de saldo y los packs de monedas que cada tienda llama de una forma distinta
// («Tarjeta regalo PlayStation 60 €», «PlayStation Network EUR 60 Card», «Playstation Network 60 EUR»…;
// «Minecraft Minecoins 3500», «Minecraft: 3500 Minecoins», «Minecraft Minecoins Pack - 3500 Coins»…).
// Así cada ficha enseña todas las tiendas que lo venden, en vez de una tienda por ficha.
// Solo se juntan tarjetas que valen en el país de la región (o que no dicen país); las de otros países se quedan aparte.
const PAISES = { es: /\b(spain|españa|espana|es)\b/, de: /\b(germany|deutschland|de|austria|at)\b/, fr: /\b(france|fr)\b/, us: /\b(usa|us|united states|north america|na)\b/ };
const OTRO_PAIS = /\b(mena|latam|spain|españa|germany|deutschland|france|italy|italia|portugal|belgium|netherlands|austria|finland|ireland|greece|slovakia|slovenia|croatia|luxembourg|poland|uk|united kingdom|gb|usa|us|united states|canada|mexico|brazil|brasil|argentina|chile|colombia|peru|turkey|india|japan|korea|saudi|ksa|uae|kuwait|qatar|oman|bahrain|lebanon|israel|south africa|australia|nz|new zealand|sweden|norway|denmark|switzerland|czech|hungary|romania|bulgaria|russia|ukraine|hong kong|singapore|indonesia|malaysia|thailand|taiwan|china)\b/;
const MARCAS = [["psn", /\b(psn|playstation( network| store)?)\b/], ["xbox", /\bxbox\b/], ["eshop", /\b(nintendo|eshop)\b/], ["steam", /\bsteam\b/],
  ["googleplay", /\bgoogle play\b/], ["apple", /\b(apple|itunes)\b/], ["spotify", /\bspotify\b/], ["netflix", /\bnetflix\b/], ["roblox", /\broblox\b/],
  ["amazon", /\bamazon\b/], ["ea", /\b(ea|origin)\b/], ["riot", /\b(riot|league of legends)\b/], ["razer", /\brazer gold\b/], ["twitch", /\btwitch\b/],
  ["uber", /\buber\b/], ["blizzard", /\b(blizzard|battle net)\b/], ["paysafecard", /\bpaysafe ?card\b/], ["disney", /\bdisney\b/], ["zalando", /\bzalando\b/], ["ikea", /\bikea\b/], ["decathlon", /\bdecathlon\b/]];
const MONEDAS = [["minecoins", "mine ?coins?"], ["vbucks", "v-? ?bucks"], ["robux", "robux"], ["apexcoins", "apex coins"], ["valorantpoints", "valorant points"], ["overwatchcoins", "overwatch coins"]];
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&#8364;|€/g, " eur ").replace(/[^a-z0-9.]+/g, " ").trim();
function clave(j, region) {
  if (j.tipo === "skins" || j.sorpresa) return null;
  if (/\+/.test(j.titulo || "")) return null; // juego + monedas o packs combinados: es otro producto
  const t = norm(j.titulo || "");
  if (/\b(bundle|edition|edicion|deluxe|starter|pack de inicio|\+)\b/.test(t) && !/\bcoins? pack\b|\bminecoins pack\b/.test(t)) {
    if (/\b(edition|edicion|deluxe|bundle|starter)\b/.test(t)) return null; // juego + monedas: es otro producto
  }
  for (const [m, w] of MONEDAS) {
    const r = new RegExp("\\b(\\d[\\d,. ]*\\d|\\d+)\\s*(?:" + w + ")\\b|\\b(?:" + w + ")\\s*(?:pack\\s*)?(?:x\\s*)?(\\d[\\d,. ]*\\d|\\d+)\\b").exec(t);
    if (r) { const n = +(r[1] || r[2]).replace(/[^0-9]/g, ""); return n >= 50 ? `monedas:${m}:${n}` : null; }
    if (new RegExp("\\b(?:" + w + ")\\b").test(t)) return null;
  }
  if (j.tipo !== "tarjeta" && !/\b(card|tarjeta|gift|prepago|prepaid|voucher|credito|wallet)\b/.test(t)) return null;
  const marca = MARCAS.find(([, re]) => re.test(t));
  if (!marca || /\b(plus|essential|extra|premium|ultimate|game pass|online|membership|subscription|suscripcion|meses|months?|dias|days)\b/.test(t)) return null;
  const raw = (j.titulo || "").replace(/&#8364;/g, "€");
  if (/rewarble|\b(vc|virtual currency|points?|gems?|apples|dlc|pack)\b/i.test(raw)) return null;
  if (/£|HK\$|\b(GBP|BRL|MXN|TRY|INR|PLN|CAD|AUD|ARS|CLP|COP|PEN|JPY|KRW|WON|SAR|AED|CHF|SEK|NOK|DKK|CZK|HUF|RON|KWD|CNY|TWD|MYR|VND|UYU|QAR|PHP|HKD|IDR|THB|ZAR|NZD|SGD|BHD|OMR)\b|\((HK|KR|SA|UK|US|BR|MX|IN|TR)\)/i.test(raw)) return null;
  const moneda = /\$|\bUSD\b/i.test(raw) ? "usd" : /€|\b(EUR|EURO|euros?)\b/i.test(raw) ? "eur" : null;
  if (!moneda || (region === "us") !== (moneda === "usd")) return null;
  // Códigos de país en mayúsculas en el título («PSN PT Gift Card», «iTunes €10 IT Card»), salvo el de la región
  const cods = (raw.match(/\b(ES|PT|IT|HR|BE|NL|IE|GR|SK|SI|LU|PL|FI|AT|DE|FR|UK|GB|US|CY|MT|EE|LV|LT)\b/g) || []).filter((c) => c.toLowerCase() !== region);
  if (cods.length) return null;
  // El importe: el número pegado al símbolo o a la moneda («€25», «25 €», «EUR 25», «2,50 EUR»)
  const mi = raw.match(/(?:€|\$|\b(?:EUR|EURO|USD)\b)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|\$|\b(?:EUR|EURO|EUROS|USD)\b)/i);
  if (!mi) return null;
  const valor = +(mi[1] || mi[2]).replace(",", ".");
  if (!(valor > 0 && valor <= 500)) return null;
  const sinP = t.replace(PAISES[region] || /$^/, " ");
  if (OTRO_PAIS.test(sinP)) return null; // tarjeta de otro país: no vale aquí
  const ofs = (j.ofertas || []).map((o) => norm(o.condicion || "")).join(" ");
  if (OTRO_PAIS.test(ofs.replace(PAISES[region] || /$^/, " ").replace(/\b(europe|europa|eu|global)\b/g, " "))) return null;
  return `tarjeta:${marca[0]}:${moneda}:${valor}`;
}
// region: es, de, fr, us o latam (latam no junta tarjetas: cada país tiene las suyas)
export function unificar(juegos, region = "es") {
  const grupos = new Map();
  for (const j of juegos) {
    const k = clave(j, region);
    if (!k || (region === "latam" && k.startsWith("tarjeta:"))) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(j);
  }
  const fuera = new Set();
  let juntadas = 0;
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    // Se queda la ficha con nombre en español de las nuestras («tarjeta-regalo-…») o, si no, la más popular
    if (process.env.UNIFICAR_VER) console.log("JUNTA", lista.map((j) => j.titulo).join(" | "));
    lista.sort((a, b) => (/^(tarjeta|codigo|minecraft-minecoins-\d)/.test(b.id) - /^(tarjeta|codigo|minecraft-minecoins-\d)/.test(a.id)) || (a.pop ?? 99999) - (b.pop ?? 99999));
    const [base, ...resto] = lista;
    for (const j of resto) {
      const ya = new Set(base.ofertas.map((o) => o.tienda + "|" + o.url));
      for (const o of j.ofertas || []) if (!ya.has(o.tienda + "|" + o.url)) base.ofertas.push(o);
      base.plataformas = [...new Set([...(base.plataformas || []), ...(j.plataformas || [])])];
      if (Array.isArray(base.revisado) && Array.isArray(j.revisado)) base.revisado = [...new Set([...base.revisado, ...j.revisado])];
      if (!base.img && j.img) base.img = j.img;
      if ((j.pop ?? 99999) < (base.pop ?? 99999)) base.pop = j.pop;
      fuera.add(j); juntadas++;
    }
    if (base.tipo !== "tarjeta") base.tipo = "tarjeta";
  }
  return { juegos: juegos.filter((j) => !fuera.has(j)), juntadas };
}

// ---------- Juegos, DLC, ediciones y programas con el mismo nombre ----------
// Cada tienda añade su coletilla al final («EN», «CODE», «Xbox One / Xbox Series X|S», «(EU)», «PC Steam»…).
// Quitando SOLO esas coletillas del final (nunca del medio: «1-2-Switch» no es «1-2»), dos fichas con el mismo nombre son el mismo producto.
const COLA = new RegExp("(?:\\s|^)(?:en|eng|multi ?language|multilang|global|worldwide|eu|europe|row|ww|key|cd ?key|code|codigo|clave|digital|steam|pc|gog|epic games|epic|ea app|origin|ubisoft connect|uplay|rockstar|microsoft store|windows 10|windows|xbox one|xbox series x ?s|xbox series|xbox|ps4|ps5|playstation 4|playstation 5|nintendo switch 2|nintendo switch|switch 2|switch|mac|linux|download|dlc)$");
const base = (t) => {
  let s = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[®™©]/g, "").replace(/&amp;/g, "&").replace(/(\w)-(\w)/g, "$1$2").replace(/[^a-z0-9&]+/g, " ").trim();
  for (let i = 0; i < 8; i++) { const n = s.replace(COLA, "").trim(); if (n === s) break; s = n; }
  return s;
};
export function unificarNombres(juegos) {
  const grupos = new Map();
  for (const j of juegos) {
    if (!j.titulo || j.sorpresa || !["juego", "edicion", "dlc", "software", undefined].includes(j.tipo)) continue;
    const b = base(j.titulo);
    if (b.length < 4) continue;
    const k = (j.tipo || "juego") + "|" + b;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(j);
  }
  const fuera = new Set(); let juntadas = 0;
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    if (process.env.UNIFICAR_VER) console.log("NOMBRE", lista.map((j) => j.titulo).join(" | "));
    lista.sort((a, b) => (a.pop ?? 99999) - (b.pop ?? 99999) || b.ofertas.length - a.ofertas.length);
    const [b0, ...resto] = lista;
    for (const j of resto) {
      const ya = new Set(b0.ofertas.map((o) => o.tienda + "|" + o.url));
      for (const o of j.ofertas || []) if (!ya.has(o.tienda + "|" + o.url)) b0.ofertas.push(o);
      b0.plataformas = [...new Set([...(b0.plataformas || []), ...(j.plataformas || [])])];
      if (Array.isArray(b0.revisado) && Array.isArray(j.revisado)) b0.revisado = [...new Set([...b0.revisado, ...j.revisado])];
      for (const c of ["img", "cov", "lanzamiento", "pvp"]) if (b0[c] == null && j[c] != null) b0[c] = j[c];
      fuera.add(j); juntadas++;
    }
  }
  return { juegos: juegos.filter((j) => !fuera.has(j)), juntadas };
}
