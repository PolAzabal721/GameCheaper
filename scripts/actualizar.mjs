// Actualizador de precios de Pillao
// Uso: node scripts/actualizar.mjs        (Node 18 o superior, sin dependencias)
//
// Lee:   config/tiendas.json     -> tiendas que conoce la web
//        config/seguimiento.json -> juegos que quieres seguir
//        config/manual.json      -> ofertas que añades a mano (físico, Eneba, G2A, segunda mano…)
// Escribe: precios.json          -> lo que lee la web
//
// Fuentes automáticas (precios reales para España, en euros):
//   - Steam: buscador público de la tienda. Usa "steamAppId" si lo pones; si no, busca por título.
//   - Nintendo eShop: buscador de Nintendo Europa + API de precios de la eShop española.
//   - PlayStation Store: lee los resultados de búsqueda de la tienda española.
//   - IsThereAnyDeal (opcional): muchas tiendas digitales autorizadas de PC. Necesita ITAD_KEY.
// Si una fuente falla, se conservan las ofertas anteriores de esa fuente para no dejar huecos.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = async (ruta, porDefecto) => {
  try { return JSON.parse(await readFile(join(RAIZ, ruta), "utf8")); }
  catch (e) { if (porDefecto !== undefined) return porDefecto; throw new Error(`No pude leer ${ruta}: ${e.message}`); }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERAS = {
  "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/1.0; +https://github.com/PolAzabal721/GameCheaper)",
  "Accept-Language": "es-ES,es;q=0.9",
};
async function pedir(url, opciones = {}) {
  const r = await fetch(url, { ...opciones, headers: { ...CABECERAS, ...(opciones.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).host}`);
  return r;
}

// ---------- Comparar títulos ----------
const limpiar = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Palabras que indican que NO es el juego base
const EXTRAS = /\b(dlc|pack|pase|season pass|expansion|soundtrack|banda sonora|bundle|lote|monedas|coins|points|puntos|vbucks|upgrade|mejora|demo|trial|prueba)\b/;
function parecido(buscado, encontrado) {
  const a = limpiar(buscado), b = limpiar(encontrado);
  if (!a || !b) return 0;
  if (EXTRAS.test(b) && !EXTRAS.test(a)) return 0;
  if (a === b) return 1;
  const pa = new Set(a.split(" ")), pb = b.split(" ");
  const comunes = pb.filter((p) => pa.has(p)).length;
  if (comunes < pa.size) return 0;                 // tienen que estar todas las palabras buscadas
  return pa.size / pb.length;                       // cuantas menos palabras extra, mejor
}
const mejorCoincidencia = (titulo, lista, nombreDe, minimo = 0.5) => {
  let mejor = null, nota = minimo;
  for (const x of lista) { const n = parecido(titulo, nombreDe(x)); if (n > nota || (n === 1 && nota < 1)) { mejor = x; nota = n; } }
  return mejor;
};
const euros = (texto) => {
  if (typeof texto === "number") return texto;
  const m = String(texto).replace(/\s/g, "").match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
  return m ? parseFloat(m[1].replace(/\./g, "") + "." + (m[2] || "0")) : NaN;
};

// ---------- Fuente: Steam ----------
async function steam(juego) {
  if (!juego.plataformas.includes("PC")) return [];
  if (juego.steamAppId) {
    const d = await (await pedir(`https://store.steampowered.com/api/appdetails?appids=${juego.steamAppId}&cc=es&l=spanish&filters=price_overview`)).json();
    const p = d[juego.steamAppId]?.success && d[juego.steamAppId].data?.price_overview;
    if (!p || p.currency !== "EUR") return [];
    return [{ tienda: "steam", plataforma: "PC", formato: "digital", precio: p.final / 100, url: `https://store.steampowered.com/app/${juego.steamAppId}/` }];
  }
  const d = await (await pedir(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(juego.titulo)}&l=spanish&cc=ES`)).json();
  const item = mejorCoincidencia(juego.titulo, (d.items || []).filter((i) => i.price?.currency === "EUR"), (i) => i.name);
  if (!item) return [];
  return [{ tienda: "steam", plataforma: "PC", formato: "digital", precio: item.price.final / 100, url: `https://store.steampowered.com/app/${item.id}/` }];
}

// ---------- Fuente: Nintendo eShop ----------
async function eshop(juego) {
  const plats = juego.plataformas.filter((p) => p.startsWith("Switch"));
  if (!plats.length) return [];
  const url = `https://searching.nintendo-europe.com/es/select?q=${encodeURIComponent(juego.titulo)}&fq=type:GAME&rows=20&wt=json`;
  const docs = (await (await pedir(url)).json()).response?.docs || [];
  const candidatos = [];
  for (const plat of plats) {
    const deEsta = docs.filter((d) => {
      const sistemas = (d.system_names_txt || []).join(" ");
      const esS2 = /switch 2/i.test(sistemas) || /switch 2/i.test(d.title || "");
      return d.nsuid_txt?.length && (plat === "Switch 2" ? esS2 : !esS2);
    });
    const doc = mejorCoincidencia(juego.titulo, deEsta, (d) => String(d.title).replace(/[–-]\s*Nintendo Switch 2 Edition/i, ""));
    if (doc) candidatos.push({ plat, doc, nsuid: doc.nsuid_txt[0] });
  }
  if (!candidatos.length) return [];
  const ids = candidatos.map((c) => c.nsuid).join(",");
  const precios = (await (await pedir(`https://api.ec.nintendo.com/v1/price?country=ES&lang=es&ids=${ids}`)).json()).prices || [];
  return candidatos.map((c) => {
    const p = precios.find((x) => String(x.title_id) === String(c.nsuid));
    const valor = parseFloat(p?.discount_price?.raw_value ?? p?.regular_price?.raw_value);
    if (!p || !isFinite(valor) || p.regular_price?.currency !== "EUR") return null;
    // La "Nintendo Switch 2 Edition" a veces solo es el pack de mejora (~10 €), no el juego completo
    const regular = parseFloat(p.regular_price?.raw_value);
    if (c.plat === "Switch 2" && /switch 2 edition/i.test(c.doc.title || "") && regular < (juego.pvp || 60) * 0.4) return null;
    return {
      tienda: "eshop", plataforma: c.plat, formato: "digital", precio: valor,
      url: c.doc.url ? "https://www.nintendo.com" + c.doc.url : "https://www.nintendo.com/es-es/",
    };
  }).filter(Boolean);
}

// ---------- Fuente: PlayStation Store ----------
// La búsqueda de la PS Store carga con JavaScript y no trae precios, pero la ficha de cada juego
// ("concept") incluye un bloque estándar JSON-LD con el precio actual en euros.
// Cada juego necesita "psConcept": el número de su URL store.playstation.com/es-es/concept/XXXXX,
// o el código de producto de store.playstation.com/es-es/product/XXXXX. Puede ser una lista;
// se usa la primera ficha que funcione y cuyo nombre coincida con el juego.
async function psstore(juego) {
  const plat = juego.plataformas.find((p) => p === "PS5" || p === "PS4");
  if (!plat || !juego.psConcept) return [];
  const conceptos = [].concat(juego.psConcept);
  let ultimoError = null;
  for (const id of conceptos) {
    // Un número es una ficha "concept"; algo como EP0002-PPSA07950_00-XXXX es una ficha de producto
    const url = `https://store.playstation.com/es-es/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
    let html;
    try { html = await (await pedir(url)).text(); } catch (e) { ultimoError = e.message; continue; }
    const m = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) { ultimoError = "la ficha no trae el bloque de precio"; continue; }
    let ld; try { ld = JSON.parse(m[1]); } catch { ultimoError = "bloque de precio ilegible"; continue; }
    const oferta = [].concat(ld.offers || [])[0];
    // Comprobamos que la ficha es de este juego: tienen que aparecer todas las palabras del título
    const palabras = limpiar(juego.titulo).split(" "), nombre = " " + limpiar(ld.name || "") + " ";
    if (!palabras.every((p) => nombre.includes(" " + p + " "))) { ultimoError = `la ficha ${id} es de «${ld.name}»`; continue; }
    if (!oferta || oferta.priceCurrency !== "EUR" || !(oferta.price > 0)) { ultimoError = "sin precio en euros"; continue; }
    return [{ tienda: "psstore", plataforma: plat, formato: "digital", precio: Number(oferta.price), url }];
  }
  throw new Error(ultimoError || "sin datos");
}

// ---------- Fuente: IsThereAnyDeal (opcional) ----------
// Clave gratuita en isthereanydeal.com → guárdala como secreto ITAD_KEY en GitHub.
const ITAD = "https://api.isthereanydeal.com";
async function itad(juegos, tiendas) {
  const key = process.env.ITAD_KEY;
  if (!key) return null;
  const ids = {};
  for (const j of juegos) {
    if (!j.plataformas.includes("PC")) continue;
    if (j.itadId) { ids[j.itadId] = j; continue; }
    const d = await (await pedir(`${ITAD}/games/lookup/v1?key=${key}&title=${encodeURIComponent(j.titulo)}`)).json();
    if (d.found && d.game?.id) ids[d.game.id] = j;
    await esperar(250);
  }
  const lista = Object.keys(ids);
  if (!lista.length) return {};
  const r = await pedir(`${ITAD}/games/prices/v3?key=${key}&country=ES`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lista),
  });
  const porJuego = {};
  for (const g of await r.json()) {
    const j = ids[g.id]; if (!j) continue;
    porJuego[j.id] = (g.deals || []).filter((x) => x.price?.currency === "EUR").map((x) => {
      const id = "itad-" + String(x.shop?.name || x.shop?.id).toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (id === "itad-steam") return null; // Steam ya viene de su propia fuente
      if (!tiendas.some((t) => t.id === id)) tiendas.push({ id, nombre: x.shop?.name || id, tipo: "revendedor", formatos: ["digital"] });
      return { tienda: id, plataforma: "PC", formato: "digital", precio: x.price.amount, url: x.url };
    }).filter(Boolean);
  }
  return porJuego;
}

// ---------- Programa ----------
const FUENTES = { steam, eshop, psstore };

async function main() {
  const tiendas = await leer("config/tiendas.json");
  const seguimiento = await leer("config/seguimiento.json");
  const manual = await leer("config/manual.json", []);
  const anterior = await leer("precios.json", { juegos: [] });
  const viejas = Object.fromEntries((anterior.juegos || []).map((j) => [j.id, j.ofertas || []]));
  const conservar = (id, fuente) => (viejas[id] || []).filter((o) => o.fuente === fuente);
  const avisos = [];
  const cuenta = {};

  let deItad = null;
  try { deItad = await itad(seguimiento, tiendas); }
  catch (e) { avisos.push(`IsThereAnyDeal: ${e.message}`); deItad = "fallo"; }

  const juegos = [];
  for (const j of seguimiento) {
    const ofertas = [];
    for (const [nombre, fuente] of Object.entries(FUENTES)) {
      try {
        const nuevas = (await fuente(j)).map((o) => ({ estado: "nuevo", stock: true, ...o, fuente: nombre }));
        ofertas.push(...nuevas);
        cuenta[nombre] = (cuenta[nombre] || 0) + nuevas.length;
      } catch (e) {
        avisos.push(`${nombre} (${j.titulo}): ${e.message}`);
        ofertas.push(...conservar(j.id, nombre));
      }
      await esperar(400); // sin prisas, para no molestar a las tiendas
    }
    if (deItad === "fallo") ofertas.push(...conservar(j.id, "itad"));
    else if (deItad) ofertas.push(...(deItad[j.id] || []).map((o) => ({ estado: "nuevo", stock: true, ...o, fuente: "itad" })));
    for (const m of manual) if (m.juego === j.id) {
      const { juego, ...o } = m;
      const usado = o.estado === "usado";
      ofertas.push({ formato: usado ? "fisico" : "digital", estado: usado ? "usado" : "nuevo", stock: true, ...o, fuente: "manual" });
    }
    juegos.push({ id: j.id, titulo: j.titulo, plataformas: j.plataformas, pvp: j.pvp, ofertas });
  }

  const total = juegos.reduce((s, j) => s + j.ofertas.length, 0);
  console.log("Ofertas por fuente:", JSON.stringify(cuenta));
  if (avisos.length) console.warn("Avisos:\n - " + avisos.join("\n - "));
  if (total === 0) {
    console.error("No se ha conseguido ningún precio. No toco precios.json.");
    process.exit(1);
  }
  const salida = { actualizado: new Date().toISOString(), ejemplo: false, tiendas, juegos };
  await writeFile(join(RAIZ, "precios.json"), JSON.stringify(salida, null, 1) + "\n");
  console.log(`precios.json listo: ${juegos.length} juegos, ${total} ofertas.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
