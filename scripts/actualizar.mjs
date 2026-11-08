// Actualizador de precios de Pillao
// Uso: node scripts/actualizar.mjs        (Node 18 o superior, sin dependencias)
//
// Construye precios.json con un catálogo grande de juegos y sus precios reales en España:
//   - Steam: los más vendidos (STEAM_PAGINAS × 100 juegos), con precio y descuento.
//   - Nintendo eShop: los juegos más populares del catálogo (ESHOP_MAX), con precio de la eShop española.
//   - PlayStation Store: los juegos de config/seguimiento.json que tienen "psConcept".
//   - Instant Gaming: la clave más barata, con stock y válida en España, por plataforma (IG_MAX juegos).
//   - Microsoft Store: precio oficial de Xbox/PC (MS_MAX juegos de PC o Xbox).
//   - GAME: disco nuevo y seminuevo de los juegos de consola más populares (GAME_MAX).
//   - eBay (segunda mano): si existen EBAY_CLIENT_ID y EBAY_CLIENT_SECRET, busca anuncios de usados
//     para los juegos de consola más populares (EBAY_MAX).
//   - IsThereAnyDeal (opcional): más tiendas de PC si existe ITAD_KEY.
//   - config/seguimiento.json: juegos que quieres seguro, estén o no en las listas de arriba.
//   - Juegos añadidos desde la búsqueda en vivo (si existe BUSCADOR_URL).
//   - config/manual.json: ofertas que metes a mano.
// Si una fuente falla, se conservan sus ofertas anteriores para no dejar huecos.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV = process.env;
const STEAM_PAGINAS = +(ENV.STEAM_PAGINAS || 20);
const ESHOP_MAX = +(ENV.ESHOP_MAX || 2500);
const EBAY_MAX = +(ENV.EBAY_MAX || 150);
const GAME_MAX = +(ENV.GAME_MAX || 200);
const IG_MAX = +(ENV.IG_MAX || 250);
const MS_MAX = +(ENV.MS_MAX || 400);
// GAME: además de los GAME_MAX más populares, en cada ejecución revisa un bloque distinto del resto (GAME_ROTA juegos),
// así en un día y medio pasa por todo el catálogo de consola. Lo que no toca en una ejecución conserva su último precio.
const GAME_ROTA = +(ENV.GAME_ROTA || 400);
// Enlaces de afiliado (los enlaces de búsqueda de G2A e Instant Gaming están en config/tiendas.json)
const AFILIADO_IG = "gamer-681806";

const leer = async (ruta, porDefecto) => {
  try { return JSON.parse(await readFile(join(RAIZ, ruta), "utf8")); }
  catch (e) { if (porDefecto !== undefined) return porDefecto; throw new Error(`No pude leer ${ruta}: ${e.message}`); }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERAS = {
  "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)",
  "Accept-Language": "es-ES,es;q=0.9",
};
async function pedir(url, opciones = {}) {
  const r = await fetch(url, { ...opciones, headers: { ...CABECERAS, ...(opciones.headers || {}) } });
  if (!r.ok) {
    // El motivo que da el servidor (sin repetir la URL, que puede llevar claves)
    let motivo = ""; try { motivo = (await r.text()).replace(/\s+/g, " ").slice(0, 160); } catch {}
    throw new Error(`HTTP ${r.status} en ${new URL(url).host}${new URL(url).pathname}${motivo ? " → " + motivo : ""}`);
  }
  return r;
}
const html2txt = (s) => String(s).replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
const redondear = (n) => Math.round(n * 100) / 100;

// ---------- Títulos ----------
export const limpiar = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Clave para juntar el mismo juego de distintas tiendas
const SOBRANTE = /\b(nintendo switch 2 edition|nintendo switch 2|nintendo switch|switch 2|ps4 (y|and) ps5|ps5|ps4|edicion estandar|standard edition|edicion standard)\b/g;
export const clave = (titulo) => limpiar(titulo).replace(SOBRANTE, " ").replace(/\s+/g, " ").trim();
const tituloBonito = (t) => html2txt(t).replace(/[™®©]/g, "").replace(/\s*[–-]\s*Nintendo Switch 2 Edition$/i, "").replace(/\s+/g, " ").trim();
// Palabras que indican que NO es un juego completo
const EXTRAS = /\b(dlc|pack|pase|season pass|expansion|soundtrack|banda sonora|bundle|lote|monedas|coins|points|puntos|vbucks|upgrade|mejora|demo|trial|prueba|artbook|wallpaper|paquete|music|musica|costume|traje|skin|skins|cosmetico|ost)\b/;
function parecido(buscado, encontrado) {
  const a = limpiar(buscado), b = limpiar(encontrado);
  if (!a || !b) return 0;
  if (EXTRAS.test(b) && !EXTRAS.test(a)) return 0;
  if (a === b) return 1;
  const pa = new Set(a.split(" ")), pb = b.split(" ");
  if (pb.filter((p) => pa.has(p)).length < pa.size) return 0;
  return pa.size / pb.length;
}
const mejorCoincidencia = (titulo, lista, nombreDe, minimo = 0.5) => {
  let mejor = null, nota = minimo;
  for (const x of lista) { const n = parecido(titulo, nombreDe(x)); if (n > nota) { mejor = x; nota = n; } }
  return mejor;
};

// ---------- Catálogo en memoria ----------
const juegos = new Map(); // clave -> { id, titulo, plataformas:Set, pop, pvp, ofertas:[] }
function juego(titulo, { pop = 99999, prioridad = false } = {}) {
  const k = clave(titulo);
  if (!k) return null;
  let j = juegos.get(k);
  if (!j) { j = { id: k.replace(/ /g, "-").slice(0, 80), titulo: tituloBonito(titulo), plataformas: new Set(), revisado: new Set(), pop, pvp: 0, ofertas: [] }; juegos.set(k, j); }
  if (prioridad) j.titulo = tituloBonito(titulo);
  j.pop = Math.min(j.pop, pop);
  return j;
}
function ofertar(j, o) {
  if (!j || !(o.precio > 0)) return;
  // Una sola oferta por tienda + plataforma + estado: la más barata
  // (y por tipo de clave, para poder filtrar "solo claves de Steam" en Instant Gaming)
  const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && (x.estado || "nuevo") === (o.estado || "nuevo") && (x.drm || "") === (o.drm || ""));
  const nueva = { estado: "nuevo", stock: true, formato: "digital", ...o, precio: redondear(o.precio) };
  // Preferimos lo que hay en stock; a igualdad, lo más barato
  if (igual) { if ((nueva.stock && !igual.stock) || (nueva.stock === igual.stock && nueva.precio < igual.precio)) Object.assign(igual, nueva); }
  else j.ofertas.push(nueva);
  if (o.plataforma) j.plataformas.add(o.plataforma);
  if (o.regular > j.pvp) j.pvp = redondear(o.regular);
}

