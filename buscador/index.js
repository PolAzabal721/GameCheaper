// Buscador en vivo de Pillao (Cloudflare Worker)
//
// GET /buscar?q=texto  -> busca el juego AHORA en Steam, Nintendo eShop y eBay (si hay claves)
//                         y devuelve {juegos:[…]} con el mismo formato que precios.json.
//                         Los juegos encontrados se guardan para que el actualizador los siga.
// GET /anadidos        -> lista de juegos añadidos desde búsquedas (la usa el actualizador).
//
// Necesita un espacio KV enlazado como PILLAO. eBay es opcional (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET).

const CACHE_SEG = 3 * 3600;      // una misma búsqueda se reutiliza 3 horas
const MAX_JUEGOS = 8;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

const limpiar = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SOBRANTE = /\b(nintendo switch 2 edition|nintendo switch 2|nintendo switch|switch 2|ps4 (y|and) ps5|ps5|ps4|edicion estandar|standard edition|edicion standard)\b/g;
const clave = (t) => limpiar(t).replace(SOBRANTE, " ").replace(/\s+/g, " ").trim();
const bonito = (t) => String(t).replace(/[™®©]/g, "").replace(/\s*[–-]\s*Nintendo Switch 2 Edition$/i, "").replace(/\s+/g, " ").trim();
const EXTRAS = /\b(dlc|pack|pase|season pass|expansion|soundtrack|banda sonora|bundle|lote|monedas|coins|points|puntos|vbucks|upgrade|mejora|demo|trial|prueba|artbook|wallpaper|paquete|music|musica|costume|traje|skin|skins|cosmetico|ost)\b/;
const r2 = (n) => Math.round(n * 100) / 100;

function json(datos, estado = 200, extra = {}) {
  return new Response(JSON.stringify(datos), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra } });
}
async function pedir(url, opciones = {}) {
  const r = await fetch(url, { ...opciones, headers: { "User-Agent": "Pillao-buscador/1.0", "Accept-Language": "es-ES,es;q=0.9", ...(opciones.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).host}`);
  return r;
}

// Todas las palabras buscadas tienen que aparecer en el título
const EDICIONES = /\b(deluxe|ultimate|gold|premium|collector|coleccionista|definitive|definitiva|goty|game of the year|complete edition|edicion completa|special edition|edicion especial|super deluxe|digital deluxe|vault)\b/;
function encaja(q, titulo) {
  const t = " " + limpiar(titulo) + " ";
  if (EXTRAS.test(t) && !EXTRAS.test(limpiar(q))) return false;
  if (EDICIONES.test(t) && !EDICIONES.test(limpiar(q))) return false;
  return limpiar(q).split(" ").every((p) => t.includes(" " + p + " ") || (p.length >= 4 && t.includes(" " + p)));
}

class Resultado {
  constructor() { this.mapa = new Map(); this.tiendas = {}; }
  juego(titulo, relevancia) {
    const k = clave(titulo);
    let j = this.mapa.get(k);
    if (!j) { j = { id: k.replace(/ /g, "-").slice(0, 80), titulo: bonito(titulo), plataformas: [], pvp: 0, ofertas: [], _rel: relevancia }; this.mapa.set(k, j); }
    j._rel = Math.min(j._rel, relevancia);
    return j;
  }
  ofertar(j, o) {
    if (!(o.precio > 0)) return;
    const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && x.estado === o.estado);
    if (igual) { if (o.precio < igual.precio) Object.assign(igual, o); } else j.ofertas.push(o);
    if (!j.plataformas.includes(o.plataforma)) j.plataformas.push(o.plataforma);
    if (o.regular > j.pvp) j.pvp = r2(o.regular);
  }
  lista() {
    return [...this.mapa.values()].filter((j) => j.ofertas.length).sort((a, b) => a._rel - b._rel).slice(0, MAX_JUEGOS)
      .map(({ _rel, ...j }) => ({ ...j, pvp: j.pvp || undefined, ofertas: j.ofertas.map(({ regular, ...o }) => o) }));
  }
}

async function steam(q, res) {
  const d = await (await pedir(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=spanish&cc=ES`)).json();
  (d.items || []).forEach((it, i) => {
    if (it.price?.currency !== "EUR" || !encaja(q, it.name)) return;
    res.ofertar(res.juego(it.name, i), {
      tienda: "steam", plataforma: "PC", formato: "digital", estado: "nuevo", stock: true,
      precio: it.price.final / 100, regular: it.price.initial / 100, url: `https://store.steampowered.com/app/${it.id}/`,
    });
  });
}

