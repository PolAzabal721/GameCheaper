// Actualizador de precios de Pillao
// Uso: node scripts/actualizar.mjs        (Node 18 o superior, sin dependencias)
//
// Construye precios.json con un catálogo grande de juegos y sus precios reales en España:
//   - Steam: los más vendidos (STEAM_PAGINAS × 100 juegos), con precio y descuento.
//   - Nintendo eShop: los juegos más populares del catálogo (ESHOP_MAX), con precio de la eShop española.
//   - PlayStation Store: los juegos de config/seguimiento.json que tienen "psConcept".
//   - Instant Gaming: claves válidas en España por plataforma, desde su mapa de productos (IG_MAX populares + IG_ROTA por turnos).
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
const IG_ROTA = +(ENV.IG_ROTA || 1200);  // …y un bloque nuevo del resto en cada ejecución (su mapa trae unos 17.000)
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
const EBAY_MAX = +(ENV.EBAY_MAX || 250);     // eBay: los juegos de consola más populares en cada ejecución…
const EBAY_ROTA = +(ENV.EBAY_ROTA || 450);   // …y un bloque nuevo del resto, rotando (eBay permite unas 5.000 consultas al día)
const GAME_MAX = +(ENV.GAME_MAX || 150);
const IG_MAX = +(ENV.IG_MAX || 1000);
const MS_MAX = +(ENV.MS_MAX || 400);
// GAME: además de los GAME_MAX más populares, en cada ejecución revisa un bloque distinto del resto (GAME_ROTA juegos),
// así en un día y medio pasa por todo el catálogo de consola. Lo que no toca en una ejecución conserva su último precio.
const GAME_ROTA = +(ENV.GAME_ROTA || 250);
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
// Packs de juegos activos (IsThereAnyDeal /bundles/v1). Los precios en dólares o libras se pasan a euros con el cambio del BCE.
async function packsITAD() {
  const key = encodeURIComponent(ENV.ITAD_KEY.trim());
  let cambio = { EUR: 1 };
  try {
    const xml = await (await pedir("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml")).text();
    for (const m of xml.matchAll(/currency='([A-Z]{3})' rate='([0-9.]+)'/g)) cambio[m[1]] = 1 / +m[2];
  } catch { cambio = { EUR: 1, USD: 0.86, GBP: 1.15 }; }
  const todos = [];
  for (let off = 0; off < 300; off += 50) {
    const r = await pedir(`https://api.isthereanydeal.com/bundles/v1?key=${key}&country=ES&limit=50&offset=${off}`);
    const lote = await r.json();
    if (!Array.isArray(lote)) break;
    todos.push(...lote);
    if (lote.length < 50) break;
  }
  const limpio = (t) => String(t || "").replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/g, "").replace(/\s+/g, " ").trim();
  const enEuros = (p) => (p && cambio[p.currency] ? Math.round(p.amount * cambio[p.currency] * 100) / 100 : null);
  return todos.filter((b) => !b.isMature && b.counts?.games > 0).map((b) => {
    const tiers = (b.tiers || []).map((t) => ({ precio: enEuros(t.price), aprox: t.price && t.price.currency !== "EUR" ? 1 : undefined,
      juegos: (t.games || []).filter((g) => !g.mature).map((g) => limpio(g.title)) }));
    const conPrecio = tiers.filter((t) => t.precio != null);
    const portadas = (b.tiers || []).flatMap((t) => t.games || []).filter((g) => !g.mature && g.assets?.banner400).slice(0, 3).map((g) => g.assets.banner400);
    return { id: b.id, titulo: limpio(b.title), tienda: b.page?.name || "", url: b.url, expira: b.expiry || undefined, juegos: b.counts.games,
      desde: conPrecio.length ? Math.min(...conPrecio.map((t) => t.precio)) : null, hasta: conPrecio.length ? Math.max(...conPrecio.map((t) => t.precio)) : null,
      aprox: conPrecio.some((t) => t.aprox) ? 1 : undefined, elige: conPrecio.length ? undefined : 1, tiers, portadas };
  });
}

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
// Para cruzar con los catálogos de las tiendas (mapas de productos): sin apóstrofos («Meier's» = «meiers» = «meier-s»)
const llave = (t) => clave(String(t).replace(/['’`´]/g, "").replace(/[™®©]/g, " ").replace(/\bedici[oó]n (deluxe|ultimate|gold|definitiva|completa|premium|especial|digital deluxe)\b/gi, "$1 edition")).replace(/\b([a-z0-9]+) s\b/g, "$1s").replace(/([a-z])(\d)/g, "$1 $2");
const tituloBonito = (t) => html2txt(t).replace(/[™®©]/g, "").replace(/\s*[–-]\s*Nintendo Switch 2 Edition$/i, "").replace(/\s+/g, " ").trim();
// Palabras que indican que NO es un juego completo
const EXTRAS = /\b(lite|dlc|pack|pase|season pass|expansion|soundtrack|banda sonora|bundle|lote|monedas|coins|points|puntos|vbucks|upgrade|mejora|demo|trial|prueba|artbook|wallpaper|paquete|music|musica|costume|traje|skin|skins|cosmetico|ost)\b/;
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
// ---------- Fechas de lanzamiento ----------
// Las de las tiendas oficiales (Steam, eShop, Microsoft Store) mandan; la de Instant Gaming solo si no hay otra.
// De varias fechas oficiales nos quedamos con la primera (el juego salió ese día, aunque luego llegara a otras consolas).
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
function fechaValida(f) { return /^\d{4}-\d{2}-\d{2}$/.test(f || "") && f >= "1980-01-01" && f <= "2035-12-31" ? f : null; }
function fechaSteam(txt) {
  const m = limpiar(txt).match(/^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/);
  return m && MESES[m[2]] ? fechaValida(`${m[3]}-${String(MESES[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`) : null;
}
function fechar(j, fecha, oficial = true) {
  fecha = fechaValida(fecha);
  if (!j || !fecha) return;
  const k = oficial ? "_fechaOf" : "_fechaIG";
  if (!j[k] || fecha < j[k]) j[k] = fecha;
}
const HOY = new Date().toISOString().slice(0, 10);

// ---------- Imágenes de cada juego (de las tiendas oficiales; no las guardamos, solo su dirección) ----------
// img: imagen horizontal (cuadrícula y móvil); cov: carátula vertical (vista de lista).
// Steam se guarda como «s:<número del juego>» y la web forma las direcciones (ocupa mucho menos).
// Prioridad: Steam > Microsoft Store > Nintendo eShop (de cada una, la primera que llegue).
const PRIO_IMG = { steam: 3, xbox: 2, eshop: 1 };
// Desde 2025 Steam sirve cada foto en su propia carpeta: store_item_assets/steam/apps/<id>/<carpeta>/<fichero>.
// La carpeta la da esta API (en lotes); las direcciones de siempre (apps/<id>/header.jpg) solo valen para los juegos antiguos.
const trozoSteam = (id, a) => {
  const m = String(a || "").match(/^([0-9a-f]{8,64})\/([\w.-]+)$/);
  return m ? `sc:${id}/${m[1]}/${m[2]}` : null;
};
async function fotosSteam(appids) {
  const fotos = new Map();
  for (let i = 0; i < appids.length; i += 50) {
    const lote = appids.slice(i, i + 50);
    const input = { ids: lote.map((a) => ({ appid: +a })), context: { language: "spanish", country_code: "ES" }, data_request: { include_assets: true } };
    try {
      const d = await (await pedir(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`)).json();
      for (const it of d.response?.store_items || []) {
        const a = it.assets || {}, id = String(it.appid || it.id || "");
        const img = trozoSteam(id, a.main_capsule) || trozoSteam(id, a.header);
        const cov = trozoSteam(id, a.library_capsule);
        if (img || cov) fotos.set(id, { img, cov });
      }
    } catch (e) { console.warn("Steam fotos: " + e.message.slice(0, 80)); }
    await esperar(800);
  }
  return fotos;
}

function ponerImagen(j, fuente, img, cov) {
  if (!j) return;
  const p = PRIO_IMG[fuente] || 0;
  if (img && (!j._img || p > j._imgP)) { j._img = img; j._imgP = p; }
  if (cov && (!j._cov || p > j._covP)) { j._cov = cov; j._covP = p; }
}

const FOTOS_STEAM_MAX = +(process.env.FOTOS_STEAM_MAX || 600); // fotos de Steam que se ponen al día por ejecución
const PRECIO_MAX = 400; // ningún juego cuesta más; por encima son datos de relleno (p. ej. 99.999 €) o hardware
function ofertar(j, o) {
  if (!j || !(o.precio > 0) || o.precio > PRECIO_MAX) return;
  if (!(o.regular >= o.precio && o.regular <= PRECIO_MAX)) o = { ...o, regular: o.precio };
  // Una sola oferta por tienda + plataforma + estado: la más barata
  // (y por tipo de clave, para poder filtrar "solo claves de Steam" en Instant Gaming)
  // (y en segunda mano de particulares, una por estado del artículo: como nuevo, muy bueno, bueno…)
  const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && (x.estado || "nuevo") === (o.estado || "nuevo") && (x.drm || "") === (o.drm || "") && (x.calidad || "") === (o.calidad || ""));
  const nueva = { estado: "nuevo", stock: true, formato: "digital", ...o, precio: redondear(o.precio), t: o.t || AHORA };
  // Preferimos lo que hay en stock; a igualdad, lo más barato
  const tot = (x) => x.precio + (x.envio || 0);
  if (igual) { if ((nueva.stock && !igual.stock) || (nueva.stock === igual.stock && tot(nueva) < tot(igual))) Object.assign(igual, nueva); }
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
    if (/^(steam (deck|controller|machine|frame|link)|valve index)/i.test(html2txt(titulo[1]))) continue;
    const fecha = fechaSteam((trozo.match(/search_released[^>]*>\s*([^<]*)</) || [])[1] || "");
    filas.push({ appid: app[1], titulo: html2txt(titulo[1]), precio, regular: dto ? precio / (1 - dto / 100) : precio, fecha });
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
  }  // Próximos lanzamientos populares: solo entran los que ya tienen precio (se pueden reservar)
  // Steam limita las peticiones seguidas (HTTP 429): esperamos antes y, si aun así nos frena, reintentamos más tarde
  for (const p of [0, 1]) {
    for (let intento = 1; intento <= 3; intento++) {
      await esperar(intento === 1 ? 10000 : 45000);
      try {
        const d = await (await pedir(`https://store.steampowered.com/search/results/?query&start=${p * 100}&count=100&filter=popularcomingsoon&cc=es&l=spanish&infinite=1`)).json();
        for (const f of leerFilasSteam(d.results_html || "")) if (!filas.some((x) => x.appid === f.appid)) filas.push({ ...f, puesto: 3000 + p * 100 + filas.length });
        break;
      } catch (e) { if (intento === 3) console.warn("Steam próximos lanzamientos: " + e.message.slice(0, 80)); }
    }
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
  const fotos = await fotosSteam([...new Set(filas.map((f) => f.appid))]);
  let n = 0, gratis = 0;
  for (const f of filas) {
    visitar("steam", idDe(f.titulo));
    let precio = f.precio, regular = f.regular;
    if (oficial.has(f.appid)) {
      const po = oficial.get(f.appid);
      if (!po || po.currency !== "EUR" || !(po.final > 0)) { gratis++; continue; } // gratuito o sin precio en euros
      precio = po.final / 100; regular = po.initial / 100;
    }
    const j = juego(f.titulo, { pop: f.puesto });
    ofertar(j, { tienda: "steam", plataforma: "PC", precio, regular, url: `https://store.steampowered.com/app/${f.appid}/`, fuente: "steam" });
    fechar(j, f.fecha);
    const ft = fotos.get(f.appid) || {};
    ponerImagen(j, "steam", ft.img || "s:" + f.appid, ft.cov || "s:" + f.appid);
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
    const ft1 = (await fotosSteam([String(extra.steamAppId)])).get(String(extra.steamAppId)) || {};
    ponerImagen(j, "steam", ft1.img || "s:" + extra.steamAppId, ft1.cov || "s:" + extra.steamAppId);
    return 1;
  }
  const d = await (await pedir(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(j.titulo)}&l=spanish&cc=ES`)).json();
  const item = mejorCoincidencia(j.titulo, (d.items || []).filter((i) => i.price?.currency === "EUR"), (i) => i.name);
  if (!item) return 0;
  ofertar(j, { tienda: "steam", plataforma: "PC", precio: item.price.final / 100, regular: item.price.initial / 100, url: `https://store.steampowered.com/app/${item.id}/`, fuente: "steam" });
  const ft2 = (await fotosSteam([String(item.id)])).get(String(item.id)) || {};
  ponerImagen(j, "steam", ft2.img || "s:" + item.id, ft2.cov || "s:" + item.id);
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
  fechar(j, String(doc.dates_released_dts?.[0] || "").slice(0, 10));
  const imgN = (u) => (u ? (u.startsWith("//") ? "https:" + u : u) : null);
  // Algunas fichas no traen la imagen apaisada ni la cuadrada: entonces, la general
  ponerImagen(j, "eshop", imgN(doc.image_url_h2x1_s) || imgN(doc.image_url), imgN(doc.image_url_sq_s) || imgN(doc.image_url));
  return true;
}
async function eshopCatalogo() {
  const docs = [];
  const leerTramo = async (desde, hasta) => {
    let total = 0;
    for (let inicio = desde; inicio < hasta; inicio += 500) {
      const url = `https://searching.nintendo-europe.com/es/select?q=*&fq=type:GAME&fq=nsuid_txt:*&sort=popularity%20asc&rows=${Math.min(500, hasta - inicio)}&start=${inicio}&wt=json&fl=title,nsuid_txt,system_names_txt,url,dates_released_dts,image_url_h2x1_s,image_url_sq_s,image_url`;
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
  const url = `https://searching.nintendo-europe.com/es/select?q=${encodeURIComponent(j.titulo)}&fq=type:GAME&fq=nsuid_txt:*&rows=20&wt=json&fl=title,nsuid_txt,system_names_txt,url,dates_released_dts,image_url_h2x1_s,image_url_sq_s,image_url`;
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
// Estado y país del anuncio en español (eBay lo da en el idioma del vendedor: «Sehr gut», «Good»…)
const ESTADOS_EBAY = { 2750: "Como nuevo", 3000: "Usado", 4000: "Muy bueno", 5000: "Bueno", 6000: "Aceptable" };
// Solo anuncios que se envían desde la Unión Europea: desde fuera (EE. UU., Japón, Reino Unido…) hay aduanas y envíos carísimos
const PAISES_EBAY = { ES: "", PT: "Portugal", FR: "Francia", DE: "Alemania", IT: "Italia", NL: "Países Bajos", BE: "Bélgica", LU: "Luxemburgo",
  AT: "Austria", IE: "Irlanda", DK: "Dinamarca", SE: "Suecia", FI: "Finlandia", PL: "Polonia", CZ: "Chequia", SK: "Eslovaquia", SI: "Eslovenia",
  HR: "Croacia", HU: "Hungría", RO: "Rumanía", BG: "Bulgaria", GR: "Grecia", CY: "Chipre", MT: "Malta", EE: "Estonia", LV: "Letonia", LT: "Lituania" };
const desdeUE = (it) => (it.itemLocation?.country || "ES") in PAISES_EBAY;
const calidadEbay = (it) => ESTADOS_EBAY[it.conditionId] || "Usado";
function estadoEbay(it) {
  const estado = ESTADOS_EBAY[it.conditionId] || "Usado";
  const pais = it.itemLocation?.country;
  const desde = pais && pais !== "ES" ? " · envío desde " + (PAISES_EBAY[pais] || pais) : "";
  return estado + desde;
}
const NO_JUEGO = /\b(solo caja|caja vacia|caja|portada|caratula|manual|sin juego|sin cartucho|sin disco|steelbook|funda|protector|codigo|code|key|clave|dlc|figura|amiibo|poster|lote|pack|consola|mando|moneda|coin|guia|guide|artbook|precinto|download|descarga|digital|voucher|bundle|card|tarjeta)\b/;
// Un anuncio de segunda mano por menos de una cuarta parte del juego nuevo más barato no suele ser el juego (caja, portada…)
function precioCreible(j, total) {
  const nuevos = j.ofertas.filter((o) => o.estado !== "usado" && o.formato === "fisico").map((o) => o.precio + (o.envio || 0));
  const ref = nuevos.length ? Math.min(...nuevos) : Math.min(...j.ofertas.filter((o) => o.estado !== "usado").map((o) => o.precio), Infinity);
  return !isFinite(ref) || total >= ref * 0.25;
}
async function ebay(j) {
  const consolas = [...j.plataformas].filter((p) => p !== "PC");
  if (!consolas.length) return 0;
  const token = await ebayToken();
  const filtro = "conditions:{USED},buyingOptions:{FIXED_PRICE},deliveryCountry:ES,priceCurrency:EUR,price:[4..150]";
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(j.titulo)}&filter=${encodeURIComponent(filtro)}&sort=price&limit=50`;
  const d = await (await pedir(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_ES", "Accept-Language": "es-ES" } })).json();
  let n = 0;
  for (const it of d.itemSummaries || []) {
    const t = limpiar(it.title);
    if (NO_JUEGO.test(t) || !desdeUE(it)) continue;
    const palabras = clave(j.titulo).split(" ");
    if (!palabras.every((p) => (" " + t + " ").includes(" " + p + " "))) continue;
    const plat = PLAT_EBAY.find(([, re]) => re.test(t))?.[0];
    if (!plat || !consolas.includes(plat)) continue;
    const precio = parseFloat(it.price?.value), envio = parseFloat(it.shippingOptions?.[0]?.shippingCost?.value || 0);
    if (!(precio > 0) || !precioCreible(j, precio + (envio || 0))) continue;
    const antes = j.ofertas.length;
    ofertar(j, { tienda: "ebay", plataforma: plat, formato: "fisico", estado: "usado", precio, envio: redondear(envio), condicion: estadoEbay(it), calidad: calidadEbay(it), url: it.itemWebUrl, fuente: "ebay" });
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
// GAME tiene vetado su buscador (/resultados) a programas en su robots.txt. Usamos lo que sí ofrece:
// su mapa de productos (sitemap_productos.xml), que dice qué juegos tiene y en qué consolas,
// y la ficha pública de cada producto, que trae el precio en un bloque JSON-LD.
const SUFIJOS_GAME = [["nintendo-switch-2", "Switch 2"], ["nintendo-switch", "Switch"], ["ps5", "PS5"], ["ps4", "PS4"], ["xbox-series-x", "Xbox Series"]];
const flightNext = (html) => [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return ""; } }).join("");
const TARJETAS_GAME = [];
async function mapaGame() {
  TARJETAS_GAME.length = 0;
  const xml = await (await pedir("https://www.game.es/sitemap/sitemap_productos.xml")).text();
  const mapa = new Map(); // clave del juego -> [{ url, plataforma, usado }]
  for (const m of xml.matchAll(/<loc>https:\/\/www\.game\.es\/([a-z0-9-]+)\/([a-z0-9]+)<\/loc>/g)) {
    let slug = m[1];
    // Tarjetas de saldo («tarjeta-regalo-playstation-20», «codigo-prepago-nintendo-eshop-15», «tarjeta-xbox-live-50»…)
    const tj = slug.match(/^(?:tarjeta|codigo)(?:-regalo|-prepago)?(?:-de)?-([a-z-]+?)-(\d+)$/);
    if (tj && !/mes|meses|suscripcion|pass|plus|ultimate|memoria/.test(tj[1])) { TARJETAS_GAME.push({ url: `https://www.game.es/${m[1]}/${m[2]}`, texto: tj[1].replace(/-/g, " "), valor: +tj[2] }); continue; }
    // Suscripciones: «tarjeta-microsoft-xbox-game-pass-ultimate-3-meses», «codigo-spotify-digital-1-mes»
    const sus = slug.match(/^(?:tarjeta|codigo)-(?:microsoft-)?(xbox-game-pass-(?:essential|premium|ultimate|core|pc)|spotify(?:-digital)?)-(\d+)-mes(?:es)?$/);
    if (sus) { TARJETAS_GAME.push({ url: `https://www.game.es/${m[1]}/${m[2]}`, texto: sus[1].replace(/-digital$/, "").replace(/-/g, " "), meses: +sus[2] }); continue; }
    if (/^(consola|pack|nintendo-switch|playstation|xbox-series|mando|tarjeta|codigo)/.test(slug)) continue; // consolas, packs y códigos
    const suf = SUFIJOS_GAME.find(([x]) => slug.endsWith("-" + x));
    if (suf) slug = slug.slice(0, -suf[0].length - 1);
    const usado = /-seminuev[oa](-|$)/.test(slug);
    slug = slug.replace(/-seminuev[oa](?=-|$)/g, "").replace(/-(nsw2|nintendo-switch-2)-edition$/, "").replace(/-day-one(-edition)?$/, "");
    const k = llave(slug.replace(/-/g, " ")).replace(/^ea sports (?=\S+ \S)/, "");
    if (!k || NO_PRODUCTO.test(k)) continue;
    (mapa.get(k) || mapa.set(k, []).get(k)).push({ url: `https://www.game.es/${m[1]}/${m[2]}`, plataforma: suf ? suf[1] : null, usado });
  }
  if (mapa.size < 500) throw new Error(`el mapa de productos de GAME trae muy pocos juegos (${mapa.size})`);
  return mapa;
}
async function fichaGame(url) {
  const html = await (await pedir(url)).text();
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).find((x) => x && x["@type"] === "Product");
  const of = [].concat(ld?.offers || [])[0];
  if (!of || of.priceCurrency !== "EUR" || !(Number(of.price) > 0)) return null;
  const fl = flightNext(html);
  const m = fl.match(/"platformName":"([^"]*)"[^{}]*?"price":([\d.]+),"recommendedPrice":("?[^,"]*)/);
  return {
    imagen: /^https:\/\/media\.game\.es\//.test([].concat(ld.image || [])[0] || "") ? [].concat(ld.image)[0] : null,
    nombre: html2txt(ld.name || ""), precio: Number(of.price), stock: /InStock|PreOrder/i.test(of.availability || ""),
    usado: /Used/i.test(of.itemCondition || ""), plataformaTxt: m ? m[1] : "", regular: m && /^[\d.]+$/.test(m[3]) ? Number(m[3]) : 0,
  };
}
// Nombre del juego a partir del de la ficha: «EA Sports FC 27 PS5», «Zelda - Seminuevo Nintendo Switch» → sin consola ni estado
const nombreGame = (t) => t.replace(/\s*-?\s*seminuev[oa]\b/i, "").replace(/\s+(PS5|PS4|Nintendo Switch 2|Nintendo Switch|Xbox Series X\|?S?|Xbox Series X|Xbox One|PC)\s*$/i, "").trim();
async function game(j, fichas) {
  let n = 0;
  for (const f of fichas) {
    const r = await fichaGame(f.url);
    await esperar(500);
    if (!r) continue;
    const plat = f.plataforma || PLAT_GAME[limpiar(r.plataformaTxt)];
    if (!plat) continue;
    if (!j) j = juego(nombreGame(r.nombre));
    if (!j) continue;
    if (r.imagen) ponerImagen(j, "game", null, r.imagen); // carátula de la caja (vertical)
    const usado = f.usado || r.usado, antes = j.ofertas.length;
    ofertar(j, {
      tienda: usado ? "gameseminuevos" : "game", plataforma: plat, formato: "fisico", estado: usado ? "usado" : "nuevo",
      precio: r.precio, regular: usado ? 0 : r.regular || r.precio, stock: r.stock, url: f.url, fuente: "game",
    });
    if (j.ofertas.length > antes) n++;
  }
  if (j) { j.revisado.add("game"); j.revisado.add("gameseminuevos"); visitar("game", j); }
  return n;
}

// ---------- Microsoft Store (Xbox y PC) ----------
// Catálogo público oficial de Microsoft: búsqueda por nombre (autosuggest) + ficha con precio para España.
// «EA SPORTS FC™ 27 Standard Edition para Xbox One y Xbox Series X|S» → «EA SPORTS FC™ 27»
const sinEdicion = (t) => String(t).replace(/[™®©]/g, " ").replace(/\s+para\s+(xbox|pc|windows)\b.*$/i, "").replace(/[:\-–]?\s*(edici[oó]n est[aá]ndar|standard edition)\s*$/i, "");
function plataformasMS(p) {
  const pk = JSON.stringify((p.DisplaySkuAvailabilities || []).map((s) => s.Sku?.Properties?.Packages || []));
  const out = [];
  if (/Windows\.Xbox/i.test(pk)) out.push("Xbox Series");
  if (/Windows\.Desktop/i.test(pk)) out.push("PC");
  if (out.length) return out;
  // Los lotes y ediciones que se venden como paquete no traen paquetes: la plataforma va en el nombre…
  const t = p.LocalizedProperties?.[0]?.ProductTitle || "";
  if (/xbox/i.test(t)) out.push("Xbox Series");
  if (/\b(pc|windows)\b/i.test(t)) out.push("PC");
  if (out.length) return out;
  // …o en las plataformas donde se puede comprar (si se compra en consola, contamos solo la consola)
  const pl = JSON.stringify(p.DisplaySkuAvailabilities || []);
  if (/Windows\.Xbox/i.test(pl)) return ["Xbox Series"];
  if (/Windows\.Desktop/i.test(pl)) return ["PC"];
  return out;
}
// Mapa de productos de xbox.com (sitemap, permitido): «/es-ES/games/store/<nombre>/<id>». Así encontramos el juego
// aunque en la tienda se llame «Borderlands® 4» o «Sid Meier’s Civilization® VII», y consultamos precios de 20 en 20.
async function mapaMS() {
  const { gunzipSync } = await import("node:zlib");
  const mapa = new Map(); // llave del juego -> [ids]
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`https://www.xbox.com/sitemap/pdp-es-ES-sitemap-${i}.xml.gz`, { headers: CABECERAS });
    if (r.status === 404) break;
    if (!r.ok) throw new Error(`HTTP ${r.status} en el mapa de productos de xbox.com`);
    const buf = Buffer.from(await r.arrayBuffer());
    let xml; try { xml = gunzipSync(buf).toString(); } catch { xml = buf.toString(); }
    for (const m of xml.matchAll(/\/es-ES\/games\/store\/([a-z0-9-]+)\/([0-9a-z]{12})</gi)) {
      const slug = m[1].replace(/^version-de-/, "").replace(/-(para-)?(xbox-one-y-xbox-series-xs|xbox-series-xs|xbox-one|pc|windows|windows-10|xbox)$/, "")
        .replace(/-(standard-edition|edicion-estandar)$/, "");
      const k = llave(slug.replace(/-/g, " ")).replace(/^ea sports (?=\S+ \S)/, "");
      if (!k) continue;
      const ids = mapa.get(k) || mapa.set(k, []).get(k);
      if (ids.length < 6) ids.push(m[2].toUpperCase());
    }
    await esperar(300);
  }
  if (mapa.size < 5000) throw new Error(`el mapa de productos de xbox.com trae muy pocos juegos (${mapa.size})`);
  return mapa;
}
async function productosMS(ids) {
  const d = await (await pedir(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids.join(",")}&market=ES&languages=es-es`)).json();
  return d.Products || [];
}
// Precios de los productos de Microsoft que son este juego
function preciosMS(j, productos) {
  // La versión «para Xbox One» solo si no hay otra (en Series se juega, pero suele ser otra edición)
  const soloOne = (p) => { const t = p.LocalizedProperties?.[0]?.ProductTitle || ""; return /xbox one/i.test(t) && !/series/i.test(t); };
  const n = preciosMS1(j, productos.filter((p) => !soloOne(p)));
  return n || preciosMS1(j, productos.filter(soloOne));
}
function preciosMS1(j, productos) {
  let n = 0;
  for (const p of productos) {
    const titulo = p.LocalizedProperties?.[0]?.ProductTitle || "";
    if (parecido(j.titulo, sinEdicion(titulo)) <= 0.5) continue;
    let mejor = null;
    for (const s of p.DisplaySkuAvailabilities || []) for (const a of s.Availabilities || []) {
      const pr = a.OrderManagementData?.Price;
      if (!pr || pr.CurrencyCode !== "EUR" || !(pr.ListPrice > 0) || !(a.Actions || []).includes("Purchase")) continue;
      if (!mejor || pr.ListPrice < mejor.ListPrice) mejor = pr;
    }
    if (!mejor) continue;
    fechar(j, String(p.MarketProperties?.[0]?.OriginalReleaseDate || "").slice(0, 10));
    const imgs = p.LocalizedProperties?.[0]?.Images || [], uri = (tipo) => { const i = imgs.find((x) => x.ImagePurpose === tipo); return i?.Uri ? "https:" + i.Uri.replace(/^https?:/, "") : null; };
    const h = uri("SuperHeroArt") || uri("TitledHeroArt"), v = uri("Poster") || uri("BoxArt");
    ponerImagen(j, "xbox", h && h + "?w=460", v && v + "?w=300");
    for (const plat of plataformasMS(p)) {
      const antes = j.ofertas.length;
      ofertar(j, { tienda: "xbox", plataforma: plat, precio: mejor.ListPrice, regular: mejor.MSRP, url: `https://www.xbox.com/es-ES/games/store/p/${p.ProductId}`, fuente: "xbox" });
      if (j.ofertas.length > antes) n++;
    }
  }
  return n;
}
// Para los juegos que no salen en el mapa: el buscador de Microsoft
async function microsoftStore(j) {
  // No encuentra «EA SPORTS FC 27» si en la tienda se llama «EA SPORTS FC™ 27»: si no sale nada, probamos quitando
  // palabras del final («EA SPORTS FC»), hasta tres veces; y con una sola palabra si es larga («Borderlands»)
  const palabras = j.titulo.replace(/[™®©]/g, "").split(/\s+/).filter(Boolean);
  let candidatos = [];
  for (let quitar = 0; quitar <= 3 && !candidatos.length; quitar++) {
    const q = palabras.slice(0, palabras.length - quitar).join(" ");
    if (quitar && (palabras.length - quitar < 1 || q.length < 6)) break;
    const sug = await (await pedir(`https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=es-ES&productFamilyNames=Games&query=${encodeURIComponent(q)}`)).json();
    candidatos = (sug.Results || []).flatMap((r) => r.Products || []).filter((p) => parecido(j.titulo, sinEdicion(p.Title)) > 0.5)
      .sort((a, b) => parecido(j.titulo, sinEdicion(b.Title)) - parecido(j.titulo, sinEdicion(a.Title))).slice(0, 5);
  }
  if (!candidatos.length) return 0;
  return preciosMS(j, await productosMS(candidatos.map((p) => p.ProductId)));
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
// Instant Gaming tiene vetado su buscador (/es/busquedas/) a programas en su robots.txt. Usamos lo que sí ofrece:
// su mapa de productos (sitemap_ig_products_es*.xml), con todos los productos y, en la dirección, la plataforma,
// la tienda de la clave y la región; y la ficha pública de cada producto, con el precio en euros y el stock.
const IG_DRM = [["steam", "Steam"], ["epic-games", "Epic Games"], ["ubisoft-connect", "Ubisoft Connect"], ["ea-app", "EA App"], ["origin", "EA App"],
  ["gog-com", "GOG"], ["gog", "GOG"], ["rockstar-games-launcher", "Rockstar"], ["rockstar", "Rockstar"], ["battle-net", "Battle.net"],
  ["microsoft-store", "Microsoft Store"], ["windows-store", "Microsoft Store"], ["playstation-store", "PlayStation Store"], ["nintendo-eshop", "Nintendo eShop"]];
// Regiones: las que valen en España y las que no (estas no se descargan)
const IG_REG_OK = ["europe", "espana", "worldwide", "global", "europa"];
const IG_REG_NO = ["estados-unidos", "reino-unido", "latam", "america-latina", "turquia", "argentina", "brasil", "india", "mexico", "canada", "australia",
  "japon", "rusia", "alemania", "francia", "italia", "polonia", "norteamerica", "north-america", "asia", "oriente-medio", "arabia-saudi", "emiratos-arabes-unidos",
  "sudafrica", "nueva-zelanda", "corea-del-sur", "china", "hong-kong", "suiza", "noruega", "suecia", "dinamarca", "paises-bajos", "belgica", "austria",
  "portugal", "irlanda", "usa", "uk", "us", "ue-sin-alemania", "finlandia", "grecia", "hungria", "republica-checa", "rumania", "eslovaquia", "croacia", "chile", "colombia", "peru", "indonesia", "tailandia", "filipinas", "malasia", "singapur", "taiwan", "israel", "ucrania"];
const IG_PLAT = [["xbox-series-x-s", "Xbox Series"], ["xbox-one", "Xbox Series"], ["playstation-5", "PS5"], ["playstation-4", "PS4"], ["ps5", "PS5"], ["ps4", "PS4"],
  ["nintendo-switch-2", "Switch 2"], ["switch-2", "Switch 2"], ["nintendo-switch", "Switch"], ["switch", "Switch"], ["pc", "PC"], ["mac", null], ["linux", null],
  ["juego", null], ["card", null]];
const IG_TARJETA = /(^|-)(tarjeta|gift-card|card|puntos|points|monedas|coins|v-bucks|robux|creditos|credits|gemas|gems|platino|atomos|lingotes|fichas|minecoins|uc|nc|suscripcion|game-pass|ps-plus|playstation-plus|ea-play|switch-online|meses|mes|dias|saldo|recarga)(-|$)/;
const termina = (w, frase) => { const f = frase.split("-"); return w.length > f.length && w.slice(-f.length).join("-") === frase ? f.length : 0; };
function leerSlugIG(slug) {
  let w = slug.split("-"), region = null, drm = null, n;
  for (const r of [...IG_REG_NO, ...IG_REG_OK]) if ((n = termina(w, r))) { region = r; w = w.slice(0, -n); break; }
  for (const [k, v] of IG_DRM) if ((n = termina(w, k))) { drm = v; w = w.slice(0, -n); break; }
  const plats = new Set();
  for (let otra = true; otra;) {
    otra = false;
    for (const [k, v] of IG_PLAT) if ((n = termina(w, k))) { if (v) plats.add(v); w = w.slice(0, -n); otra = true; break; }
  }
  return { nombre: w.join(" "), region, drm, plats: [...plats], vale: !IG_REG_NO.includes(region || "") };
}
let PRODUCTOS_IG = null;
async function mapaInstantGaming() {
  const productos = [];
  for (let i = 1; i <= 8; i++) {
    const r = await fetch(`https://www.instant-gaming.com/sitemap_ig_products_es${i > 1 ? "_" + i : ""}.xml`, { headers: CABECERAS });
    if (r.status === 404) break;
    if (!r.ok) throw new Error(`HTTP ${r.status} en el mapa de productos de Instant Gaming`);
    for (const m of (await r.text()).matchAll(/<loc>https:\/\/www\.instant-gaming\.com\/es\/(\d+)-comprar-([a-z0-9-]+)\/<\/loc>/g)) {
      const d = leerSlugIG(m[2]);
      if (!d.vale) continue;
      productos.push({ id: +m[1], url: `https://www.instant-gaming.com/es/${m[1]}-comprar-${m[2]}/`, tarjeta: IG_TARJETA.test(m[2]), ...d });
    }
    await esperar(500);
  }
  if (productos.length < 3000) throw new Error(`el mapa de productos de Instant Gaming trae muy pocos productos (${productos.length})`);
  PRODUCTOS_IG = productos;
  return productos;
}
// Ficha de un producto: nombre (con la región detrás de « - »), precio en euros y si hay stock
async function fichaIG(url) {
  const html = await (await pedir(url)).text();
  const m = html.match(/itemprop="price"[^>]*data-price-eur="([\d.]+)"/);
  if (!m) return null;
  const nombreCompleto = html2txt((html.match(/itemprop="name"\s+content="([^"]+)"/) || [])[1] || "");
  const [, nombre, region] = nombreCompleto.match(/^(.*?)(?:\s+-\s+([^-]+))?$/) || [, nombreCompleto, ""];
  return { nombre: nombre.trim(), region: (region || "").trim(), precio: Number(m[1]),
    stock: /schema\.org\/InStock/.test((html.match(/itemprop="availability"\s+content="([^"]+)"/) || [])[1] || "") };
}
const regionValeIG = (r) => !r || /(españa|espana|europe|europa|worldwide|global|\beu\b|emea)/i.test(r);
// Precio de un producto de Instant Gaming en una ficha del catálogo (o en una nueva si no la teníamos)
async function productoIG(j, p) {
  const f = await fichaIG(p.url);
  await esperar(600);
  if (!f || !(f.precio > 0) || !regionValeIG(f.region) || ES_CUENTA.test(f.nombre)) return { j, n: 0 };
  if (!j) {
    if (NO_PRODUCTO.test(limpiar(f.nombre))) return { j, n: 0 };
    j = juego(f.nombre, { pop: 99999, tipo: DLC_RE.test(limpiar(f.nombre)) ? "dlc" : tipoDe(f.nombre) });
    if (!j) return { j, n: 0 };
  }
  let n = 0;
  for (const plat of p.plats.length ? p.plats : ["PC"]) {
    const antes = j.ofertas.length;
    ofertar(j, { tienda: "instantgaming", plataforma: plat, precio: f.precio, drm: p.drm || undefined, stock: f.stock,
      condicion: `Clave ${p.drm || ""} · ${f.region || "Worldwide"}`.replace(/\s+·/, " ·"),
      url: `${p.url}?igr=${AFILIADO_IG}`, fuente: "instantgaming" });
    if (j.ofertas.length > antes) n++;
  }
  return { j, n };
}

// Cuentas (compartidas o «de primera mano»): van contra las condiciones de Steam, Sony y Microsoft y acaban en baneo.
// En Pillao solo entran claves y juegos en disco.
const ES_CUENTA = /\b(accounts?|cuentas?|shared|compartid[ao]s?|offline activation|activacion offline|primary|secondary|primaria|secundaria)\b/i;

// ---------- Kinguin (claves, su mapa de productos) ----------
// Su robots.txt deja leer las fichas pidiendo 2 segundos entre peticiones, y los precios salen en euros con ?currency=EUR.
// Como en Instant Gaming: los juegos más buscados en cada ejecución y un bloque rotatorio del resto.
const KIN_MAX = +(ENV.KIN_MAX || 150);
const KIN_ROTA = +(ENV.KIN_ROTA || 250);
const KIN_ESPERA = +(ENV.KIN_ESPERA || 2200);   // su robots pide 2 s
const KIN_MAPAS = +(ENV.KIN_MAPAS || 3);
// Lo que va detrás del título en sus direcciones: plataforma y «cd key»
const KIN_COLA = /\s*\b(pc|ps4|ps5|playstation( [45])?|xbox( (one|series( x\|s| x s)?|live|game pass))?|nintendo( switch)?|switch|steam|epic games?|ea app|origin|uplay|ubisoft connect|gog|battle ?net|rockstar( games)?|microsoft|windows( 10| 11)?|global|eu|europe|row|account|gift card|digital download|cd key|key|código|codigo)\b/gi;
const KIN_PLAT = { steam: "PC", "ea app": "PC", origin: "PC", uplay: "PC", "ubisoft connect": "PC", gog: "PC", "epic games": "PC", epic: "PC",
  "battle.net": "PC", battlenet: "PC", "rockstar games": "PC", rockstar: "PC", microsoft: "PC", windows: "PC", "xbox live": "Xbox Series", xbox: "Xbox Series" };
const kinRegionVale = (r) => !r || /(region free|global|worldwide|europe|european union|\beu\b|spain|españa|espana|emea)/i.test(r);

let PRODUCTOS_KIN = null;
async function mapaKinguin() {
  if (PRODUCTOS_KIN) return PRODUCTOS_KIN;
  const indice = await (await pedir("https://static.kinguin.net/media/sitemap/sitemap.xml")).text();
  const mapas = [...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /product_section_es_ES_\d+\.xml$/.test(u)).slice(0, KIN_MAPAS);
  const productos = [];
  for (const m of mapas) {
    const xml = await (await pedir(m)).text();
    for (const u of [...xml.matchAll(/<loc>(https:\/\/www\.kinguin\.net\/es\/category\/\d+\/[^<]+)<\/loc>/g)].map((x) => x[1])) {
      const slug = u.split("/").pop().replace(/-/g, " ");
      if (ES_CUENTA.test(slug)) continue;
      const titulo = slug.replace(KIN_COLA, " ").replace(/\s+/g, " ").trim();
      if (titulo.length < 3) continue;
      productos.push({ url: u, llave: llave(titulo) });
    }
    await esperar(1200);
  }
  if (productos.length < 5000) throw new Error(`el mapa de Kinguin trae muy pocos productos (${productos.length})`);
  PRODUCTOS_KIN = productos;
  return productos;
}
// Una ficha: precio en euros, plataforma, región y si hay stock
async function fichaKinguin(url) {
  const html = await (await pedir(url + "?currency=EUR")).text();
  const of = html.match(/"@type":"AggregateOffer","price":([0-9.]+),"priceCurrency":"([A-Z]+)"[^}]*?"availability":"([^"]+)"/);
  if (!of || of[2] !== "EUR") return null;
  const nombre = html2txt((html.match(/"@type":"Product","name":"([^"]+)"/) || [])[1] || "");
  const plat = (html.match(/"platform":\{"name":"([^"]+)"/) || [])[1] || "";
  const region = (html.match(/"region":\{"displayName":[^,]*,"name":"([^"]+)"/) || [])[1] || "";
  return { nombre, precio: Number(of[1]), stock: /InStock/.test(of[3]), plat, region };
}
async function kinguinUno(j, p) {
  const f = await fichaKinguin(p.url);
  await esperar(KIN_ESPERA);
  if (!f || !(f.precio > 0) || !kinRegionVale(f.region) || ES_CUENTA.test(f.nombre)) return 0;
  const plataforma = KIN_PLAT[f.plat.toLowerCase()] || (/xbox/i.test(f.plat) ? "Xbox Series" : /play ?station|psn/i.test(f.plat) ? null : "PC");
  if (!plataforma) return 0;   // las claves de PlayStation de reventa son de cuenta y de región: no las ponemos
  ofertar(j, { tienda: "kinguin", plataforma, precio: f.precio, stock: f.stock, drm: f.plat || undefined,
    condicion: `Clave ${f.plat || ""} · ${f.region || "Region free"}`.replace(/\s+·/, " ·"), url: p.url, fuente: "kinguin" });
  return 1;
}

// ---------- Driffle y K4G (mercados de claves; sus mapas de productos) ----------
// Las dos dejan leer las fichas en su robots.txt. Driffle da el precio en euros con ?currency=EUR (datos estructurados)
// y K4G lo lleva en euros (en céntimos) dentro de la página. Solo claves de Europa o globales, sin cuentas ni PlayStation.
const MK_MAX = +(ENV.MK_MAX || 100), MK_ROTA = +(ENV.MK_ROTA || 150), MK_ESPERA = +(ENV.MK_ESPERA || 1300);
const MK_REGION_OK = /^(europe|eu|global|worldwide|spain|emea)$/;
const MK_NUEVOS = +(ENV.MK_NUEVOS || 150);   // productos nuevos que se dan de alta por mercado y ejecución
// «age of empires ii definitive edition» → «Age of Empires II Definitive Edition»
const ROMANOS = /^(ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii|xiv|xv|xvi)$/;
const MENORES = /^(of|the|and|a|an|in|on|to|for|de|del|la|el|los|las|y)$/;
const nombreDeSlug = (t) => t.split(" ").map((w, i) => ROMANOS.test(w) ? w.toUpperCase() : (i && MENORES.test(w)) ? w : /^(dlc|vr|hd|rpg|fps|gta|ufc|nba|nfl|nhl|wwe|fc|f1|wrc|lego)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const MK_PC = /^(steam|ea-app|origin|uplay|ubisoft-connect|gog|epic-games|battle-net|rockstar|microsoft-store|windows)$/;
const quitarCola = (t) => t.replace(/\b(standard edition|edicion estandar)\b/gi, "").replace(/\s+/g, " ").trim();
// Driffle: «007-first-light-deluxe-edition-europe-pc-steam-digital-key-p9995900»
function leerDriffle(u) {
  const slug = (u.match(/driffle\.com\/([a-z0-9-]+)-p\d+$/) || [])[1];
  if (!slug || ES_CUENTA.test(slug.replace(/-/g, " "))) return null;
  const m = slug.match(/^(.*?)-(europe|eu|global|row|united-states|north-america|us|uk|united-kingdom|latam|asia|turkey|india|argentina|brazil|japan|middle-east|russia|cis|poland|germany|france|italy|spain|canada|australia|mexico|south-africa|emea)-(pc|xbox-series-xs|xbox-one|ps5|ps4|nintendo-switch|switch|mac|android|ios)(?:-([a-z-]+?))?-(digital-key|cd-key|key|gift-card|top-up|account)$/);
  if (!m || !MK_REGION_OK.test(m[2])) return null;
  let plat = null;
  if (m[3] === "pc" && (!m[4] || MK_PC.test(m[4]))) plat = "PC";
  else if (/^xbox/.test(m[3])) plat = "Xbox Series";
  else if (m[3] === "nintendo-switch" || m[3] === "switch") plat = "Switch";
  if (!plat || m[5] !== "digital-key" && m[5] !== "cd-key" && m[5] !== "key") return null;
  return { url: u, llave: llave(quitarCola(m[1].replace(/-/g, " "))), plat, region: m[2] };
}
// K4G: «age-of-empires-ii-steam-global-cd-key-definitive-edition-cd-key-3161EFB6», «alien-isolation-steam-global-cd-key-cd-key»,
// «…-nintendo-switch-europe-cd-key», «…-xbox-one-series-x-s-xbox-europe-cd-key», «a-way-out-ea-app-global-instant-multilanguage-cd-key-cd-key»…
const K4G_PLAT = [["nintendo-switch-2", "Switch 2", "Nintendo"], ["nintendo-switch", "Switch", "Nintendo"], ["xbox-one-series-x-s-xbox", "Xbox Series", "Xbox"],
  ["xbox-series-x-s", "Xbox Series", "Xbox"], ["xbox-live", "Xbox Series", "Xbox"], ["xbox-one", "Xbox Series", "Xbox"],
  ["ubisoft-connect", "PC", "Ubisoft Connect"], ["epic-games", "PC", "Epic Games"], ["battle-net", "PC", "Battle.net"], ["rockstar-games", "PC", "Rockstar"],
  ["microsoft-store", "PC", "Microsoft Store"], ["ea-app", "PC", "EA App"], ["origin", "PC", "EA App"], ["uplay", "PC", "Ubisoft Connect"], ["steam", "PC", "Steam"], ["gog", "PC", "GOG"]];
function leerK4G(u) {
  const slug = (u.match(/k4g\.com\/product\/([a-z0-9-]+)-[A-F0-9]{8}$/) || [])[1];
  if (!slug || !/-cd-key$/.test(slug)) return null;                       // solo claves (fuera «gift», cuentas y tarjetas)
  if (/\b(account|altergift|alter-gift|gift-card|top-up|-gift-)/.test(slug) || ES_CUENTA.test(slug.replace(/-/g, " "))) return null;
  for (const [tok, plat, drm] of K4G_PLAT) {
    const m = slug.match(new RegExp(`^(.+?)-${tok}-(europe|eu|global|worldwide|spain|emea)(?:-instant)?(?:-(.*?))?-cd-key(?:-cd-key)?$`));
    if (!m) continue;
    // Lo que va entre la región y «cd-key»: la edición («definitive-edition», «standard-edition-cd-key»…)
    const resto = (m[3] || "").replace(/^cd-key-?/, "").replace(/-?cd-key$/, "").replace(/\b(multilanguage|instant)\b-?/g, "").replace(/^-|-$/g, "");
    const edicion = /edition|bundle|pack|collection|season-pass/.test(resto) && !/^standard-edition$/.test(resto) ? " " + resto.replace(/-/g, " ") : "";
    return { url: u, llave: llave(quitarCola((m[1] + edicion).replace(/-/g, " "))), plat, region: m[2], drm };
  }
  return null;
}
const MERCADOS = {
  driffle: {
    nombre: "Driffle", mapa: "https://driffle.com/sitemap.xml", submapas: (us) => us.filter((u) => /products-sitemap-\d+\.xml$/.test(u)), porRonda: +(ENV.DRIFFLE_MAPAS || 45),
    leer: leerDriffle,
    async ficha(p) {
      const h = await (await pedir(p.url + "?currency=EUR")).text();
      const m = h.match(/"price"\s*:\s*"?([0-9.]+)"?\s*,\s*"priceCurrency"\s*:\s*"EUR"/) || h.match(/"priceCurrency"\s*:\s*"EUR"\s*,\s*"price"\s*:\s*"?([0-9.]+)/);
      if (!m) return null;
      // Su nombre: «007 First Light - Deluxe Edition (Europe) (PC) - Steam - Digital Key» → «007 First Light - Deluxe Edition»
      const h1 = html2txt((h.match(/<h1[^>]*>([\s\S]{1,200}?)<\/h1>/) || [])[1] || "").replace(/\s*\((europe|eu|global|row|worldwide|emea|spain)\)[\s\S]*$/i, "").trim();
      return { precio: Number(m[1]), stock: !/OutOfStock/.test(h.slice(0, 200000)), nombre: h1 || null };
    },
  },
  k4g: {
    nombre: "K4G", mapa: "https://cdn.k4g.com/files/sitemap/sitemap.xml", submapas: (us) => us.filter((u) => /\d+-products\.xml$/.test(u)), porRonda: +(ENV.K4G_MAPAS || 200),
    leer: leerK4G,
    async ficha(p) {
      const h = await (await pedir(p.url)).text();
      const m = h.match(/"price"\s*:\s*\{\s*"EUR"\s*:\s*(\d+)/);
      if (!m) return null;
      return { precio: Number(m[1]) / 100, stock: true };
    },
  },
};
// Sus mapas de productos son enormes (Driffle tiene cientos de ficheros), así que en cada ejecución se leen unos cuantos
// por turnos y lo que coincide con nuestro catálogo se guarda en data/mercados.json: en unos días están leídos todos.
const CACHE_MERCADOS = join(RAIZ, "data", "mercados.json");
let cacheMercados = null;
async function mapaMercado(id, llavesCatalogo) {
  const t = MERCADOS[id];
  if (!cacheMercados) { try { cacheMercados = JSON.parse(await readFile(CACHE_MERCADOS, "utf8")); } catch { cacheMercados = {}; } }
  const c = cacheMercados[id] || (cacheMercados[id] = { leidos: {}, productos: {} });
  const indice = [...(await (await pedir(t.mapa)).text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  const todos = t.submapas(indice);
  // Primero los que nunca se han leído, luego los más antiguos
  const ronda = [...todos].sort((a, b) => (c.leidos[a] || "").localeCompare(c.leidos[b] || "")).slice(0, t.porRonda);
  let nuevos = 0;
  const fuera = new Map();
  for (const sm of ronda) {
    try {
      for (const u of [...(await (await pedir(sm)).text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])) {
        const p = t.leer(u);
        if (!p) continue;
        // Lo que aún no está en el catálogo se apunta para darlo de alta (unos cuantos por ejecución)
        if (!llavesCatalogo.has(p.llave)) { if (!NO_PRODUCTO.test(p.llave)) fuera.set(p.llave + "|" + p.plat, p); continue; }
        const k = p.llave + "|" + p.plat;
        if (!c.productos[k]) nuevos++;
        // Una ficha por juego y plataforma: mejor la europea que la global
        if (!c.productos[k] || (p.region !== "global" && c.productos[k].region === "global")) c.productos[k] = p;
      }
      c.leidos[sm] = new Date().toISOString();
    } catch (e) { /* ese fichero se intentará en la próxima ronda */ }
    await esperar(800);
  }
  const productos = Object.values(c.productos);
  console.log(`${t.nombre}: leídos ${ronda.length} de ${todos.length} ficheros de su mapa (${Object.keys(c.leidos).length} en total); ${nuevos} coincidencias nuevas, ${productos.length} guardadas`);
  if (!productos.length) throw new Error(`el mapa de ${t.nombre} no trae ninguna clave del catálogo`);
  return { productos, fuera: [...fuera.values()] };
}
async function guardarCacheMercados() { if (cacheMercados) await writeFile(CACHE_MERCADOS, JSON.stringify(cacheMercados)); }
async function recorrerMercado(id, juegos, cuenta, avisos, caidas) {
  const t = MERCADOS[id];
  const llavesCatalogo = new Set([...juegos.values()].filter((j) => j.tipo !== "tarjeta").map((j) => llave(j.titulo)));
  const { productos, fuera } = await mapaMercado(id, llavesCatalogo);
  // Por juego y plataforma, una ficha (las globales y europeas valen igual en España)
  const porLlave = new Map();
  for (const p of productos) { const k = p.llave + "|" + p.plat; if (!porLlave.has(k)) porLlave.set(k, p); }
  const enCat = [];
  for (const j of juegos.values()) {
    if (j.tipo === "tarjeta") continue;
    for (const plat of ["PC", "Xbox Series", "Switch", "Switch 2"]) { const p = porLlave.get(llave(j.titulo) + "|" + plat); if (p) enCat.push({ j, p, pop: j.pop }); }
  }
  enCat.sort((a, b) => a.pop - b.pop);
  const lista = [...enCat.slice(0, MK_MAX), ...ventana(enCat.slice(MK_MAX), MK_ROTA)];
  console.log(`${t.nombre}: ${productos.length} claves válidas en su mapa; ${enCat.length} coinciden con el catálogo; ${lista.length} en esta ejecución`);
  let n = 0, fallos = 0;
  for (const x of lista) {
    try {
      const f = await t.ficha(x.p);
      if (f && f.precio > 0) {
        const antes = x.j.ofertas.length;
        ofertar(x.j, { tienda: id, plataforma: x.p.plat, precio: f.precio, stock: f.stock, drm: x.p.drm || undefined,
          condicion: `Clave ${x.p.drm || (x.p.plat === "PC" ? "PC" : x.p.plat === "Xbox Series" ? "Xbox" : "Nintendo")} · ${x.p.region === "global" || x.p.region === "worldwide" ? "Global" : "Europa"}`, url: x.p.url, fuente: id });
        if (x.j.ofertas.length >= antes) n++;
      }
    } catch (e) { if (++fallos <= 3) avisos.push(`${id}: ${e.message}`); if (fallos >= 8) { avisos.push(`${id}: demasiados fallos, paro`); caidas.add(id); break; } }
    x.j.revisado.add(id); visitar(id, x.j);
    await esperar(MK_ESPERA);
  }
  // Productos que no teníamos: se dan de alta con su nombre (de la ficha, o del enlace si la ficha no lo trae)
  let altas = 0;
  if (!caidas.has(id)) for (const p of fuera.slice(0, MK_NUEVOS)) {
    try {
      const f = await t.ficha(p);
      if (f && f.precio > 0) {
        const nombre = f.nombre || nombreDeSlug(p.llave);
        const j = juego(nombre, { pop: 99999 });
        if (j && !ES_CUENTA.test(nombre)) {
          ofertar(j, { tienda: id, plataforma: p.plat, precio: f.precio, stock: f.stock, drm: p.drm || undefined,
            condicion: `Clave ${p.drm || (p.plat === "PC" ? "PC" : p.plat === "Xbox Series" ? "Xbox" : "Nintendo")} · ${p.region === "global" || p.region === "worldwide" ? "Global" : "Europa"}`, url: p.url, fuente: id });
          j.revisado.add(id); visitar(id, j); altas++; n++;
        }
      }
    } catch (e) { if (++fallos >= 8) break; }
    await esperar(MK_ESPERA);
  }
  if (fuera.length) console.log(`${t.nombre}: ${fuera.length} claves que no teníamos en los mapas leídos; ${altas} dadas de alta ahora`);
  cuenta[id] = n;
}

// ---------- Portadas por nombre (para los juegos sin foto) ----------
const CACHE_IMAGENES = join(RAIZ, "data", "imagenes.json");
const IMG_MAX = +(ENV.IMAGENES_MAX || 400);
async function buscarImagenes(juegos, imgAnterior) {
  let cache = {}; try { cache = JSON.parse(await readFile(CACHE_IMAGENES, "utf8")); } catch {}
  const sinFoto = (j) => !j._img && !j._cov && !(imgAnterior.get(j.id) || []).some(Boolean) && j.tipo !== "tarjeta" && j.ofertas.length;
  let puestas = 0, buscadas = 0;
  const pendientes = [];
  for (const j of juegos.values()) {
    if (!sinFoto(j)) continue;
    const c = cache[j.id];
    if (c && c.img) { j._img = c.img; j._cov = c.cov || c.img; puestas++; continue; }
    if (c && Date.now() - Date.parse(c.fecha) < 30 * 86400000) continue;   // no se encontró hace poco: se reintenta al mes
    pendientes.push(j);
  }
  pendientes.sort((a, b) => a.pop - b.pop);
  const igual = (a, b) => llave(a) === llave(b);
  for (const j of pendientes.slice(0, IMG_MAX)) {
    let img = null, cov = null;
    try {
      if (j.plataformas.has("PC") || j.plataformas.has("Xbox Series")) {
        const d = await (await pedir(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(j.titulo)}&l=spanish&cc=ES`)).json();
        const it = (d.items || []).find((x) => x.type === "app" && igual(x.name, j.titulo));
        if (it) { img = "s:" + it.id; cov = img; }
      }
      if (!img && (j.plataformas.has("Switch") || j.plataformas.has("Switch 2"))) {
        const d = await (await pedir(`https://searching.nintendo-europe.com/es/select?q=${encodeURIComponent(j.titulo)}&fq=type:GAME&rows=5&wt=json&fl=title,image_url,image_url_h2x1_s`)).json();
        const it = (d.response?.docs || []).find((x) => igual(x.title || "", j.titulo));
        if (it && (it.image_url_h2x1_s || it.image_url)) { img = it.image_url_h2x1_s || it.image_url; cov = it.image_url || img; }
      }
    } catch (e) { continue; }
    buscadas++;
    cache[j.id] = img ? { img, cov, fecha: new Date().toISOString() } : { fecha: new Date().toISOString() };
    if (img) { j._img = img; j._cov = cov; puestas++; }
    await esperar(250);
  }
  await writeFile(CACHE_IMAGENES, JSON.stringify(cache));
  console.log(`Imágenes por nombre: ${buscadas} buscadas ahora, ${puestas} juegos con portada nueva (quedan ${Math.max(0, pendientes.length - IMG_MAX)} por buscar).`);
}

// ---------- Yuplay (claves de PC) ----------
// Su robots.txt permite el listado /api/products/ y las fichas /product/. El listado da nombre, precio y precio normal
// (en euros tras elegir la moneda con /api/currency/euro/, como el selector de su web). La región de cada clave solo
// sale en la ficha («Can be activated in …»): se guarda en data/yuplay.json y se vuelve a mirar cada 30 días.
// El listado solo deja ver las 100 primeras páginas (2.400 de unos 13.000 productos): el resto lo encontramos con su buscador
// (/api/products/?search=…), buscando los juegos del catálogo por turnos. Entra todo lo que se active en España: juegos,
// ediciones y DLC, aunque no estuvieran antes en el catálogo (fuera bandas sonoras y sus «Gift», que son lotes sorpresa).
const YUPLAY = "https://www.yuplay.com", YUPLAY_PARTNER = "3473557";
const CACHE_YUPLAY = join(RAIZ, "data", "yuplay.json");
const YU_FICHAS = +(ENV.YUPLAY_FICHAS || 700), YU_BUSQUEDAS = +(ENV.YUPLAY_BUSQUEDAS || 400), YU_ESPERA = 350, YU_DIAS = 30, YU_DIAS_BUSQUEDA = 7;
// Quita la plataforma y la región del nombre: «Avowed (Xbox Series X|S & PC)», «Civilization VI (Xbox One & Xbox Series X|S) Europe»
const nombreYuplay = (n) => n.replace(/\s*\((?=[^()]*\b(steam|pc|gog|epic|ubisoft|uplay|ea app|origin|rockstar|battle\.net|xbox|microsoft store|nintendo switch|playstation|eshop)\b)[^()]*\)/gi, "")
  .replace(/\s+(europe|global|eu|emea|worldwide)$/i, "").replace(/\s+/g, " ").trim();
// Tarjetas, monedas de juegos y suscripciones (FC Points, Robux, V-Bucks, tarjetas PSN, EA Play…)
const TJ_YU = /\b(gift card|wallet|network card|psn|eshop \d|points|coins|robux|v-?bucks|credits|minecoins|subscription|membership|riot points|\d+\s*(eur|usd|gbp)|[€$£]\s*\d+)\b|\b(tinder|nintendo switch online|game pass|ea play|ps plus|playstation plus)\b/i;
const YU_TARJETAS = ["gift card", "network card", "points", "coins", "robux", "v-bucks", "credits", "minecoins", "subscription", "membership", "eshop", "wallet", "tinder", "nintendo switch online", "ea play", "game pass", "playstation plus"];
const galletas = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get("set-cookie") || ""]).map((c) => c.split(";")[0]).filter(Boolean);
async function yuplay(juegos, cuenta, avisos) {
  let cache = {}; try { cache = JSON.parse(await readFile(CACHE_YUPLAY, "utf8")); } catch {}
  const jar = new Map();
  const guardar = (r) => galletas(r).forEach((c) => { const i = c.indexOf("="); jar.set(c.slice(0, i), c.slice(i + 1)); });
  const cookie = () => [...jar].map(([k, v]) => k + "=" + v).join("; ");
  const ir = async (u, json) => {
    const r = await fetch(YUPLAY + u, { headers: { ...CABECERAS, Cookie: cookie(), Referer: YUPLAY + "/", ...(json ? { Accept: "application/json" } : {}) }, redirect: "manual" });
    guardar(r);
    return r;
  };
  await ir("/"); await ir("/api/currency/euro/");
  // 1. Todo el listado (24 por página)
  const productos = [];
  for (let pag = 1, total = 1; pag <= total && pag <= 800; pag++) {
    const r = await ir(`/api/products/?page=${pag}`, true);
    if (!r.ok) { if (pag === 1) throw new Error("listado HTTP " + r.status); break; }
    const d = await r.json();
    total = d.extensions?.pagination?.num_pages || 1;
    for (const p of d.products || []) {
      if (p.currency_code !== "EUR") throw new Error("los precios no llegan en euros (" + p.currency_code + ")");
      productos.push({ nombre: nombreYuplay(html2txt(p.name)), bruto: html2txt(p.name), link: p.link, precio: +p.price, normal: +p.base_price, reserva: !!p.is_preorder });
    }
    await esperar(150);
  }
  // 2. Lo que no cabe en el listado: buscamos los juegos del catálogo (los más populares primero; cada uno, como mucho una vez por semana)
  const vistos = new Set(productos.map((p) => p.link));
  const busq = cache._busquedas || (cache._busquedas = {});
  const porLlave = new Map();
  for (const j of juegos.values()) if (j.tipo !== "tarjeta") { const k = llave(j.titulo); if (!porLlave.has(k)) porLlave.set(k, j); }
  const yaEsta = new Set(productos.map((p) => llave(p.nombre)));
  const aBuscar = [...juegos.values()].filter((j) => j.tipo === "juego" && j.plataformas.has("PC") && !yaEsta.has(llave(j.titulo)))
    .filter((j) => !busq[llave(j.titulo)] || Date.now() - Date.parse(busq[llave(j.titulo)]) > YU_DIAS_BUSQUEDA * 86400000)
    .sort((a, b) => a.pop - b.pop).slice(0, YU_BUSQUEDAS);
  let buscadas = 0, fallosBusq = 0;
  // Las tarjetas y monedas se buscan siempre; luego, los juegos del catálogo
  for (const q of [...YU_TARJETAS, ...aBuscar.map((j) => j.titulo)]) {
    const j = aBuscar.find((x) => x.titulo === q);
    try {
      const r = await ir(`/api/products/?search=${encodeURIComponent(q)}`, true);
      if (r.status === 403 || r.status === 429) break;                  // nos piden parar: seguimos en la próxima ejecución
      if (!r.ok) continue;
      for (const p of (await r.json()).products || []) {
        if (p.currency_code !== "EUR" || vistos.has(p.link)) continue;
        vistos.add(p.link);
        productos.push({ nombre: nombreYuplay(html2txt(p.name)), bruto: html2txt(p.name), link: p.link, precio: +p.price, normal: +p.base_price, reserva: !!p.is_preorder });
      }
      if (j) busq[llave(j.titulo)] = new Date().toISOString();
      buscadas++;
    } catch (e) { if (++fallosBusq === 1) avisos.push("yuplay búsqueda: " + e.message); if (fallosBusq >= 10) break; await esperar(3000); }
    await esperar(YU_ESPERA);
  }
  // 3. Qué es cada producto: los del catálogo se juntan con su ficha; el resto (ediciones, DLC…) entra como ficha nueva
  const valido = (p) => p.precio > 0 && !(/\bgift\b/i.test(p.nombre) && !/gift card/i.test(p.nombre)) && !NO_PRODUCTO.test(limpiar(p.nombre));
  const candidatos = productos.filter(valido);
  const popDe = (p) => TJ_YU.test(p.bruto || p.nombre) ? 1500 : (porLlave.get(llave(p.nombre)) || { pop: 199999 }).pop;
  // 4. Región y plataforma de las fichas que no se han mirado (o hace más de 30 días): primero las del catálogo, por popularidad
  const viejo = (c) => !c || Date.now() - Date.parse(c.fecha) > YU_DIAS * 86400000;
  const pendientes = candidatos.filter((p) => viejo(cache[p.link])).sort((a, b) => popDe(a) - popDe(b)).slice(0, YU_FICHAS);
  let fichas = 0;
  for (const p of pendientes) {
    try {
      const r = await ir(p.link);
      if (r.ok) {
        const h = await r.text();
        const act = (h.match(/data-tooltip_content="Can be activated in ([^"]*)"/) || [])[1] || "";
        const no = (h.match(/data-tooltip_content="Cannot be activated in ([^"]*)"/) || [])[1] || "";
        const plat = (h.match(/Available Platform:<\/span><div><a [^>]*title="([^"]+)"/) || [])[1] || "";
        const paises = act.split(/,\s*/).map((x) => x.trim());
        cache[p.link] = { vale: (act ? paises.includes("Spain") : !!no && !no.split(/,\s*/).includes("Spain")), drm: plat, fecha: new Date().toISOString() };
        fichas++;
      }
    } catch (e) { avisos.push("yuplay: " + e.message); }
    await esperar(YU_ESPERA);
  }
  await writeFile(CACHE_YUPLAY, JSON.stringify(cache));
  // 5. Las ofertas: lo que se activa en España (claves de PC, Xbox y Switch; tarjetas, monedas y suscripciones)
  let n = 0, nuevas = 0, tarjetas = 0;
  const marcaDe = (txt) => (MARCAS_SALDO.find(([, re]) => re.test(limpiar(txt))) || [])[0];
  for (const p of candidatos) {
    const c = cache[p.link];
    if (!c || !c.vale) continue;
    const bruto = p.bruto || p.nombre, drm = c.drm || "";
    const xbox = /xbox/i.test(drm + " " + bruto) && /xbox|microsoft/i.test(drm);
    const plats = xbox ? (/\bpc\b/i.test(bruto) ? ["Xbox Series", "PC"] : ["Xbox Series"]) : /nintendo/i.test(drm) ? ["Switch"] : /playstation|psn/i.test(drm) ? [] : ["PC"];
    const url = `${YUPLAY}${p.link}?partner=${YUPLAY_PARTNER}`, regular = p.normal > p.precio ? p.normal : undefined;
    if (TJ_YU.test(bruto)) {
      // Tarjeta de saldo en euros (p. ej. «PlayStation Network Card €10 - PSN Spain»): una ficha por marca y valor
      const m = marcaDe(bruto), valor = valorEuros(bruto.replace(/€\s*(\d+)/, "$1 €"));
      let j;
      if (m && valor > 0 && /(card|gift|wallet|eshop)/i.test(bruto)) {
        if (p.precio < valor * 0.7 || p.precio > valor * 1.15) continue;      // no cuadra con su valor: no es lo que creemos
        j = fichaSaldo(m, valor, 1500);
        ofertar(j, { tienda: "yuplay", plataforma: "Tarjeta regalo", precio: p.precio, regular: valor, condicion: "Código digital · válido en España", url, fuente: "yuplay" });
      } else {
        j = juego(p.nombre, { pop: 1600, tipo: "tarjeta" });
        if (!j) continue;
        plats.forEach((x) => j.plataformas.add(x));
        for (const plataforma of plats.length && !/playstation|psn/i.test(drm) ? plats : ["Tarjeta regalo"])
          ofertar(j, { tienda: "yuplay", plataforma, precio: p.precio, regular, condicion: `Código ${drm || "digital"} · válido en España`, url, fuente: "yuplay" });
      }
      j.revisado.add("yuplay"); n++; tarjetas++;
      continue;
    }
    if (!plats.length) continue;                                              // juegos de PlayStation: no sabemos si son de PS4 o PS5
    let j = porLlave.get(llave(p.nombre));
    if (!j) { j = juego(p.nombre, { pop: 99999 }); if (!j) continue; porLlave.set(llave(p.nombre), j); nuevas++; }
    for (const plataforma of plats)
      ofertar(j, { tienda: "yuplay", plataforma, precio: p.precio, regular, drm: drm || undefined,
        condicion: `Clave ${drm || "PC"} · válida en España`, url, fuente: "yuplay" });
    j.revisado.add("yuplay"); n++;
  }
  const enCatalogo = candidatos.filter((p) => porLlave.has(llave(p.nombre))).length;
  console.log(`Yuplay: ${productos.length} productos (${buscadas} búsquedas); ${fichas} fichas revisadas ahora (quedan ${Math.max(0, candidatos.filter((p) => viejo(cache[p.link])).length)}); ${n} ofertas válidas en España (${tarjetas} tarjetas y monedas), ${nuevas} de fichas nuevas; ${enCatalogo} en el catálogo.`);
  cuenta.yuplay = n;
}

// ---------- Alcampo (juegos en disco) ----------
// Su tienda online tiene un buscador con los datos de cada producto (nombre, precio, disponibilidad y sección).
// Su robots.txt permite consultarlo. Solo cogemos productos de la sección «Videojuegos» que no sean consolas ni accesorios,
// y solo los asociamos a juegos que ya están en el catálogo (todas las palabras del título tienen que aparecer).
const ALCAMPO = "https://www.compraonline.alcampo.es";
// Alcampo tiene una protección anti-bots: tras unas pocas consultas seguidas responde «202» vacío (un reto para navegadores).
// No la saltamos: hacemos solo unas pocas consultas amplias por ejecución y, si aparece, paramos hasta la siguiente.
const ALCAMPO_CONSULTAS = ["videojuego", "juego ps5", "juego nintendo switch", "juego switch 2", "juego ps4"];
const ALCAMPO_PAUSA = 8000;
const PLAT_ALCAMPO = [["Switch 2", /switch 2|switch2/], ["Switch", /switch/], ["PS5", /ps5|playstation 5/], ["PS4", /ps4|playstation 4/], ["Xbox Series", /xbox/]];
const NO_JUEGO_ALCAMPO = /\b(pack|consola|mando|auricular|auriculares|tarjeta|memoria|cargador|cable|funda|volante|soporte|base|bateria|pack consola|camara|gafas|headset|steering|accesorio)\b/;
async function alcampo(visitar) {
  const productos = new Map();
  const buscar = async (q) => {
    const r = await pedir(`${ALCAMPO}/api/webproductpagews/v6/product-pages/search?q=${encodeURIComponent(q)}&maxPageSize=300&maxProductsToDecorate=300`, { headers: { Accept: "application/json" } });
    const texto = await r.text();
    if (r.status === 202 || !texto) return false; // nos pide demostrar que somos un navegador: lo dejamos
    const d = JSON.parse(texto);
    for (const g of d.productGroups || []) for (const p of g.decoratedProducts || []) {
      const ruta = (p.categoryPath || []).map(limpiar);
      if (ruta[1] !== "videojuegos" || /consola|accesorio|memoria|tarjeta/.test(ruta[2] || "")) continue;
      if (NO_JUEGO_ALCAMPO.test(limpiar(p.name)) || !(parseFloat(p.price?.amount) > 0)) continue;
      productos.set(p.retailerProductId, p);
    }
    return true;
  };
  for (const q of ALCAMPO_CONSULTAS) {
    if (!(await buscar(q))) { console.warn(`Alcampo: su protección anti-bots ha saltado tras «${q}»; seguimos en la próxima ejecución`); break; }
    await esperar(ALCAMPO_PAUSA);
  }
  // 3. Asociar cada producto al juego del catálogo con el título más largo que encaje
  // «FC27» y «FC 27» son lo mismo: separamos letras de números en ambos lados
  const separar = (x) => x.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  const candidatos = [...juegos.values()].filter((j) => j.tipo !== "dlc" && j.tipo !== "tarjeta").map((j) => ({ j, palabras: separar(clave(j.titulo)).split(" ").filter(Boolean) })).filter((c) => c.palabras.length);
  let n = 0;
  for (const p of productos.values()) {
    const t = " " + separar(limpiar(p.name)) + " ";
    const plat = PLAT_ALCAMPO.find(([, re]) => re.test(" " + limpiar(p.name) + " "))?.[0];
    if (!plat) continue;
    let mejor = null;
    for (const c of candidatos) if (c.palabras.every((w) => t.includes(" " + w + " ")) && (!mejor || c.palabras.length > mejor.palabras.length)) mejor = c;
    // Un título de una sola palabra solo vale si el producto empieza por ella (si no, «Sports» encajaría con cualquier juego de deportes)
    if (!mejor || (mejor.palabras.length < 2 && !t.trimStart().replace(/^(juego|nintendo switch 2|nintendo switch|ps5|ps4) /, "").startsWith(mejor.palabras[0] + " "))) continue;
    const slug = limpiar(p.name).replace(/ /g, "-");
    ofertar(mejor.j, { tienda: "alcampo", plataforma: plat, formato: "fisico", estado: "nuevo", stock: !!p.available, precio: parseFloat(p.price.amount),
      url: `${ALCAMPO}/products/${slug}/${p.retailerProductId}`, fuente: "alcampo" });
    visitar(mejor.j);
    n++;
  }
  console.log(`Alcampo: ${productos.size} videojuegos en su tienda, ${n} asociados al catálogo`);
  return n;
}

// ---------- Tarjetas regalo, monedas de juegos y suscripciones ----------
// Fuentes: Instant Gaming (tarjetas, monedas como V-Bucks o Robux, suscripciones), GAME (tarjetas PlayStation y Nintendo)
// y la recarga oficial de Steam. Solo lo que vale en España; las tarjetas de saldo, solo con valor en euros.
const MARCAS_SALDO = [
  ["PlayStation", /playstation|psn/], ["Nintendo eShop", /nintendo/], ["Xbox", /xbox|microsoft/], ["Steam", /steam/],
  ["Roblox", /roblox/], ["Fortnite", /fortnite/], ["League of Legends", /league of legends/], ["Twitch", /twitch/], ["IMVU", /\bimvu\b/],
  ["Amazon", /amazon/], ["Apple", /apple|itunes/], ["Google Play", /google play/], ["Spotify", /spotify/], ["Netflix", /netflix/],
];
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
async function tarjetasRegalo(visitar) {
  let n = 0;
  const marca = (txt) => (MARCAS_SALDO.find(([, re]) => re.test(limpiar(txt))) || [])[0];
  // 1. Instant Gaming: las tarjetas, monedas y suscripciones de su mapa de productos (válidas en España), unas cuantas
  //    en cada ejecución: las de saldo de las marcas grandes siempre y el resto por turnos, hasta tenerlas todas
  const tarjetasIG = (PRODUCTOS_IG || []).filter((p) => p.tarjeta);
  const deSaldo = (p) => /tarjeta-regalo|gift-card|\d+eur/.test(p.url) && MARCAS_SALDO.some(([, re]) => re.test(p.nombre));
  const listaTj = [...tarjetasIG.filter(deSaldo), ...ventana(tarjetasIG.filter((p) => !deSaldo(p)), +(ENV.IG_TARJETAS_ROTA || 120))];
  console.log(`Tarjetas de Instant Gaming: ${tarjetasIG.length} en su mapa; ${listaTj.length} en esta ejecución`);
  for (const p of listaTj) {
    let f = null;
    try { f = await fichaIG(p.url); } catch (e) { console.warn(`tarjetas IG: ${e.message}`); }
    await esperar(600);
    if (!f || !(f.precio > 0) || !regionValeIG(f.region)) continue;
    const valor = valorEuros(f.nombre), m = marca(f.nombre);
    const esSaldo = m && valor > 0 && /(tarjeta|gift|card|wallet|recarga|prepago|codigo|saldo)/.test(limpiar(f.nombre));
    if (esSaldo && (f.precio < valor * 0.7 || f.precio > valor * 1.15)) continue; // no cuadra con su valor: no es lo que creemos
    const j = esSaldo ? fichaSaldo(m, valor, 1500) : juego(f.nombre, { pop: 1600, tipo: "tarjeta" });
    if (!j) continue;
    visitar(j);
    const plats = esSaldo ? ["Tarjeta regalo"] : (p.plats.length ? p.plats : (PLATS_MARCA[m] || ["Tarjeta regalo"]));
    if (!esSaldo) (m ? PLATS_MARCA[m] || [] : p.plats).forEach((x) => j.plataformas.add(x));
    for (const plataforma of plats) ofertar(j, { tienda: "instantgaming", plataforma, precio: f.precio, regular: esSaldo ? valor : undefined, stock: f.stock,
      condicion: `Código digital · ${f.region || "Worldwide"}`, url: `${p.url}?igr=${AFILIADO_IG}`, fuente: "tarjetas" });
    n++;
  }
  // 2. GAME: tarjetas de saldo de su mapa de productos (PlayStation, Xbox, Nintendo eShop, Google Play, Netflix…)
  for (const t of TARJETAS_GAME.filter((x) => x.meses)) {
    let r = null;
    try { r = await fichaGame(t.url); } catch (e) { console.warn(`tarjetas GAME: ${e.message}`); }
    await esperar(500);
    if (!r || !(r.precio > 0)) continue;
    const nombre = t.texto.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Xbox/, "Xbox") + ` ${t.meses} ${t.meses === 1 ? "mes" : "meses"}`;
    const j = juego(nombre, { pop: 1600, tipo: "tarjeta" });
    if (!j) continue;
    visitar(j);
    (/xbox/i.test(nombre) ? ["Xbox Series", "PC"] : []).forEach((x) => j.plataformas.add(x));
    ofertar(j, { tienda: "game", plataforma: /xbox/i.test(nombre) ? "Xbox Series" : "Tarjeta regalo", precio: r.precio, stock: r.stock, condicion: "Código digital", url: t.url, fuente: "tarjetas" });
    n++;
  }
  for (const t of TARJETAS_GAME.filter((x) => !x.meses)) {
    const m = marca(t.texto);
    if (!m) continue;
    let r = null;
    try { r = await fichaGame(t.url); } catch (e) { console.warn(`tarjetas GAME: ${e.message}`); }
    await esperar(500);
    // El precio de una tarjeta de saldo es su valor (o muy cerca): si no, no es lo que creemos
    if (!r || r.precio < t.valor * 0.7 || r.precio > t.valor * 1.15) continue;
    const j = fichaSaldo(m, t.valor, 1500);
    visitar(j);
    ofertar(j, { tienda: "game", plataforma: "Tarjeta regalo", precio: r.precio, regular: t.valor, stock: r.stock, condicion: "Código digital", url: t.url, fuente: "tarjetas" });
    n++;
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
  // Prueba rápida de Instant Gaming por su mapa de productos (PRUEBA_IG=1)
  if (ENV.PRUEBA_IG) {
    const ps = await mapaInstantGaming();
    const tj = ps.filter((p) => p.tarjeta);
    console.log("MAPA IG:", ps.length, "productos válidos;", tj.length, "tarjetas; regiones:", JSON.stringify(ps.reduce((a, p) => (a[p.region || "-"] = (a[p.region || "-"] || 0) + 1, a), {})));
    console.log("EJEMPLOS:", ps.filter((p) => !p.tarjeta).slice(0, 8).map((p) => `${p.nombre} [${p.plats}] ${p.drm} ${p.region}`).join(" | "));
    for (const t of ["No Man's Sky", "EA SPORTS FC 27", "Hogwarts Legacy", "Elden Ring", "Cyberpunk 2077"]) {
      const k = llave(t).replace(/^ea sports (?=\S+ \S)/, ""), lista = ps.filter((p) => !p.tarjeta && llave(p.nombre).replace(/^ea sports (?=\S+ \S)/, "") === k);
      console.log("FICHAS", t, lista.length, lista.slice(0, 6).map((p) => `${p.id} [${p.plats}] ${p.drm} ${p.region}`).join(" | "));
      let j = juego(t, {});
      for (const p of lista.slice(0, 3)) j = (await productoIG(j, p)).j;
      console.log("OFERTAS", t, j.ofertas.map((o) => `${o.plataforma} ${o.precio}${o.stock ? "" : " (agotado)"} ${o.condicion}`).join(" | "));
    }
    console.log("TARJETAS:", tj.slice(0, 60).map((p) => p.nombre).join(" | "));
    for (const p of tj.filter((p) => /playstation|robux|v-bucks|fc-points|creditos-r6|game-pass/.test(p.url)).slice(0, 8)) { const f = await fichaIG(p.url); console.log("FICHA TJ", p.url.slice(35), JSON.stringify(f)); await esperar(600); }
    return;
  }
  // Prueba rápida de GAME y Microsoft Store con unos juegos, sin tocar precios.json (PRUEBA_GAME=1)
  if (ENV.PRUEBA_GAME) {
    const mapa = await mapaGame(), mapaX = await mapaMS();
    console.log("MAPA GAME:", mapa.size, "juegos; tarjetas:", TARJETAS_GAME.map((t) => t.texto + " " + t.valor).join(", "), "| MAPA MS:", mapaX.size);
    for (const t of ["EA SPORTS FC 27", "EA Sports FC 27 Ultimate Edition", "Borderlands 4", "F1 25", "Street Fighter 6", "Split Fiction", "Sid Meier's Civilization VII", "Jurassic World Evolution 3", "LEGO Batman: El Legado del Caballero Oscuro", "TEKKEN 8", "Hollow Knight"]) {
      const j = juego(t, {}); const f = mapa.get(llave(t).replace(/^ea sports (?=\S+ \S)/, "")) || [];
      console.log("FICHAS", t, JSON.stringify(f));
      if (f.length) await game(j, f);
      j.plataformas.add("Xbox Series");
      const ids = mapaX.get(llave(t).replace(/^ea sports (?=\S+ \S)/, ""));
      console.log("IDS MS", t, JSON.stringify(ids));
      try { if (ids) preciosMS(j, await productosMS(ids)); else await microsoftStore(j); } catch (e) { console.log("MS error", e.message); }
      console.log("OFERTAS", t, j.ofertas.map((o) => `${o.tienda} ${o.plataforma} ${o.estado} ${o.precio}/${o.regular}${o.stock ? "" : " (agotado)"}`).join(" | "));
    }
    return;
  }
  // Prueba rápida de Alcampo con el catálogo actual, sin tocar precios.json (PRUEBA_ALCAMPO=1)
  if (ENV.PRUEBA_ALCAMPO) {
    for (const v of JSON.parse(await readFile(join(RAIZ, "precios.json"), "utf8")).juegos) { const j = juego(v.titulo, { pop: v.pop, tipo: v.tipo }); if (j) v.plataformas.forEach((p) => j.plataformas.add(p)); }
    const lista = [...juegos.values()].filter((j) => j.tipo !== "dlc" && j.tipo !== "tarjeta" && [...j.plataformas].some((p) => p !== "PC")).sort((a, b) => a.pop - b.pop);
    await alcampo(() => {});
    for (const j of juegos.values()) if (j.ofertas.some((o) => o.tienda === "alcampo")) console.log("ALCAMPO", j.titulo, "→", j.ofertas.filter((o) => o.tienda === "alcampo").map((o) => `${o.plataforma} ${o.precio}${o.stock ? "" : " (agotado)"} ${o.url}`).join(" | "));
    const u = [...juegos.values()].flatMap((j) => j.ofertas).find((o) => o.tienda === "alcampo")?.url;
    if (u) { const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0)" }, redirect: "follow" }); console.log("ENLACE", u, "→", r.status, r.url); }
    return;
  }
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
    // Solo cuenta como «PS Store no lo vende» si encontramos su ficha y no tiene precio (si no la encontramos, no sabemos)
    if (!e.ofertas?.length) { const jx = [...juegos.values()].find((x) => x.id === id); if (jx && e.ids?.length && e.actualizado) jx.revisado.add("psstore"); continue; }
    const j = [...juegos.values()].find((x) => x.id === id) || juego(e.titulo);
    for (const o of e.ofertas) { ofertar(j, o); nPs++; }
  }
  cuenta["psstore (catálogo)"] = nPs;

  // 3. GAME y eBay (disco nuevo y segunda mano) para los juegos de consola más populares
  const populares = (max) => [...juegos.values()].sort((a, b) => a.pop - b.pop).slice(0, max);
  const consolaPopulares = (max) => [...juegos.values()].filter((j) => j.tipo !== "tarjeta" && [...j.plataformas].some((p) => p !== "PC")).sort((a, b) => a.pop - b.pop).slice(0, max);
  // Qué tiendas quedan comprobadas cuando una fuente revisa un juego (si no hay precio, es que no lo tienen)
  const REVISA = { game: ["game", "gameseminuevos"], xbox: ["xbox"], instantgaming: ["instantgaming"], ebay: ["ebay"] };
  const recorrerFuente = async (nombre, lista, fn, pausa) => {
    let fallos = 0;
    for (const j of lista) {
      // Límite diario de la API alcanzado (eBay: unas 5.000 consultas al día): se para sin darla por rota
      if (/HTTP 429/.test(avisos[avisos.length - 1] || "") && avisos[avisos.length - 1].startsWith(nombre + ":")) { avisos.push(`${nombre}: límite diario de consultas alcanzado, sigo en la próxima ejecución`); break; }
      if (await intentar(nombre, () => fn(j))) { (REVISA[nombre] || [nombre]).forEach((t) => j.revisado.add(t)); visitar(nombre, j); }
      else if (++fallos >= 5) { avisos.push(`${nombre}: demasiados fallos, paro`); caidas.add(nombre); break; }
      await esperar(pausa);
    }
  };
  // GAME: el mapa de productos dice qué juegos tiene. Los del catálogo que no están ahí quedan revisados (GAME no los vende);
  // de los que sí, leemos la ficha de los más populares siempre y del resto por turnos. Lo que GAME vende y aún no teníamos se añade.
  let mapa = null;
  try { mapa = await mapaGame(); } catch (e) { avisos.push(`game: ${e.message}`); caidas.add("game"); }
  if (mapa) {
    const enGame = [];
    for (const j of [...juegos.values()]) {
      if (j.tipo === "tarjeta" || j.tipo === "dlc") continue;
      const k = llave(j.titulo).replace(/^ea sports (?=\S+ \S)/, ""), fichas = mapa.get(k);
      if (fichas) { enGame.push({ j, fichas, pop: j.pop }); mapa.delete(k); }
      else { j.revisado.add("game"); j.revisado.add("gameseminuevos"); }
    }
    // Los que GAME vende y no estaban en el catálogo (solo si los tiene nuevos: lo seminuevo suelto suele ser antiguo)
    for (const [, fichas] of mapa) if (fichas.some((f) => !f.usado && f.plataforma)) enGame.push({ j: null, fichas, pop: 99999 });
    enGame.sort((a, b) => a.pop - b.pop);
    const listaGame = [...enGame.slice(0, GAME_MAX), ...ventana(enGame.slice(GAME_MAX), GAME_ROTA)];
    console.log(`GAME: ${enGame.length} juegos en su mapa de productos (${enGame.filter((x) => !x.j).length} nuevos para el catálogo); ${listaGame.length} en esta ejecución`);
    let fallos = 0, nGame = 0;
    for (const x of listaGame) {
      try { nGame += await game(x.j, x.fichas); }
      catch (e) { if (++fallos <= 3) avisos.push(`game: ${e.message}`); if (fallos >= 8) { avisos.push("game: demasiados fallos, paro"); caidas.add("game"); break; } }
    }
    cuenta.game = nGame;
  }
  // Microsoft Store: los juegos que salen en el mapa de productos de xbox.com, todos en cada ejecución (de 20 en 20);
  // para el resto, el buscador de Microsoft con los más populares y un bloque distinto cada vez
  // Los juegos que ya teníamos de antes (sobre todo los que solo vienen de Instant Gaming, que se consulta después)
  // también se buscan en el mapa de Microsoft; si al final no tienen ningún precio, no salen
  for (const v of anterior.juegos || []) if (v.tipo !== "tarjeta") { const j = juego(v.titulo, { pop: v.pop, tipo: v.tipo }); if (j) (v.plataformas || []).forEach((p) => j.plataformas.add(p)); }
  // Lanzamientos que no pueden faltar aunque todavía no estén en Steam (GTA VI…): se meten en el catálogo antes de leer
  // los mapas de las tiendas, así Microsoft Store, Instant Gaming y compañía los buscan en la primera ronda.
  // Si ninguna tienda les pone precio, no salen en la web.
  for (const x of await leer("config/prioritarios.json", [])) {
    const j = juego(x.titulo, { pop: x.pop || 50, tipo: x.tipo || "juego" });
    if (j) { (x.plataformas || []).forEach((p) => j.plataformas.add(p)); if (x.lanzamiento) fechar(j, x.lanzamiento, false); }
  }
  let mapaXbox = null;
  try { mapaXbox = await mapaMS(); } catch (e) { avisos.push(`xbox: ${e.message}`); }
  const enMapaMS = new Set();
  if (mapaXbox) {
    const pares = [];
    for (const j of juegos.values()) {
      if (j.tipo === "tarjeta") continue;
      const ids = mapaXbox.get(llave(j.titulo).replace(/^ea sports (?=\S+ \S)/, ""));
      if (ids) { pares.push([j, ids]); enMapaMS.add(j); }
    }
    console.log(`Microsoft Store: ${mapaXbox.size} productos en el mapa de xbox.com; ${pares.length} juegos del catálogo`);
    let lote = [], fallosMS = 0, nMS = 0;
    const procesar = async () => {
      if (!lote.length) return;
      try {
        const prods = await productosMS([...new Set(lote.flatMap(([, ids]) => ids))]);
        const porId = new Map(prods.map((p) => [p.ProductId, p]));
        for (const [j, ids] of lote) { nMS += preciosMS(j, ids.map((id) => porId.get(id)).filter(Boolean)); j.revisado.add("xbox"); visitar("xbox", j); }
      } catch (e) { if (++fallosMS <= 3) avisos.push(`xbox: ${e.message}`); }
      lote = [];
      await esperar(300);
    };
    for (const par of pares) {
      if (lote.flatMap(([, ids]) => ids).length + par[1].length > 20) await procesar();
      lote.push(par);
      if (fallosMS >= 8) { avisos.push("xbox: demasiados fallos, paro"); caidas.add("xbox"); break; }
    }
    await procesar();
    cuenta["xbox (mapa)"] = nMS;
  }
  const candidatosMS = [...juegos.values()].filter((j) => !enMapaMS.has(j) && j.tipo !== "tarjeta" && (j.plataformas.has("PC") || j.plataformas.has("Xbox Series") || j._buscarEn?.includes("Xbox Series"))).sort((a, b) => a.pop - b.pop);
  await recorrerFuente("xbox", [...candidatosMS.slice(0, MS_MAX), ...ventana(candidatosMS.slice(MS_MAX), MS_ROTA)], microsoftStore, 300);
  // Instant Gaming: el mapa de productos dice qué tiene de cada juego. Los del catálogo que no salen ahí quedan revisados;
  // de los que sí, leemos sus fichas (los populares siempre y el resto por turnos). Lo que vende y no teníamos se añade.
  let productosIG = null;
  try { productosIG = await mapaInstantGaming(); } catch (e) { avisos.push(`instantgaming: ${e.message}`); caidas.add("instantgaming"); }
  if (productosIG) {
    const porLlave = new Map();
    for (const p of productosIG) if (!p.tarjeta) { const k = llave(p.nombre).replace(/^ea sports (?=\S+ \S)/, ""); if (k) (porLlave.get(k) || porLlave.set(k, []).get(k)).push(p); }
    // De cada juego, como mucho una ficha por plataforma y tienda de la clave (la de la región más útil: España, Europa, mundial)
    const elegir = (lista) => {
      const prio = (p) => ({ espana: 0, europe: 1, europa: 1, worldwide: 2, global: 2 }[p.region] ?? 3);
      const vistos = new Map();
      for (const p of [...lista].sort((a, b) => prio(a) - prio(b) || a.id - b.id)) { const k = p.plats.join() + "|" + p.drm; if (!vistos.has(k)) vistos.set(k, p); }
      return [...vistos.values()].slice(0, 4);
    };
    const enIG = [];
    for (const j of [...juegos.values()]) {
      if (j.tipo === "tarjeta") continue;
      const k = llave(j.titulo).replace(/^ea sports (?=\S+ \S)/, ""), lista = porLlave.get(k);
      if (lista) { enIG.push({ j, fichas: elegir(lista), pop: j.pop }); porLlave.delete(k); }
      else { j.revisado.add("instantgaming"); visitar("instantgaming", j); }
    }
    for (const [, lista] of porLlave) enIG.push({ j: null, fichas: elegir(lista), pop: 99999 });
    enIG.sort((a, b) => a.pop - b.pop);
    const listaIG = [...enIG.slice(0, IG_MAX), ...ventana(enIG.slice(IG_MAX), IG_ROTA)];
    console.log(`Instant Gaming: ${productosIG.length} productos válidos en España en su mapa; ${enIG.length} juegos (${enIG.filter((x) => !x.j).length} nuevos para el catálogo); ${listaIG.length} en esta ejecución`);
    let fallosIG = 0, nIG = 0;
    for (const x of listaIG) {
      let j = x.j;
      try { for (const p of x.fichas) { const r = await productoIG(j, p); j = r.j; nIG += r.n; } }
      catch (e) { if (++fallosIG <= 3) avisos.push(`instantgaming: ${e.message}`); if (fallosIG >= 8) { avisos.push("instantgaming: demasiados fallos, paro"); caidas.add("instantgaming"); break; } }
      if (j) { j.revisado.add("instantgaming"); visitar("instantgaming", j); }
    }
    cuenta.instantgaming = nIG;
  }
  // Kinguin: solo juegos que ya tenemos en el catálogo (su mapa trae muchísimo ruido de cuentas y DLC sueltos)
  // Kinguin bloquea con 403 a los servidores de GitHub (protección antibot): apagado hasta tener su API de afiliados
  if (ENV.KINGUIN === "1") {
    try {
      const productosKin = await mapaKinguin();
      const porLlaveKin = new Map();
      for (const p of productosKin) if (!porLlaveKin.has(p.llave)) porLlaveKin.set(p.llave, p);
      const enKin = [];
      for (const j of juegos.values()) {
        if (j.tipo === "tarjeta") continue;
        const p = porLlaveKin.get(llave(j.titulo));
        if (p) enKin.push({ j, p, pop: j.pop });
      }
      enKin.sort((a, b) => a.pop - b.pop);
      const listaKin = [...enKin.slice(0, KIN_MAX), ...ventana(enKin.slice(KIN_MAX), KIN_ROTA)];
      console.log(`Kinguin: ${productosKin.length} fichas en su mapa; ${enKin.length} coinciden con el catálogo; ${listaKin.length} en esta ejecución`);
      let nKin = 0, fallosKin = 0;
      for (const x of listaKin) {
        try { nKin += await kinguinUno(x.j, x.p); }
        catch (e) { if (++fallosKin <= 3) avisos.push(`kinguin: ${e.message}`); if (fallosKin >= 8) { avisos.push("kinguin: demasiados fallos, paro"); caidas.add("kinguin"); break; } }
        x.j.revisado.add("kinguin"); visitar("kinguin", x.j);
      }
      cuenta.kinguin = nKin;
    } catch (e) { avisos.push(`kinguin: ${e.message}`); caidas.add("kinguin"); }
  }
  for (const id of Object.keys(MERCADOS)) {
    if (ENV["SIN_" + id.toUpperCase()] === "1") continue;
    try { await recorrerMercado(id, juegos, cuenta, avisos, caidas); }
    catch (e) { avisos.push(`${id}: ${e.message}`); caidas.add(id); }
  }
  await guardarCacheMercados();
  if (ENV.SIN_YUPLAY !== "1") {
    try { await yuplay(juegos, cuenta, avisos); } catch (e) { avisos.push(`yuplay: ${e.message}`); caidas.add("yuplay"); }
  }
  if (!(await intentar("alcampo", () => alcampo((j) => visitar("alcampo", j))))) caidas.add("alcampo");
  if (!(await intentar("tarjetas regalo", () => tarjetasRegalo((j) => visitar("tarjetas", j))))) caidas.add("tarjetas");
  if (ENV.EBAY_CLIENT_ID && ENV.EBAY_CLIENT_SECRET) {
    // Juegos en disco (no DLC ni tarjetas): los populares siempre y el resto por turnos, hasta cubrir todo el catálogo
    const paraEbay = consolaPopulares(Infinity).filter((j) => j.tipo !== "dlc");
    const listaEbay = [...paraEbay.slice(0, EBAY_MAX), ...ventana(paraEbay.slice(EBAY_MAX), EBAY_ROTA)];
    console.log(`eBay: ${listaEbay.length} juegos de ${paraEbay.length} en esta ejecución`);
    await recorrerFuente("ebay", listaEbay, ebay, 250);
  }

  // 4. IsThereAnyDeal para los juegos de PC más populares
  if (ENV.ITAD_KEY) {
    const dePC = [...juegos.values()].filter((j) => j.plataformas.has("PC")).sort((a, b) => a.pop - b.pop).slice(0, +(ENV.ITAD_MAX || 10000));
    if (!(await intentar("itad", () => itad(dePC, tiendas)))) caidas.add("itad");
    else dePC.forEach((j) => visitar("itad", j));
  }

  // 4a. Packs (bundles) activos de Humble, Fanatical, IndieGala… según IsThereAnyDeal
  let packs = anterior.packs || [];
  if (ENV.ITAD_KEY) {
    try { packs = await packsITAD(); console.log(`Packs: ${packs.length} activos.`); }
    catch (e) { console.warn("Packs: " + e.message + " (se conservan los anteriores)"); }
  }

  // 4b. Lo revisado en ejecuciones anteriores se conserva (GAME va rotando por bloques)
  const porId = new Map([...juegos.values()].map((j) => [j.id, j]));
  // (GAME se recalcula entero con su mapa de productos; lo de Microsoft anterior a la versión 2 se descarta porque
  //  la búsqueda fallaba con los nombres que llevan ™ y marcaba como revisados juegos que sí tienen)
  const noArrastrar = new Set(mapa ? ["game", "gameseminuevos", "psstore"] : ["psstore"]); // PS Store se recalcula entero cada vez
  if (anterior.revisadoV !== 2) noArrastrar.add("xbox");
  for (const viejo of anterior.juegos || []) { const j = porId.get(viejo.id); if (j) (viejo.revisado || []).forEach((t) => { if (!noArrastrar.has(t)) j.revisado.add(t); }); }

  // 5. El catálogo se acumula: los precios que no se han revisado en esta ejecución (fuera de los bloques
  //    que tocaban, o porque una fuente ha fallado) se conservan hasta CONSERVAR_DIAS desde su última comprobación.
  const limite = Date.now() - CONSERVAR_DIAS * 86400000;
  let conservadas = 0;
  for (const viejo of anterior.juegos || []) {
    for (const o of viejo.ofertas || []) {
      if (o.fuente === "psstore" || o.fuente === "manual") continue;     // estas se recargan enteras en cada ejecución
      if (/^(steam (deck|controller|machine|frame|link)|valve index)/i.test(viejo.titulo)) continue; // hardware, no juegos
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

  // Fecha de lanzamiento: la oficial; si no, la de Instant Gaming; si esta vez no ha salido ninguna, la que ya teníamos
  const fechaAnterior = new Map((anterior.juegos || []).map((j) => [j.id, j.lanzamiento]));
  const imgAnterior = new Map((anterior.juegos || []).map((j) => [j.id, [j.img, j.cov]]));
  // Juegos sin imagen que se venden en Steam: su imagen sale del número de app del enlace
  for (const j of juegos.values()) if (!j._img && !j._cov) {
    const app = j.ofertas.map((o) => String(o.url || "").match(/store\.steampowered\.com\/app\/(\d+)/)).find(Boolean);
    if (app) ponerImagen(j, "steam", "s:" + app[1], "s:" + app[1]);
  }
  // Las direcciones de siempre (apps/<id>/header.jpg) ya no valen para muchos juegos: se piden sus carpetas
  // a la API de la tienda, por tandas, empezando por los más buscados.
  const appDe = (j) => (String(j._img || "").startsWith("s:") ? String(j._img).slice(2)
    : (j.ofertas.map((o) => String(o.url || "").match(/store\.steampowered\.com\/app\/(\d+)/)).find(Boolean) || [])[1]);
  const viejas = [...juegos.values()].filter((j) => (!j._img || String(j._img).startsWith("s:")) && appDe(j)).sort((a, b) => a.pop - b.pop);
  const porApp = new Map();
  for (const j of viejas.slice(0, FOTOS_STEAM_MAX)) { const a = appDe(j); if (a && !porApp.has(a)) porApp.set(a, []); if (a) porApp.get(a).push(j); }
  if (porApp.size) {
    const nuevas = await fotosSteam([...porApp.keys()]);
    let arregladas = 0;
    for (const [a, js] of porApp) {
      const ft = nuevas.get(a); if (!ft || !(ft.img || ft.cov)) continue;
      for (const j of js) { if (ft.img) { j._img = ft.img; j._imgP = PRIO_IMG.steam || 0; } if (ft.cov) { j._cov = ft.cov; j._covP = PRIO_IMG.steam || 0; } }
      arregladas += js.length;
    }
    console.log(`Fotos de Steam al día: ${arregladas} de ${porApp.size} juegos consultados (quedan ${Math.max(0, viejas.length - porApp.size)}).`);
  }
  // Ediciones, DLC y demás que no tienen foto propia (solo se venden en tiendas que no la dan):
  // se les pone la del juego base, que es la carátula que la gente espera ver.
  const SOBRAS = /\s*[-–:,(]*\s*\b(digital\s+)?(deluxe|ultimate|gold|premium|standard|complete|definitive|special|collector'?s?|anniversary|legendary|game of the year|goty|remastered|enhanced|cross-?gen|next\s*gen)?\s*(edition|edición|bundle|pack|upgrade|season pass|pase de temporada|contenido adicional)\b.*$/i;
  const base = new Map();
  for (const j of juegos.values()) if ((j._img || j._cov) && j.tipo !== "tarjeta") { const k = llave(j.titulo); if (!base.has(k)) base.set(k, j); }
  let heredadas = 0;
  // Posibles nombres del juego base: sin la coletilla de edición, cortando por «:» o « - » (los DLC suelen ir así:
  // «Dying Light - The Bozak Horde», «Borderlands 2: Headhunter 4…») y sin «DLC…» al final («Minecraft Dungeons Ultimate DLC Bundle»).
  const raicesDe = (t) => {
    const out = [t.replace(SOBRAS, ""), t.replace(/\s+(ultimate\s+|complete\s+)?dlc\b.*$/i, "")];
    const partes = t.split(/\s*(?::|\s[-–—]\s)\s*/);
    for (let i = partes.length - 1; i >= 1; i--) out.push(partes.slice(0, i).join(": "));
    // Contenido descargable sin separador («Crusader Kings III Content Creator Pack»): se van quitando palabras del final
    if (/\b(dlc|pack|bundle|season pass|chapter|expansion|soundtrack|ost|skin|costume|upgrade|kit|set)\b/i.test(t)) {
      const pal = partes[0].split(/\s+/);
      for (let n = pal.length - 1; n >= 2; n--) out.push(pal.slice(0, n).join(" "));
    }
    return out.map((x) => x.trim()).filter((x) => x.length >= 3 && llave(x) !== llave(t));
  };
  for (const j of juegos.values()) {
    if (j._img || j._cov || j.tipo === "tarjeta") continue;
    let b = null;
    for (const r of raicesDe(j.titulo)) { b = base.get(llave(r)); if (b) break; }
    if (!b) continue;
    if (b._img) { j._img = b._img; j._imgP = 0; }
    if (b._cov) { j._cov = b._cov; j._covP = 0; }
    heredadas++;
  }
  if (heredadas) console.log(`Fotos heredadas del juego base: ${heredadas} ediciones y extras.`);
  // Juegos que siguen sin foto: se busca su portada por el nombre en Steam (PC) y en la eShop (Switch).
  // Solo si el nombre coincide; lo encontrado (o que no hay) se guarda en data/imagenes.json para no repetir la búsqueda.
  if (ENV.SIN_IMAGENES !== "1") {
    try { await buscarImagenes(juegos, imgAnterior); } catch (e) { console.warn("Imágenes por nombre: " + e.message); }
  }
  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map(({ _buscarEn, _pvpFijo, _fechaOf, _fechaIG, _img, _imgP, _cov, _covP, plataformas, revisado, ...j }) => {
      const lanzamiento = _fechaOf || _fechaIG || fechaAnterior.get(j.id) || undefined;
      const [imgV, covV] = imgAnterior.get(j.id) || [];
      return { ...j, plataformas: [...plataformas], pvp: j.pvp || undefined, revisado: revisado.size ? [...revisado] : undefined,
        img: _img || imgV || undefined, cov: _cov || covV || undefined,
        lanzamiento, reserva: lanzamiento > HOY || j.ofertas.some((o) => /^Reserva/.test(o.condicion || "")) || undefined };
    });
  console.log(`Fechas de lanzamiento: ${lista.filter((j) => j.lanzamiento).length} de ${lista.length}; reservas: ${lista.filter((j) => j.reserva).length}; con imagen: ${lista.filter((j) => j.img || j.cov).length}`);
  const total = lista.reduce((s, j) => s + j.ofertas.length, 0);
  console.log("Ofertas por fuente:", JSON.stringify(cuenta));
  console.log("Primeros del catálogo:", lista.slice(0, 15).map((j) => j.titulo).join(" | "));
  if (avisos.length) console.warn(`Avisos (${avisos.length}):\n - ` + avisos.slice(0, 40).join("\n - "));
  if (total === 0) { console.error("No se ha conseguido ningún precio. No toco precios.json."); process.exit(1); }
  // Ofertas que se conservan de vueltas anteriores con una tienda de ITAD que esta vez no ha salido: la tienda se da de alta
  // igual (como revendedor de claves digitales), para que la web no la tome por una tienda física sin nombre
  const NOMBRES_ITAD = { "itad-dlgamer": "DLGamer" };
  for (const j of lista) for (const o of j.ofertas) if (!tiendas.some((t) => t.id === o.tienda) && o.tienda.startsWith("itad-"))
    tiendas.push({ id: o.tienda, nombre: NOMBRES_ITAD[o.tienda] || o.tienda.slice(5).replace(/^./, (c) => c.toUpperCase()), tipo: "revendedor", formatos: ["digital"] });
  const salida = { actualizado: new Date().toISOString(), ejemplo: false, revisadoV: 2, caidas: caidas.size ? [...caidas] : undefined, buscador: buscador || undefined, tiendas, packs: packs.filter((p) => !p.expira || Date.parse(p.expira) > Date.now()), juegos: lista };
  await writeFile(join(RAIZ, "precios.json"), JSON.stringify(salida) + "\n");
  console.log(`precios.json listo: ${lista.length} juegos, ${total} ofertas.`);
  // Historial diario (gráfica de la web) y precios mínimos (avisos por email)
  try { await guardarHistorial(RAIZ, lista, tiendas); } catch (e) { console.warn("Historial: " + e.message); }
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