// ---------- Steam ----------
function leerFilasSteam(html) {
  const filas = [];
  for (const trozo of html.split('<a href="https://store.steampowered.com/').slice(1)) {
    const app = trozo.match(/^app\/(\d+)/);
    const titulo = trozo.match(/<span class="title">([^<]+)<\/span>/);
    const final = trozo.match(/data-price-final="(\d+)"/);
    if (!app || !titulo || !final || +final[1] === 0) continue;
    const dto = +(trozo.match(/data-discount="(\d+)"/)?.[1] || 0);
    const precio = +final[1] / 100;
    if (precio > 150) continue; // hardware (Steam Deck, mandos…), no juegos
    filas.push({ appid: app[1], titulo: html2txt(titulo[1]), precio, regular: dto ? precio / (1 - dto / 100) : precio });
  }
  return filas;
}
async function steamMasVendidos() {
  let puesto = 0;
  const filas = [];
  for (let p = 0; p < STEAM_PAGINAS; p++) {
    const url = `https://store.steampowered.com/search/results/?query&start=${p * 100}&count=100&filter=topsellers&cc=es&l=spanish&infinite=1`;
    const d = await (await pedir(url)).json();
    for (const f of leerFilasSteam(d.results_html || "")) {
      puesto++;
      if (!EXTRAS.test(limpiar(f.titulo))) filas.push({ ...f, puesto });
    }
    await esperar(800);
  }
  // El listado a veces enseña el precio de una mejora de pago de un juego gratuito (p. ej. Counter-Strike 2 «Prime»).
  // Confirmamos cada precio con la ficha oficial de Steam (100 juegos por consulta) y descartamos los gratuitos.
  const oficial = new Map();
  for (let i = 0; i < filas.length; i += 100) {
    const ids = filas.slice(i, i + 100).map((f) => f.appid).join(",");
    try {
      const d = await (await pedir(`https://store.steampowered.com/api/appdetails?appids=${ids}&cc=es&filters=price_overview`)).json();
      for (const [id, v] of Object.entries(d)) if (v?.success) oficial.set(id, v.data?.price_overview || null);
    } catch (e) { /* si falla, nos quedamos con el precio del listado */ }
    await esperar(1500);
  }
  let n = 0, gratis = 0;
  for (const f of filas) {
    let precio = f.precio, regular = f.regular;
    if (oficial.has(f.appid)) {
      const po = oficial.get(f.appid);
      if (!po || po.currency !== "EUR" || !(po.final > 0)) { gratis++; continue; } // gratuito o sin precio en euros
      precio = po.final / 100; regular = po.initial / 100;
    }
    ofertar(juego(f.titulo, { pop: f.puesto }), { tienda: "steam", plataforma: "PC", precio, regular, url: `https://store.steampowered.com/app/${f.appid}/`, fuente: "steam" });
    n++;
  }
  console.log(`Steam: ${n} juegos de pago, ${gratis} gratuitos descartados`);
  return n;
}
async function steamUno(j, extra) {
  if (j.ofertas.some((o) => o.tienda === "steam")) return 0;
  if (extra.steamAppId) {
    const d = await (await pedir(`https://store.steampowered.com/api/appdetails?appids=${extra.steamAppId}&cc=es&l=spanish&filters=price_overview`)).json();
    const p = d[extra.steamAppId]?.success && d[extra.steamAppId].data?.price_overview;
    if (!p || p.currency !== "EUR") return 0;
    ofertar(j, { tienda: "steam", plataforma: "PC", precio: p.final / 100, regular: p.initial / 100, url: `https://store.steampowered.com/app/${extra.steamAppId}/`, fuente: "steam" });
    return 1;
  }
  const d = await (await pedir(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(j.titulo)}&l=spanish&cc=ES`)).json();
  const item = mejorCoincidencia(j.titulo, (d.items || []).filter((i) => i.price?.currency === "EUR"), (i) => i.name);
  if (!item) return 0;
  ofertar(j, { tienda: "steam", plataforma: "PC", precio: item.price.final / 100, regular: item.price.initial / 100, url: `https://store.steampowered.com/app/${item.id}/`, fuente: "steam" });
  return 1;
}

// ---------- Nintendo eShop ----------
const esSwitch2 = (d) => /switch 2/i.test((d.system_names_txt || []).join(" ") + " " + (d.title || ""));
async function preciosEshop(nsuids) {
  const mapa = new Map();
  for (let i = 0; i < nsuids.length; i += 50) {
    const lote = nsuids.slice(i, i + 50).join(",");
    const d = await (await pedir(`https://api.ec.nintendo.com/v1/price?country=ES&lang=es&ids=${lote}`)).json();
    for (const p of d.prices || []) {
      if (p.sales_status !== "onsale" || p.regular_price?.currency !== "EUR") continue;
      const regular = parseFloat(p.regular_price.raw_value);
      const precio = parseFloat(p.discount_price?.raw_value ?? regular);
      if (isFinite(precio)) mapa.set(String(p.title_id), { precio, regular });
    }
    await esperar(300);
  }
  return mapa;
}
function ofertaEshop(doc, precios, opciones) {
  const p = precios.get(String(doc.nsuid_txt?.[0]));
  if (!p) return false;
  // La "Nintendo Switch 2 Edition" barata es solo el pack de mejora, no el juego
  if (/switch 2 edition/i.test(doc.title || "") && p.regular < 25) return false;
  if (EXTRAS.test(limpiar(doc.title))) return false;
  const j = juego(doc.title, opciones);
  ofertar(j, { tienda: "eshop", plataforma: esSwitch2(doc) ? "Switch 2" : "Switch", precio: p.precio, regular: p.regular, url: doc.url ? "https://www.nintendo.com" + doc.url : "https://www.nintendo.com/es-es/", fuente: "eshop" });
  return true;
}
async function eshopCatalogo() {
  const docs = [];
  for (let inicio = 0; inicio < ESHOP_MAX; inicio += 500) {
    const url = `https://searching.nintendo-europe.com/es/select?q=*&fq=type:GAME&fq=nsuid_txt:*&sort=popularity%20asc&rows=${Math.min(500, ESHOP_MAX - inicio)}&start=${inicio}&wt=json&fl=title,nsuid_txt,system_names_txt,url`;
    const d = await (await pedir(url)).json();
    docs.push(...(d.response?.docs || []));
    await esperar(300);
  }
  const precios = await preciosEshop(docs.map((d) => d.nsuid_txt[0]));
  let n = 0;
  docs.forEach((d, i) => { if (ofertaEshop(d, precios, { pop: i + 1 })) n++; });
  return n;
}
async function eshopUno(j) {
  if (![...j.plataformas, ...(j._buscarEn || [])].some((p) => p.startsWith("Switch")) || j.ofertas.some((o) => o.tienda === "eshop")) return 0;
  const url = `https://searching.nintendo-europe.com/es/select?q=${encodeURIComponent(j.titulo)}&fq=type:GAME&fq=nsuid_txt:*&rows=20&wt=json&fl=title,nsuid_txt,system_names_txt,url`;
  const docs = ((await (await pedir(url)).json()).response?.docs || []).filter((d) => parecido(j.titulo, String(d.title).replace(/[–-]\s*Nintendo Switch 2 Edition/i, "")) > 0.5);
  if (!docs.length) return 0;
  const precios = await preciosEshop(docs.map((d) => d.nsuid_txt[0]));
  let n = 0;
  for (const d of docs) if (precios.has(String(d.nsuid_txt[0]))) {
    const p = precios.get(String(d.nsuid_txt[0]));
    if (/switch 2 edition/i.test(d.title) && p.regular < 25) continue;
    ofertar(j, { tienda: "eshop", plataforma: esSwitch2(d) ? "Switch 2" : "Switch", precio: p.precio, regular: p.regular, url: d.url ? "https://www.nintendo.com" + d.url : "https://www.nintendo.com/es-es/", fuente: "eshop" });
    n++;
  }
  return n;
}

// ---------- PlayStation Store ----------
// La ficha de cada juego trae un bloque JSON-LD con el precio. "psConcept" es el número de
// store.playstation.com/es-es/concept/XXXX o un código de producto (EP0002-…); puede ser una lista.
async function psstore(j, extra) {
  const plat = (extra.plataformas || []).find((p) => p === "PS5" || p === "PS4");
  if (!plat || !extra.psConcept) return 0;
  let ultimoError = null;
  for (const id of [].concat(extra.psConcept)) {
    const url = `https://store.playstation.com/es-es/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
    let html;
    try { html = await (await pedir(url)).text(); } catch (e) { ultimoError = e.message; continue; }
    const m = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) { ultimoError = "la ficha no trae el bloque de precio"; continue; }
    let ld; try { ld = JSON.parse(m[1]); } catch { ultimoError = "bloque de precio ilegible"; continue; }
    const oferta = [].concat(ld.offers || [])[0];
    const palabras = limpiar(extra.titulo).split(" "), nombre = " " + limpiar(ld.name || "") + " ";
    if (!palabras.every((p) => nombre.includes(" " + p + " "))) { ultimoError = `la ficha ${id} es de «${ld.name}»`; continue; }
    if (!oferta || oferta.priceCurrency !== "EUR" || !(oferta.price > 0)) { ultimoError = "sin precio en euros"; continue; }
    ofertar(j, { tienda: "psstore", plataforma: plat, precio: Number(oferta.price), regular: Number(oferta.price), url, fuente: "psstore" });
    return 1;
  }
  throw new Error(ultimoError || "sin datos");
}

// ---------- eBay (segunda mano, API oficial) ----------
let tokenEbay = null;
async function ebayToken() {
  if (tokenEbay) return tokenEbay;
  const basic = Buffer.from(`${ENV.EBAY_CLIENT_ID}:${ENV.EBAY_CLIENT_SECRET}`).toString("base64");
  const r = await pedir("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
  });
  tokenEbay = (await r.json()).access_token;
  return tokenEbay;
}
const PLAT_EBAY = [["Switch 2", /switch 2/], ["Switch", /switch/], ["PS5", /ps5|playstation 5/], ["PS4", /ps4|playstation 4/], ["Xbox Series", /xbox series/]];
const NO_JUEGO = /\b(solo caja|caja vacia|sin juego|sin cartucho|sin disco|steelbook|funda|codigo|code|key|clave|dlc|figura|amiibo|poster|lote|pack|consola|mando)\b/;
async function ebay(j) {
  const consolas = [...j.plataformas].filter((p) => p !== "PC");
  if (!consolas.length) return 0;
  const token = await ebayToken();
  const filtro = "conditions:{USED},buyingOptions:{FIXED_PRICE},deliveryCountry:ES,priceCurrency:EUR,price:[2..150]";
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(j.titulo)}&filter=${encodeURIComponent(filtro)}&sort=price&limit=50`;
  const d = await (await pedir(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_ES", "Accept-Language": "es-ES" } })).json();
  let n = 0;
  for (const it of d.itemSummaries || []) {
    const t = limpiar(it.title);
    if (NO_JUEGO.test(t)) continue;
    const palabras = clave(j.titulo).split(" ");
    if (!palabras.every((p) => (" " + t + " ").includes(" " + p + " "))) continue;
    const plat = PLAT_EBAY.find(([, re]) => re.test(t))?.[0];
    if (!plat || !consolas.includes(plat)) continue;
    const precio = parseFloat(it.price?.value), envio = parseFloat(it.shippingOptions?.[0]?.shippingCost?.value || 0);
    if (!(precio > 0)) continue;
    const antes = j.ofertas.length;
    ofertar(j, { tienda: "ebay", plataforma: plat, formato: "fisico", estado: "usado", precio, envio: redondear(envio), condicion: it.condition || "Usado", url: it.itemWebUrl, fuente: "ebay" });
    if (j.ofertas.length > antes) n++;
  }
  return n;
}

// ---------- GAME (nuevo y seminuevo, en disco) ----------
// La página de resultados de game.es incluye los productos como datos estructurados (initialResult).
const PLAT_GAME = { "playstation 5": "PS5", "playstation 4": "PS4", "nintendo switch 2": "Switch 2", "nintendo switch": "Switch", "xbox series x": "Xbox Series", "xbox series": "Xbox Series" };
function bloqueJSON(texto, desde) {
  let i = texto.indexOf("{", desde), prof = 0, enCad = false;
  for (let k = i; k < texto.length; k++) {
    const c = texto[k];
    if (enCad) { if (c === "\\") k++; else if (c === '"') enCad = false; continue; }
    if (c === '"') enCad = true; else if (c === "{") prof++; else if (c === "}" && --prof === 0) return texto.slice(i, k + 1);
  }
  return null;
}
async function game(j) {
  // Si solo lo conocemos de PC (Steam), aceptamos cualquier consola que tenga GAME
  const consolas = [...j.plataformas].filter((p) => p !== "PC");
  const html = await (await pedir("https://www.game.es/resultados?search=" + encodeURIComponent(j.titulo))).text();
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return ""; } }).join("");
  const i = flight.indexOf('"initialResult":');
  if (i < 0) throw new Error("la página de resultados ya no trae datos (puede que GAME haya cambiado su web)");
  const items = JSON.parse(bloqueJSON(flight, i)).items || [];
  const palabras = clave(j.titulo).split(" ");
  let n = 0;
  for (const it of items) {
    if (it.category !== "SOFTWARE" || it.isPack) continue;
    const plat = PLAT_GAME[limpiar(it.allPlatforms || "")];
    if (!plat || (consolas.length && !consolas.includes(plat))) continue;
    const t = " " + limpiar(it.title) + " ";
    if (!palabras.every((p) => t.includes(" " + p + " ")) || EXTRAS.test(t)) continue;
    const precio = Number(it.pricing?.current);
    if (!(precio > 0)) continue;
    const usado = (it.tag || []).some((x) => /seminuevo/i.test(x?.text || ""));
    const antes = j.ofertas.length;
    ofertar(j, {
      tienda: usado ? "gameseminuevos" : "game", plataforma: plat, formato: "fisico", estado: usado ? "usado" : "nuevo",
      precio, regular: usado ? 0 : Number(it.pricing?.recommended) || precio, stock: it.availability === "available",
      url: "https://www.game.es" + it.url, fuente: "game",
    });
    if (j.ofertas.length > antes) n++;
  }
  return n;
}

// ---------- Microsoft Store (Xbox y PC) ----------
// Catálogo público oficial de Microsoft: búsqueda por nombre (autosuggest) + ficha con precio para España.
const sinEdicion = (t) => String(t).replace(/[:\-–]?\s*(edici[oó]n est[aá]ndar|standard edition)\s*$/i, "");
function plataformasMS(p) {
  const pk = JSON.stringify((p.DisplaySkuAvailabilities || []).map((s) => s.Sku?.Properties?.Packages || []));
  const out = [];
  if (/Windows\.Xbox/i.test(pk)) out.push("Xbox Series");
  if (/Windows\.Desktop/i.test(pk)) out.push("PC");
  return out;
}
async function microsoftStore(j) {
  const sug = await (await pedir(`https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=es-ES&productFamilyNames=Games&query=${encodeURIComponent(j.titulo)}`)).json();
  const candidatos = (sug.Results || []).flatMap((r) => r.Products || []).filter((p) => parecido(j.titulo, sinEdicion(p.Title)) > 0.5).slice(0, 5);
  if (!candidatos.length) return 0;
  const d = await (await pedir(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${candidatos.map((p) => p.ProductId).join(",")}&market=ES&languages=es-es`)).json();
  let n = 0;
  for (const p of d.Products || []) {
    const titulo = p.LocalizedProperties?.[0]?.ProductTitle || "";
    if (parecido(j.titulo, sinEdicion(titulo)) <= 0.5) continue;
    let mejor = null;
    for (const s of p.DisplaySkuAvailabilities || []) for (const a of s.Availabilities || []) {
      const pr = a.OrderManagementData?.Price;
      if (!pr || pr.CurrencyCode !== "EUR" || !(pr.ListPrice > 0) || !(a.Actions || []).includes("Purchase")) continue;
      if (!mejor || pr.ListPrice < mejor.ListPrice) mejor = pr;
    }
    if (!mejor) continue;
    for (const plat of plataformasMS(p)) {
      const antes = j.ofertas.length;
      ofertar(j, { tienda: "xbox", plataforma: plat, precio: mejor.ListPrice, regular: mejor.MSRP, url: `https://www.xbox.com/es-ES/games/store/p/${p.ProductId}`, fuente: "xbox" });
      if (j.ofertas.length > antes) n++;
    }
  }
  return n;
}

// ---------- Instant Gaming (claves) ----------
// La búsqueda de instant-gaming.com incluye los resultados como datos (window.searchResults).
// Por plataforma nos quedamos con la clave más barata que: tenga stock, no sea DLC y valga en España.
const PLAT_IG = { "pc": "PC", "playstation 5": "PS5", "playstation 4": "PS4", "xbox series x s": "Xbox Series", "xbox series x|s": "Xbox Series", "nintendo switch 2": "Switch 2", "nintendo switch": "Switch" };
const REGIONES_OK = /^(worldwide|global|europe|eu|emea|es|spain|espana|españa)$/i;
function valeEnEspana(h) {
  const bl = [].concat(h.country_blacklist || []).map(String);
  if (bl.some((c) => /^(es|spain|europe|eu)$/i.test(c))) return false;
  const wl = [].concat(h.country_whitelist || []).map(String);
  if (wl.length) return wl.some((c) => REGIONES_OK.test(c));
  return REGIONES_OK.test(String(h.region || "").trim());
}
async function instantGaming(j) {
  const html = await (await pedir("https://www.instant-gaming.com/es/busquedas/?query=" + encodeURIComponent(j.titulo))).text();
  const i = html.indexOf("window.searchResults = ");
  if (i < 0) throw new Error("la búsqueda ya no trae datos (puede que Instant Gaming haya cambiado su web)");
  const datos = JSON.parse(bloqueJSON(html, i));
  let n = 0;
  for (const h of datos.hits || []) {
    if (h.is_dlc || !h.has_stock || h.is_prepaid || h.is_subscription || h.preorder) continue;
    const precio = parseFloat(h.price_eur);
    if (!(precio > 0) || !valeEnEspana(h)) continue;
    if (parecido(j.titulo, h.name) <= 0.5) continue; // el juego base, no ediciones ni otros
    for (const nombre of h.platform_names || []) {
      const plat = PLAT_IG[limpiar(nombre)] || PLAT_IG[String(nombre).toLowerCase()];
      if (!plat) continue;
      const antes = j.ofertas.length;
      ofertar(j, {
        tienda: "instantgaming", plataforma: plat, precio, regular: parseFloat(h.default_retail) || undefined, drm: h.type || undefined,
        condicion: `Clave ${h.type || ""} · ${h.region_fulltext || h.region || "Worldwide"}`.replace(/\s+·/, " ·"),
        url: `https://www.instant-gaming.com/es/${h.prod_id}-comprar-${h.seo_name}/?igr=${AFILIADO_IG}`, fuente: "instantgaming",
      });
      if (j.ofertas.length > antes) n++;
    }
  }
  return n;
}

// ---------- IsThereAnyDeal (opcional) ----------
const ITAD = "https://api.isthereanydeal.com";
// Tiendas de PC que son de los propios fabricantes o plataformas (no revendedores)
const OFICIALES_PC = /^(gog|epic|microsoft|ea app|ea store|origin|ubisoft|battle\.net|blizzard|rockstar|bethesda|square enix|nintendo)/i;
const BUSQUEDA_PC = {
  "itad-gog": "https://www.gog.com/es/games?query={q}",
  "itad-epicgamestore": "https://store.epicgames.com/es-ES/browse?q={q}",
  "itad-fanatical": "https://www.fanatical.com/es/search?search={q}",
  "itad-humblestore": "https://www.humblebundle.com/store/search?search={q}",
  "itad-greenmangaming": "https://www.greenmangaming.com/es/search/?query={q}",
};
async function itad(lista, tiendas) {
  const key = encodeURIComponent(ENV.ITAD_KEY.trim());
  const json = { "Content-Type": "application/json" };
  // 1. IDs de ITAD por título, en bloques (una llamada para muchos juegos)
  const ids = {};
  for (let i = 0; i < lista.length; i += 200) {
    const trozo = lista.slice(i, i + 200);
    const r = await pedir(`${ITAD}/lookup/id/title/v1?key=${key}`, { method: "POST", headers: json, body: JSON.stringify(trozo.map((j) => j.titulo)) });
    const mapa = await r.json();
    for (const j of trozo) if (mapa[j.titulo]) ids[mapa[j.titulo]] = j;
    await esperar(300);
  }
  // 2. Precios actuales en España + mínimo histórico
  const claves = Object.keys(ids);
  let n = 0;
  for (let i = 0; i < claves.length; i += 200) {
    const r = await pedir(`${ITAD}/games/prices/v3?key=${key}&country=ES`, { method: "POST", headers: json, body: JSON.stringify(claves.slice(i, i + 200)) });
    for (const g of await r.json()) {
      const j = ids[g.id]; if (!j) continue;
      const min = g.historyLow?.all;
      if (min?.currency === "EUR" && min.amount > 0) j.minimo = redondear(min.amount);
      for (const x of g.deals || []) {
        if (x.price?.currency !== "EUR") continue;
        const nombre = x.shop?.name || x.shop?.title || String(x.shop?.id);
        // Solo tiendas oficiales: los revendedores de claves los cubre Instant Gaming
        if (!OFICIALES_PC.test(nombre)) continue;
        const id = "itad-" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (id === "itad-steam") continue;
        // Microsoft Store ya tiene su propia fuente: se guarda con el mismo nombre de tienda para no duplicarla
        if (id === "itad-microsoftstore") { ofertar(j, { tienda: "xbox", plataforma: "PC", precio: x.price.amount, regular: x.regular?.amount, url: x.url || undefined, fuente: "itad" }); n++; continue; }
        if (!tiendas.some((t) => t.id === id)) tiendas.push({ id, nombre, tipo: OFICIALES_PC.test(nombre) ? "oficial" : "revendedor", formatos: ["digital"], busqueda: BUSQUEDA_PC[id] });
        ofertar(j, { tienda: id, plataforma: "PC", precio: x.price.amount, regular: x.regular?.amount, url: x.url || undefined, fuente: "itad" });
        n++;
      }
    }
    await esperar(300);
  }
  return n;
}

// ---------- Programa ----------
async function main() {
  const tiendas = await leer("config/tiendas.json");
  const seguimiento = await leer("config/seguimiento.json", []);
  const manual = await leer("config/manual.json", []);
  const anterior = await leer("precios.json", { juegos: [] });
  const avisos = [], cuenta = {};
  const intentar = async (nombre, fn) => {
    try { const n = await fn(); cuenta[nombre] = (cuenta[nombre] || 0) + (n || 0); return true; }
    catch (e) { avisos.push(`${nombre}: ${e.message}`); return false; }
  };
  const caidas = new Set();

  // 1. Listas grandes
  if (!(await intentar("steam (más vendidos)", steamMasVendidos))) caidas.add("steam");
  if (!(await intentar("eshop (catálogo)", eshopCatalogo))) caidas.add("eshop");

  // 2. Juegos que quieres seguro + los añadidos desde la búsqueda en vivo
  let anadidos = [];
  const buscador = ENV.BUSCADOR_URL || (await leer("config/buscador.json", {})).url || "";
  if (buscador) {
    try { anadidos = await (await pedir(buscador.replace(/\/$/, "") + "/anadidos")).json(); }
    catch (e) { avisos.push(`búsqueda en vivo: ${e.message}`); }
  }
  const extras = [
    ...seguimiento.map((s) => ({ ...s, prioridad: true })),
    ...anadidos.filter((a) => a && a.titulo).map((a) => ({ titulo: String(a.titulo).slice(0, 120), plataformas: a.plataformas || [] })),
  ];
  for (const e of extras) {
    const j = juego(e.titulo, { prioridad: e.prioridad, pop: e.prioridad ? 50 : 99999 });
    if (!j) continue;
    if (e.pvp) j.pvp = Math.max(j.pvp, e.pvp);
    j._buscarEn = e.plataformas || [];
    (e.plataformas || []).forEach((p) => j.plataformas.add(p));
    if (!e.plataformas?.length || e.plataformas.includes("PC")) await intentar("steam", () => steamUno(j, e));
    await intentar("eshop", () => eshopUno(j));
    if (e.psConcept) { if (!(await intentar("psstore", () => psstore(j, e)))) caidas.add("psstore:" + j.id); }
    await esperar(300);
  }

  // 2b. PlayStation Store (lo descubre y actualiza scripts/playstation.mjs en su propia ejecución)
  const ps = await leer("data/playstation.json", { juegos: {} });
  let nPs = 0;
  for (const [id, e] of Object.entries(ps.juegos || {})) {
    if (!e.ofertas?.length) { const jx = [...juegos.values()].find((x) => x.id === id); if (jx && e.buscado) jx.revisado.add("psstore"); continue; }
    const j = [...juegos.values()].find((x) => x.id === id) || juego(e.titulo);
    for (const o of e.ofertas) { ofertar(j, o); nPs++; }
  }
  cuenta["psstore (catálogo)"] = nPs;

  // 3. GAME y eBay (disco nuevo y segunda mano) para los juegos de consola más populares
  const populares = (max) => [...juegos.values()].sort((a, b) => a.pop - b.pop).slice(0, max);
  const consolaPopulares = (max) => [...juegos.values()].filter((j) => [...j.plataformas].some((p) => p !== "PC")).sort((a, b) => a.pop - b.pop).slice(0, max);
  // Qué tiendas quedan comprobadas cuando una fuente revisa un juego (si no hay precio, es que no lo tienen)
  const REVISA = { game: ["game", "gameseminuevos"], xbox: ["xbox"], instantgaming: ["instantgaming"], ebay: [] };
  const recorrerFuente = async (nombre, lista, fn, pausa) => {
    let fallos = 0;
    for (const j of lista) {
      if (await intentar(nombre, () => fn(j))) (REVISA[nombre] || [nombre]).forEach((t) => j.revisado.add(t));
      else if (++fallos >= 5) { avisos.push(`${nombre}: demasiados fallos, paro`); caidas.add(nombre); break; }
      await esperar(pausa);
    }
  };
  const restoConsola = consolaPopulares(Infinity).slice(GAME_MAX);
  const trozos = Math.max(1, Math.ceil(restoConsola.length / GAME_ROTA));
  const turno = Math.floor(Date.now() / (6 * 3600 * 1000)) % trozos;
  const listaGame = [...new Set([...populares(GAME_MAX), ...restoConsola.slice(turno * GAME_ROTA, (turno + 1) * GAME_ROTA)])];
  const visitadosGame = new Set(listaGame.map((j) => j.id));
  console.log(`GAME: ${GAME_MAX} populares + bloque ${turno + 1} de ${trozos} (${listaGame.length} juegos en esta ejecución)`);
  await recorrerFuente("game", listaGame, game, 700);
  const paraMS = [...juegos.values()].filter((j) => j.plataformas.has("PC") || j.plataformas.has("Xbox Series") || j._buscarEn?.includes("Xbox Series")).sort((a, b) => a.pop - b.pop).slice(0, MS_MAX);
  await recorrerFuente("xbox", paraMS, microsoftStore, 300);
  await recorrerFuente("instantgaming", populares(IG_MAX), instantGaming, 900);
  if (ENV.EBAY_CLIENT_ID && ENV.EBAY_CLIENT_SECRET) await recorrerFuente("ebay", consolaPopulares(EBAY_MAX), ebay, 250);

  // 4. IsThereAnyDeal para los juegos de PC más populares
  if (ENV.ITAD_KEY) {
    const dePC = [...juegos.values()].filter((j) => j.plataformas.has("PC")).sort((a, b) => a.pop - b.pop).slice(0, +(ENV.ITAD_MAX || 3000));
    if (!(await intentar("itad", () => itad(dePC, tiendas)))) caidas.add("itad");
  }

  // 4b. Lo revisado en ejecuciones anteriores se conserva (GAME va rotando por bloques)
  const porId = new Map([...juegos.values()].map((j) => [j.id, j]));
  for (const viejo of anterior.juegos || []) { const j = porId.get(viejo.id); if (j) (viejo.revisado || []).forEach((t) => j.revisado.add(t)); }

  // 5. Si una fuente entera ha caído, recuperamos sus ofertas anteriores
  for (const viejo of anterior.juegos || []) {
    for (const o of viejo.ofertas || []) {
      const noVisitadoGame = o.fuente === "game" && !visitadosGame.has(viejo.id);
      if (!(caidas.has(o.fuente) || caidas.has(`${o.fuente}:${viejo.id}`) || noVisitadoGame)) continue;
      const j = juego(viejo.titulo, { pop: viejo.pop });
      ofertar(j, o);
    }
  }

  // 6. Ofertas manuales
  for (const m of manual) {
    const { juego: id, ...o } = m;
    const j = [...juegos.values()].find((x) => x.id === id) || juego(o.titulo || id);
    const usado = o.estado === "usado";
    ofertar(j, { formato: usado ? "fisico" : "digital", estado: usado ? "usado" : "nuevo", ...o, fuente: "manual" });
  }

  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map(({ _buscarEn, plataformas, revisado, ...j }) => ({ ...j, plataformas: [...plataformas], pvp: j.pvp || undefined, revisado: revisado.size ? [...revisado] : undefined }));
  const total = lista.reduce((s, j) => s + j.ofertas.length, 0);
  console.log("Ofertas por fuente:", JSON.stringify(cuenta));
  console.log("Primeros del catálogo:", lista.slice(0, 15).map((j) => j.titulo).join(" | "));
  if (avisos.length) console.warn(`Avisos (${avisos.length}):\n - ` + avisos.slice(0, 40).join("\n - "));
  if (total === 0) { console.error("No se ha conseguido ningún precio. No toco precios.json."); process.exit(1); }
  const salida = { actualizado: new Date().toISOString(), ejemplo: false, buscador: buscador || undefined, tiendas, juegos: lista };
  await writeFile(join(RAIZ, "precios.json"), JSON.stringify(salida) + "\n");
  console.log(`precios.json listo: ${lista.length} juegos, ${total} ofertas.`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