async function eshop(q, res) {
  const url = `https://searching.nintendo-europe.com/es/select?q=${encodeURIComponent(q)}&fq=type:GAME&fq=nsuid_txt:*&rows=15&wt=json&fl=title,nsuid_txt,system_names_txt,url`;
  const docs = ((await (await pedir(url)).json()).response?.docs || []).filter((d) => encaja(q, d.title));
  if (!docs.length) return;
  const ids = docs.map((d) => d.nsuid_txt[0]).join(",");
  const precios = (await (await pedir(`https://api.ec.nintendo.com/v1/price?country=ES&lang=es&ids=${ids}`)).json()).prices || [];
  docs.forEach((d, i) => {
    const p = precios.find((x) => String(x.title_id) === String(d.nsuid_txt[0]));
    if (!p || p.sales_status !== "onsale" || p.regular_price?.currency !== "EUR") return;
    const regular = parseFloat(p.regular_price.raw_value), precio = parseFloat(p.discount_price?.raw_value ?? regular);
    if (/switch 2 edition/i.test(d.title) && regular < 25) return; // pack de mejora, no el juego
    const s2 = /switch 2/i.test((d.system_names_txt || []).join(" ") + " " + d.title);
    res.ofertar(res.juego(d.title, i), {
      tienda: "eshop", plataforma: s2 ? "Switch 2" : "Switch", formato: "digital", estado: "nuevo", stock: true,
      precio, regular, url: d.url ? "https://www.nintendo.com" + d.url : "https://www.nintendo.com/es-es/",
    });
  });
}

const PLAT_EBAY = [["Switch 2", /switch 2/], ["Switch", /switch/], ["PS5", /ps5|playstation 5/], ["PS4", /ps4|playstation 4/], ["Xbox Series", /xbox series/]];
const NO_JUEGO = /\b(solo caja|caja vacia|sin juego|sin cartucho|sin disco|steelbook|funda|codigo|code|key|clave|dlc|figura|amiibo|poster|lote|pack|consola|mando)\b/;
async function ebay(q, res, env) {
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return;
  const tok = await (await pedir("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
  })).json();
  const filtro = "conditions:{USED},buyingOptions:{FIXED_PRICE},deliveryCountry:ES,priceCurrency:EUR,price:[2..150]";
  const d = await (await pedir(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filtro)}&sort=price&limit=50`, {
    headers: { Authorization: `Bearer ${tok.access_token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_ES" },
  })).json();
  // Solo colgamos anuncios de eBay en juegos ya encontrados en tiendas oficiales
  const juegos = [...res.mapa.values()];
  for (const it of d.itemSummaries || []) {
    const t = " " + limpiar(it.title) + " ";
    if (NO_JUEGO.test(t)) continue;
    const plat = PLAT_EBAY.find(([, re]) => re.test(t))?.[0];
    if (!plat) continue;
    const j = juegos.find((x) => clave(x.titulo).split(" ").every((p) => t.includes(" " + p + " ")));
    if (!j) continue;
    const precio = parseFloat(it.price?.value), envio = parseFloat(it.shippingOptions?.[0]?.shippingCost?.value || 0);
    res.ofertar(j, { tienda: "ebay", plataforma: plat, formato: "fisico", estado: "usado", stock: true, precio, envio: r2(envio), condicion: it.condition || "Usado", url: it.itemWebUrl });
  }
}

