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
import { guardarHistorial } from "./historial.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV = process.env;
const STEAM_PAGINAS = +(ENV.STEAM_PAGINAS || 20);   // los 2.000 más vendidos, siempre
const STEAM_ROTA = +(ENV.STEAM_ROTA || 10);         // + 1.000 más en cada ejecución, rotando…
const STEAM_MAX_PAGINAS = +(ENV.STEAM_MAX_PAGINAS || 150); // …hasta los 15.000 más vendidos
const ESHOP_ROTA = +(ENV.ESHOP_ROTA || 2500);       // eShop: además de los populares, un bloque nuevo cada vez
const IG_ROTA = +(ENV.IG_ROTA || 250);
const MS_ROTA = +(ENV.MS_ROTA || 300);
const CONSERVAR_DIAS = 7;                            // un precio no revisado en una ejecución se conserva hasta 7 días
const AHORA = new Date().toISOString().slice(0, 16);
const TURNO = Math.floor(Date.now() / (6 * 3600 * 1000)); // cambia en cada ejecución programada
// Qué juegos ha revisado cada fuente en esta ejecución (lo no revisado conserva su precio anterior)
const VISITAS = new Map();
const idDe = (titulo) => clave(titulo).replace(/ /g, "-").slice(0, 80);
function visitar(fuente, j) { if (!j) return; (VISITAS.get(fuente) || VISITAS.set(fuente, new Set()).get(fuente)).add(typeof j === "string" ? j : j.id); }
const ventana = (lista, tam) => { if (!lista.length) return []; const n = Math.ceil(lista.length / tam), k = TURNO % n; return lista.slice(k * tam, (k + 1) * tam); };
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
// Tipos de producto: juego, edición especial, DLC y tarjeta regalo (cada uno es su propia ficha)
const NO_PRODUCTO = /\b(soundtrack|banda sonora|ost|artbook|wallpaper|demo|trial|prueba|music|musica)\b/;
const DLC_RE = /\b(dlc|pack|pase|season pass|expansion|upgrade|mejora|monedas|coins|points|puntos|vbucks|costume|traje|skin|skins|cosmetico|paquete)\b/;
// Ediciones especiales: si buscamos el juego normal, no valen (cuestan más y confundirían la comparación)
const EDICIONES = /\b(deluxe|ultimate|gold|premium|collector|coleccionista|definitive|definitiva|goty|game of the year|complete edition|edicion completa|special edition|edicion especial|super deluxe|digital deluxe|vault)\b/;
const tipoDe = (titulo) => { const t = limpiar(titulo); return DLC_RE.test(t) ? "dlc" : EDICIONES.test(t) || /\b(bundle|lote|collection|coleccion|trilogy|trilogia)\b/.test(t) ? "edicion" : "juego"; };
function parecido(buscado, encontrado) {
  const a = limpiar(buscado), b = limpiar(encontrado);
  if (!a || !b) return 0;
  if (EXTRAS.test(b) && !EXTRAS.test(a)) return 0;
  if (EDICIONES.test(b) && !EDICIONES.test(a)) return 0;
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
function juego(titulo, { pop = 99999, prioridad = false, tipo } = {}) {
  const k = clave(titulo);
  if (!k) return null;
  let j = juegos.get(k);
  if (!j) { j = { id: k.replace(/ /g, "-").slice(0, 80), titulo: tituloBonito(titulo), tipo: tipo || tipoDe(titulo), plataformas: new Set(), revisado: new Set(), pop, pvp: 0, ofertas: [] }; juegos.set(k, j); }
  if (prioridad) j.titulo = tituloBonito(titulo);
  j.pop = Math.min(j.pop, pop);
  return j;
}
const PRECIO_MAX = 400; // ningún juego cuesta más; por encima son datos de relleno (p. ej. 99.999 €) o hardware
function ofertar(j, o) {
  if (!j || !(o.precio > 0) || o.precio > PRECIO_MAX) return;
  if (!(o.regular >= o.precio && o.regular <= PRECIO_MAX)) o = { ...o, regular: o.precio };
  // Una sola oferta por tienda + plataforma + estado: la más barata
  // (y por tipo de clave, para poder filtrar "solo claves de Steam" en Instant Gaming)
  const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && (x.estado || "nuevo") === (o.estado || "nuevo") && (x.drm || "") === (o.drm || ""));
  const nueva = { estado: "nuevo", stock: true, formato: "digital", ...o, precio: redondear(o.precio), t: o.t || AHORA };
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
  const paginas = [...Array(STEAM_PAGINAS).keys()];
  const resto = [...Array(Math.max(0, STEAM_MAX_PAGINAS - STEAM_PAGINAS)).keys()].map((i) => i + STEAM_PAGINAS);
  paginas.push(...ventana(resto, STEAM_ROTA));
  console.log(`Steam: páginas 1-${STEAM_PAGINAS} + ${paginas.slice(STEAM_PAGINAS)[0] + 1}-${paginas.slice(-1)[0] + 1} de ${STEAM_MAX_PAGINAS}`);
  for (const p of paginas) {
    const url = `https://store.steampowered.com/search/results/?query&start=${p * 100}&count=100&filter=topsellers&cc=es&l=spanish&infinite=1`;
    const d = await (await pedir(url)).json();
    for (const f of leerFilasSteam(d.results_html || "")) {
      puesto++;
      if (!NO_PRODUCTO.test(limpiar(f.titulo))) filas.push({ ...f, puesto });
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
    visitar("steam", idDe(f.titulo));
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
  const leerTramo = async (desde, hasta) => {
    let total = 0;
    for (let inicio = desde; inicio < hasta; inicio += 500) {
      const url = `https://searching.nintendo-europe.com/es/select?q=*&fq=type:GAME&fq=nsuid_txt:*&sort=popularity%20asc&rows=${Math.min(500, hasta - inicio)}&start=${inicio}&wt=json&fl=title,nsuid_txt,system_names_txt,url`;
      const d = await (await pedir(url)).json();
      total = d.response?.numFound || total;
      docs.push(...(d.response?.docs || []));
      await esperar(300);
    }
    return total;
  };
  const totalEshop = await leerTramo(0, ESHOP_MAX);
  const tramos = Math.max(1, Math.ceil((totalEshop - ESHOP_MAX) / ESHOP_ROTA));
  const desde = ESHOP_MAX + (TURNO % tramos) * ESHOP_ROTA;
  await leerTramo(desde, Math.min(totalEshop, desde + ESHOP_ROTA));
  console.log(`eShop: ${ESHOP_MAX} populares + ${desde}-${Math.min(totalEshop, desde + ESHOP_ROTA)} de ${totalEshop}`);
  const precios = await preciosEshop(docs.map((d) => d.nsuid_txt[0]));
  let n = 0;
  docs.forEach((d, i) => { visitar("eshop", idDe(d.title)); if (ofertaEshop(d, precios, { pop: i + 1 })) n++; });
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
    if (!palabras.every((p) => t.includes(" " + p + " ")) || EXTRAS.test(t) || (EDICIONES.test(t) && !EDICIONES.test(limpiar(j.titulo)))) continue;
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
    if (!h.has_stock || h.is_prepaid || h.is_subscription || h.preorder) continue;
    const precio = parseFloat(h.price_eur);
    if (!(precio > 0) || !valeEnEspana(h)) continue;
    let destino = null;
    if (!h.is_dlc && parecido(j.titulo, h.name) > 0.5) destino = j; // el mismo juego
    else {
      // Un DLC o una edición especial de este juego: tiene todas sus palabras → ficha propia
      const n = " " + limpiar(h.name) + " ";
      const deEste = clave(j.titulo).split(" ").every((p) => n.includes(" " + p + " "));
      const tipo = h.is_dlc ? "dlc" : tipoDe(h.name);
      if (deEste && tipo !== "juego" && !NO_PRODUCTO.test(n)) destino = juego(h.name, { pop: j.pop + 0.5, tipo });
    }
    if (!destino) continue;
    for (const nombre of h.platform_names || []) {
      const plat = PLAT_IG[limpiar(nombre)] || PLAT_IG[String(nombre).toLowerCase()];
      if (!plat) continue;
      const antes = destino.ofertas.length;
      ofertar(destino, {
        tienda: "instantgaming", plataforma: plat, precio, regular: parseFloat(h.default_retail) || undefined, drm: h.type || undefined,
        condicion: `Clave ${h.type || ""} · ${h.region_fulltext || h.region || "Worldwide"}`.replace(/\s+·/, " ·"),
        url: `https://www.instant-gaming.com/es/${h.prod_id}-comprar-${h.seo_name}/?igr=${AFILIADO_IG}`, fuente: "instantgaming",
      });
      if (destino.ofertas.length > antes) n++;
    }
  }
  return n;
}

// ---------- Tarjetas regalo, monedas de juegos y suscripciones ----------
// Fuentes: Instant Gaming (tarjetas, monedas como V-Bucks o Robux, suscripciones), GAME (tarjetas PlayStation y Nintendo)
// y la recarga oficial de Steam. Solo lo que vale en España; las tarjetas de saldo, solo con valor en euros.
const MARCAS_SALDO = [
  ["PlayStation", /playstation|psn/], ["Nintendo eShop", /nintendo/], ["Xbox", /xbox|microsoft/], ["Steam", /steam/],
  ["Amazon", /amazon/], ["Apple", /apple|itunes/], ["Google Play", /google play/], ["Spotify", /spotify/], ["Netflix", /netflix/],
];
const BUSQUEDAS_IG = ["nintendo eshop", "tarjeta playstation", "playstation plus", "tarjeta xbox", "xbox game pass", "steam tarjeta regalo",
  "v-bucks", "robux", "fc points", "call of duty puntos", "apex monedas", "overwatch monedas", "minecraft minecoins", "gta online tarjeta",
  "diablo platino", "ea play", "nintendo switch online", "valorant", "league of legends", "riot", "genshin", "pubg", "candy crush",
  "fallout 76 atomos", "elder scrolls online coronas", "guild wars gemas", "amazon", "google play", "apple", "spotify", "netflix", "tarjeta regalo"];
const valorEuros = (txt) => { const m = String(txt).match(/(\d+(?:[.,]\d+)?)\s*(€|eur\b|euros?\b)/i); return m ? parseFloat(m[1].replace(",", ".")) : 0; };
// Tarjeta de saldo de una tienda (p. ej. «Tarjeta regalo PlayStation 50 €»): una ficha por marca y valor
// En qué plataformas se usa el saldo de cada marca (para el filtro de plataformas de la web)
const PLATS_MARCA = { PlayStation: ["PS5", "PS4"], "Nintendo eShop": ["Switch 2", "Switch"], Xbox: ["Xbox Series"], Steam: ["PC"],
  Amazon: ["PC"], Apple: ["PC"], "Google Play": ["PC"], Spotify: ["PC"], Netflix: ["PC"] };
// Plataformas de un producto de Instant Gaming (las monedas de Xbox One valen en Series)
function platsIG(h) {
  const ps = new Set();
  for (const n of h.platform_names || []) {
    const l = limpiar(n);
    const p = PLAT_IG[l] || PLAT_IG[String(n).toLowerCase()] || (/xbox/.test(l) ? "Xbox Series" : /playstation 5/.test(l) ? "PS5" : /playstation 4/.test(l) ? "PS4" : /switch 2/.test(l) ? "Switch 2" : /switch/.test(l) ? "Switch" : /^(pc|mac|windows|geforce now)/.test(l) ? "PC" : null);
    if (p) ps.add(p);
  }
  return [...ps];
}
function fichaSaldo(marca, valor, pop) {
  const j = juego(`Tarjeta regalo ${marca} ${valor} €`, { pop, tipo: "tarjeta" });
  j._pvpFijo = true; j.pvp = valor; j.marca = marca; j.valor = valor;
  (PLATS_MARCA[marca] || []).forEach((p) => j.plataformas.add(p));
  return j;
}
// Recorre fichas de Instant Gaming siguiendo sus enlaces a otras versiones (importe y país) y se queda con las de España
async function tarjetasEspanaIG(semillas, marca, visitar, maxFichas = +(ENV.IG_TARJETAS_FICHAS || 120)) {
  const BASE = "https://www.instant-gaming.com/es/";
  const vistas = new Set(), cola = [...semillas], hechas = new Set();
  let n = 0, fichas = 0;
  const esCandidata = (slug) => /-espana$/.test(slug) || (!/-juego-/.test(slug) && /\d+eur/.test(slug));
  while (cola.length && fichas < maxFichas) {
    const ruta = cola.shift();
    const id = ruta.split("-")[0];
    if (vistas.has(id)) continue;
    vistas.add(id);
    let html;
    try { html = await (await pedir(BASE + ruta + "/")).text(); } catch { continue; }
    fichas++;
    await esperar(900);
    // Enlaces a otras versiones: seguimos las de España y las que no dicen país (se comprueba al abrirlas)
    for (const m of html.matchAll(/instant-gaming\.com\/es\/(\d+)-comprar-([a-z0-9-]+)\//g))
      if (!vistas.has(m[1]) && esCandidata(m[2])) cola.push(`${m[1]}-comprar-${m[2]}`);
    // ¿Es la versión de España? (país elegido en su selector)
    const elegidos = [...html.matchAll(/<option value="\d+"\s+selected[^>]*>\s*([^<]+?)\s*<\/option>/g)].map((x) => limpiar(x[1]));
    if (!/-espana$/.test(ruta) && !elegidos.includes("espana")) continue;
    if (hechas.has(id)) continue;
    hechas.add(id);
    const titulo = html2txt(((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).replace(/\s*\([^)]*\)\s*$/, "").trim();
    const precio = parseFloat((html.match(/itemprop="price"[^>]*data-price-eur="([\d.]+)"/) || [])[1]);
    if (!titulo || !(precio > 0)) continue;
    const stock = /itemprop="availability"[^>]*InStock/.test(html);
    const valor = valorEuros(titulo) || +((ruta.match(/-(\d+)eur-/) || [])[1] || 0), m = marca(titulo);
    const j = m && valor > 0 ? fichaSaldo(m, valor, 1500) : juego(titulo, { pop: 1600, tipo: "tarjeta" });
    if (m) (PLATS_MARCA[m] || []).forEach((p) => j.plataformas.add(p));
    visitar(j);
    const antes = parseFloat((html.match(/class="retail"[^>]*>\s*([\d.,]+)/) || [])[1]?.replace(",", "."));
    ofertar(j, { tienda: "instantgaming", plataforma: "Tarjeta regalo", precio, regular: m && valor > 0 ? valor : (antes > precio ? antes : undefined), stock,
      condicion: "Código digital · España", url: `${BASE}${ruta}/?igr=${AFILIADO_IG}`, fuente: "tarjetas" });
    n++;
  }
  console.log(`Instant Gaming, tarjetas de España: ${n} (de ${fichas} fichas revisadas)`);
  return n;
}

async function tarjetasRegalo(visitar) {
  let n = 0;
  const marca = (txt) => (MARCAS_SALDO.find(([, re]) => re.test(limpiar(txt))) || [])[0];
  // 1. Instant Gaming
  // La búsqueda solo devuelve una versión de cada tarjeta (muchas veces la de EE. UU.); la de España es otra ficha
  // a la que se llega desde el selector de país. Esas fichas «semilla» se recorren en el paso 1b.
  const semillas = new Map();
  for (const q of BUSQUEDAS_IG) {
    const html = await (await pedir("https://www.instant-gaming.com/es/busquedas/?query=" + encodeURIComponent(q))).text();
    const i = html.indexOf("window.searchResults = ");
    if (i >= 0) for (const h of JSON.parse(bloqueJSON(html, i)).hits || []) {
      if ((h.is_prepaid || h.is_subscription) && !valeEnEspana(h)) {
        const familia = limpiar(String(h.name).replace(/[\d$€£.,]+/g, " "));
        if (!semillas.has(familia)) semillas.set(familia, `${h.prod_id}-comprar-${h.seo_name}`);
      }
      if (!(h.is_prepaid || h.is_subscription) || !valeEnEspana(h)) continue;
      const precio = parseFloat(h.price_eur);
      if (!(precio > 0)) continue;
      const nombre = String(h.name).trim(), valor = valorEuros(nombre), m = marca(nombre);
      const esSaldo = m && valor > 0 && /(tarjeta|gift|card|wallet|recarga|prepago|codigo|saldo)/.test(limpiar(nombre));
      if (m && !valor && /(tarjeta|gift card)/.test(limpiar(nombre)) && !h.is_subscription) continue; // saldo de otra moneda (USD…)
      const j = esSaldo ? fichaSaldo(m, valor, 1500) : juego(nombre, { pop: 1600, tipo: "tarjeta" });
      visitar(j);
      // Monedas y suscripciones: una oferta por plataforma (las tarjetas tiburón de PC y de PlayStation no son la misma)
      const plats = esSaldo ? ["Tarjeta regalo"] : (platsIG(h).length ? platsIG(h) : (PLATS_MARCA[m] || ["Tarjeta regalo"]));
      if (!esSaldo && m) (PLATS_MARCA[m] || []).forEach((p) => j.plataformas.add(p));
      for (const plataforma of plats) ofertar(j, { tienda: "instantgaming", plataforma, precio,
        regular: esSaldo ? valor : (parseFloat(h.default_retail) || undefined), stock: !!h.has_stock,
        condicion: `${h.is_subscription ? "Suscripción" : "Código digital"} · ${h.region_fulltext || h.region || "Worldwide"}`,
        url: `https://www.instant-gaming.com/es/${h.prod_id}-comprar-${h.seo_name}/?igr=${AFILIADO_IG}`, fuente: "tarjetas" });
      n++;
    }
    await esperar(900);
  }
  // 1b. Instant Gaming: versiones de España de las tarjetas que la búsqueda solo enseña de otro país
  n += await tarjetasEspanaIG([...semillas.values()], marca, visitar);
  // 2. GAME (tarjetas PlayStation y códigos Nintendo eShop, a su precio oficial)
  for (const q of ["psn", "nintendo eshop", "prepago", "tarjeta regalo", "xbox prepago", "steam prepago"]) {
    const html = await (await pedir("https://www.game.es/resultados?search=" + encodeURIComponent(q))).text();
    const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((x) => { try { return JSON.parse('"' + x[1] + '"'); } catch { return ""; } }).join("");
    const k = flight.indexOf('"initialResult":');
    for (const it of k < 0 ? [] : JSON.parse(bloqueJSON(flight, k)).items || []) {
      if (!/PREPAGO|MONEDERO/i.test(`${it.brand} ${it.category2}`)) continue;
      const valor = valorEuros(it.title), m = marca(`${it.title} ${it.category}`), precio = Number(it.pricing?.current);
      if (!m || !(valor > 0) || !(precio > 0)) continue;
      const j = fichaSaldo(m, valor, 1500);
      visitar(j);
      ofertar(j, { tienda: "game", plataforma: "Tarjeta regalo", precio, regular: valor, stock: it.availability === "available", condicion: "Código digital", url: "https://www.game.es" + it.url, fuente: "tarjetas" });
      n++;
    }
    await esperar(900);
  }
  // 3. Recarga oficial de Steam: el saldo se añade a tu cuenta al mismo precio
  for (const valor of [5, 10, 25, 50, 100]) {
    const j = fichaSaldo("Steam", valor, 1500);
    visitar(j);
    ofertar(j, { tienda: "steam", plataforma: "Tarjeta regalo", precio: valor, regular: valor, condicion: "Recarga oficial en tu cuenta", url: "https://store.steampowered.com/steamaccount/addfunds", fuente: "tarjetas" });
    n++;
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
  // Prueba rápida: solo tarjetas regalo, sin tocar precios.json (PRUEBA_TARJETAS=1)
  if (ENV.PRUEBA_TARJETAS) {
    await tarjetasRegalo(() => {});
    for (const j of juegos.values()) console.log("TARJETA", j.titulo, "[" + [...j.plataformas].join(",") + "] |", j.ofertas.map((o) => `${o.tienda} ${o.plataforma} ${o.precio}${o.regular > o.precio ? " antes " + o.regular : ""}${o.stock ? "" : " (agotado)"}`).join(" ; "));
    return;
  }
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
    if (e.pvp) { j.pvp = e.pvp; j._pvpFijo = true; } // PVP indicado a mano en seguimiento.json
    j._buscarEn = e.plataformas || [];
    (e.plataformas || []).forEach((p) => j.plataformas.add(p));
    if (!e.plataformas?.length || e.plataformas.includes("PC")) if (await intentar("steam", () => steamUno(j, e))) visitar("steam", j);
    if (await intentar("eshop", () => eshopUno(j))) visitar("eshop", j);
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
  const consolaPopulares = (max) => [...juegos.values()].filter((j) => j.tipo !== "tarjeta" && [...j.plataformas].some((p) => p !== "PC")).sort((a, b) => a.pop - b.pop).slice(0, max);
  // Qué tiendas quedan comprobadas cuando una fuente revisa un juego (si no hay precio, es que no lo tienen)
  const REVISA = { game: ["game", "gameseminuevos"], xbox: ["xbox"], instantgaming: ["instantgaming"], ebay: [] };
  const recorrerFuente = async (nombre, lista, fn, pausa) => {
    let fallos = 0;
    for (const j of lista) {
      if (await intentar(nombre, () => fn(j))) { (REVISA[nombre] || [nombre]).forEach((t) => j.revisado.add(t)); visitar(nombre, j); }
      else if (++fallos >= 5) { avisos.push(`${nombre}: demasiados fallos, paro`); caidas.add(nombre); break; }
      await esperar(pausa);
    }
  };
  const restoConsola = consolaPopulares(Infinity).slice(GAME_MAX);
  const trozos = Math.max(1, Math.ceil(restoConsola.length / GAME_ROTA));
  const turno = Math.floor(Date.now() / (6 * 3600 * 1000)) % trozos;
  const listaGame = [...new Set([...populares(GAME_MAX), ...restoConsola.slice(turno * GAME_ROTA, (turno + 1) * GAME_ROTA)])];
  console.log(`GAME: ${GAME_MAX} populares + bloque ${turno + 1} de ${trozos} (${listaGame.length} juegos en esta ejecución)`);
  await recorrerFuente("game", listaGame, game, 700);
  const candidatosMS = [...juegos.values()].filter((j) => j.tipo !== "tarjeta" && (j.plataformas.has("PC") || j.plataformas.has("Xbox Series") || j._buscarEn?.includes("Xbox Series"))).sort((a, b) => a.pop - b.pop);
  await recorrerFuente("xbox", [...candidatosMS.slice(0, MS_MAX), ...ventana(candidatosMS.slice(MS_MAX), MS_ROTA)], microsoftStore, 300);
  const candidatosIG = [...juegos.values()].filter((j) => j.tipo !== "tarjeta").sort((a, b) => a.pop - b.pop);
  await recorrerFuente("instantgaming", [...candidatosIG.slice(0, IG_MAX), ...ventana(candidatosIG.slice(IG_MAX), IG_ROTA)], instantGaming, 900);
  if (!(await intentar("tarjetas regalo", () => tarjetasRegalo((j) => visitar("tarjetas", j))))) caidas.add("tarjetas");
  if (ENV.EBAY_CLIENT_ID && ENV.EBAY_CLIENT_SECRET) await recorrerFuente("ebay", consolaPopulares(EBAY_MAX), ebay, 250);

  // 4. IsThereAnyDeal para los juegos de PC más populares
  if (ENV.ITAD_KEY) {
    const dePC = [...juegos.values()].filter((j) => j.plataformas.has("PC")).sort((a, b) => a.pop - b.pop).slice(0, +(ENV.ITAD_MAX || 10000));
    if (!(await intentar("itad", () => itad(dePC, tiendas)))) caidas.add("itad");
    else dePC.forEach((j) => visitar("itad", j));
  }

  // 4b. Lo revisado en ejecuciones anteriores se conserva (GAME va rotando por bloques)
  const porId = new Map([...juegos.values()].map((j) => [j.id, j]));
  for (const viejo of anterior.juegos || []) { const j = porId.get(viejo.id); if (j) (viejo.revisado || []).forEach((t) => j.revisado.add(t)); }

  // 5. El catálogo se acumula: los precios que no se han revisado en esta ejecución (fuera de los bloques
  //    que tocaban, o porque una fuente ha fallado) se conservan hasta CONSERVAR_DIAS desde su última comprobación.
  const limite = Date.now() - CONSERVAR_DIAS * 86400000;
  let conservadas = 0;
  for (const viejo of anterior.juegos || []) {
    for (const o of viejo.ofertas || []) {
      if (o.fuente === "psstore" || o.fuente === "manual") continue;     // estas se recargan enteras en cada ejecución
      if (VISITAS.get(o.fuente)?.has(viejo.id)) continue;                // revisado ahora: manda lo nuevo
      if (Date.parse(o.t || anterior.actualizado) < limite) continue;    // demasiado antiguo
      const j = juego(viejo.titulo, { pop: viejo.pop, tipo: viejo.tipo });
      if (!j) continue;
      if (viejo.tipo === "tarjeta" && viejo.valor) { j._pvpFijo = true; j.pvp = viejo.valor; j.marca = viejo.marca; j.valor = viejo.valor; }
      if (viejo.minimo && !j.minimo) j.minimo = viejo.minimo;
      ofertar(j, o); conservadas++;
    }
  }
  console.log(`Precios conservados de ejecuciones anteriores: ${conservadas}`);

  // 6. Ofertas manuales
  for (const m of manual) {
    const { juego: id, ...o } = m;
    const j = [...juegos.values()].find((x) => x.id === id) || juego(o.titulo || id);
    const usado = o.estado === "usado";
    ofertar(j, { formato: usado ? "fisico" : "digital", estado: usado ? "usado" : "nuevo", ...o, fuente: "manual" });
  }

  // Productos que no son el juego (mejoras, DLC…): su precio NORMAL es muy inferior al del resto de tiendas.
  // Las rebajas reales conservan un precio normal alto, así que no se ven afectadas.
  // (PlayStation Store no da precio normal, solo el actual, así que no la juzgamos por esto.)
  let descartadas = 0;
  for (const j of juegos.values()) {
    const nuevas = j.ofertas.filter((o) => o.estado !== "usado" && o.tienda !== "psstore");
    if (nuevas.length < 2) continue;
    const reg = nuevas.map((o) => o.regular || o.precio).sort((a, b) => a - b);
    const mediana = reg[Math.floor((reg.length - 1) / 2)];
    const antes = j.ofertas.length;
    j.ofertas = j.ofertas.filter((o) => o.estado === "usado" || o.tienda === "psstore" || (o.regular || o.precio) >= mediana / 3);
    descartadas += antes - j.ofertas.length;
  }
  console.log(`Ofertas descartadas por no ser el juego (precio normal muy bajo): ${descartadas}`);

  // PVP: la mediana del precio sin descuento de las tiendas (el máximo se disparaba con ediciones de lujo)
  for (const j of juegos.values()) {
    if (j._pvpFijo) continue;
    const r = j.ofertas.filter((o) => o.estado !== "usado").map((o) => o.regular || o.precio).sort((a, b) => a - b);
    j.pvp = r.length ? redondear(r[Math.floor((r.length - 1) / 2)]) : 0;
  }

  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map(({ _buscarEn, _pvpFijo, plataformas, revisado, ...j }) => ({ ...j, plataformas: [...plataformas], pvp: j.pvp || undefined, revisado: revisado.size ? [...revisado] : undefined }));
  const total = lista.reduce((s, j) => s + j.ofertas.length, 0);
  console.log("Ofertas por fuente:", JSON.stringify(cuenta));
  console.log("Primeros del catálogo:", lista.slice(0, 15).map((j) => j.titulo).join(" | "));
  if (avisos.length) console.warn(`Avisos (${avisos.length}):\n - ` + avisos.slice(0, 40).join("\n - "));
  if (total === 0) { console.error("No se ha conseguido ningún precio. No toco precios.json."); process.exit(1); }
  const salida = { actualizado: new Date().toISOString(), ejemplo: false, buscador: buscador || undefined, tiendas, juegos: lista };
  await writeFile(join(RAIZ, "precios.json"), JSON.stringify(salida) + "\n");
  console.log(`precios.json listo: ${lista.length} juegos, ${total} ofertas.`);
  // Historial diario (gráfica de la web) y precios mínimos (avisos por email)
  try { await guardarHistorial(RAIZ, lista, tiendas); } catch (e) { console.warn("Historial: " + e.message); }
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