// IsThereAnyDeal: tiendas oficiales de PC (Epic, GOG, Ubisoft, Blizzard, EA, Microsoft…).
// Busca los 2 mejores resultados de PC y, si no hay ninguno (exclusivos que no están en Steam), busca lo que escribiste.
const OFICIALES_PC = /^(gog|epic|microsoft|ea app|ea store|origin|ubisoft|battle\.net|blizzard|rockstar|bethesda|square enix)/i;
async function itad(q, res, env) {
  if (!env.ITAD_KEY) return;
  const key = encodeURIComponent(env.ITAD_KEY.trim());
  let dePC = [...res.mapa.values()].filter((j) => j.plataformas.includes("PC")).sort((a, b) => a._rel - b._rel).slice(0, 2).map((j) => ({ j, titulo: j.titulo }));
  if (!dePC.length) dePC = [{ j: null, titulo: q }];
  for (const c of dePC) {
    const l = await (await pedir(`https://api.isthereanydeal.com/games/lookup/v1?key=${key}&title=${encodeURIComponent(c.titulo)}`)).json();
    if (!l.found || !l.game?.id) continue;
    if (!c.j && !encaja(q, l.game.title || "")) continue;
    const j = c.j || res.juego(l.game.title, 0);
    const r = await (await pedir(`https://api.isthereanydeal.com/games/prices/v3?key=${key}&country=ES`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([l.game.id]),
    })).json();
    for (const x of r[0]?.deals || []) {
      const nombre = x.shop?.name || x.shop?.title || String(x.shop?.id);
      if (x.price?.currency !== "EUR" || !OFICIALES_PC.test(nombre) || /^steam$/i.test(nombre)) continue;
      // Microsoft Store es la misma tienda que la de su catálogo oficial
      const id = /^microsoft/i.test(nombre) ? "xbox" : "itad-" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
      res.ofertar(j, { tienda: id, plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: x.price.amount, regular: x.regular?.amount, url: x.url || undefined });
      if (id !== "xbox") res.tiendas[id] = { id, nombre, tipo: "oficial", formatos: ["digital"] };
    }
  }
}

async function buscar(q, env, ctx) {
  const res = new Resultado(), avisos = [];
  await Promise.all([steam(q, res), eshop(q, res)].map((p) => p.catch((e) => avisos.push(e.message))));
  await Promise.all([
    ebay(q, res, env).catch((e) => avisos.push("ebay: " + e.message)),
    itad(q, res, env).catch((e) => avisos.push("itad: " + e.message)),
  ]);
  const juegos = res.lista();
  // Guardamos el mejor resultado para que el actualizador lo siga a partir de ahora
  if (env.PILLAO) ctx.waitUntil(Promise.all(juegos.slice(0, 1).map((j) =>
    env.PILLAO.put("a:" + j.id, "", { metadata: { titulo: j.titulo, plataformas: j.plataformas }, expirationTtl: 90 * 86400 }))));
  return { q, actualizado: new Date().toISOString(), juegos, tiendas: Object.values(res.tiendas), avisos };
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === "/buscar") {
        const q = (url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 80);
        if (limpiar(q).length < 3) return json({ error: "Escribe al menos 3 letras." }, 400);
        const cacheKey = new Request(`${url.origin}/buscar?q=${encodeURIComponent(limpiar(q))}`);
        const cache = caches.default;
        const enCache = await cache.match(cacheKey);
        if (enCache) return enCache;
        const resp = json(await buscar(q, env, ctx), 200, { "Cache-Control": `public, max-age=${CACHE_SEG}` });
        ctx.waitUntil(cache.put(cacheKey, resp.clone()));
        return resp;
      }
      if (url.pathname === "/anadidos") {
        const salida = [];
        let cursor;
        do {
          const l = await env.PILLAO.list({ prefix: "a:", cursor, limit: 1000 });
          l.keys.forEach((k) => k.metadata && salida.push(k.metadata));
          cursor = l.list_complete ? null : l.cursor;
        } while (cursor && salida.length < 5000);
        return json(salida, 200, { "Cache-Control": "public, max-age=300" });
      }
      return json({ ok: true, uso: "/buscar?q=nombre del juego" });
    } catch (e) {
      return json({ error: "La búsqueda ha fallado: " + e.message }, 502);
    }
  },
};
