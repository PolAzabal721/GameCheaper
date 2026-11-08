// Precios de PlayStation Store para el catálogo de Pillao
// Uso: node scripts/playstation.mjs     (Node 18+, sin dependencias)
//
// La PS Store no publica un índice de su catálogo y su API interna está vetada a programas en su robots.txt.
// Así que vamos juego a juego, solo por páginas públicas:
//   1. Descubrir: la página del juego en playstation.com (/es-es/games/<nombre>/) enlaza a su ficha de la tienda.
//      Respetamos su Crawl-delay de 5 segundos. Lo descubierto se guarda y no se vuelve a buscar.
//   2. Precio: la ficha de la tienda (store.playstation.com/es-es/concept/…) trae el precio en un bloque JSON-LD.
// Resultado: data/playstation.json, que el actualizador principal mezcla con el resto de precios.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV = process.env;
const DESCUBRIR = +(ENV.PS_DESCUBRIR || 150);   // juegos nuevos a buscar en cada ejecución
const PRECIOS = +(ENV.PS_PRECIOS || 300);       // fichas a las que se actualiza el precio en cada ejecución
const REINTENTAR_DIAS = 30;                      // si no encontramos un juego, volvemos a probar al mes
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const leer = async (ruta, porDefecto) => { try { return JSON.parse(await readFile(join(RAIZ, ruta), "utf8")); } catch { return porDefecto; } };
const limpiar = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function texto(url) {
  const r = await fetch(url, { headers: CABECERAS, redirect: "follow" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).host}`);
  return r.text();
}

// 1. Página del juego en playstation.com → números de ficha de la tienda
async function descubrir(titulo) {
  // Primero el título completo; si no existe, sin el subtítulo («Juego: Subtítulo» → «Juego»)
  const opciones = [titulo, titulo.split(/[:–-]\s/)[0]].map((t) => limpiar(t).replace(/ /g, "-")).filter((s, i, a) => s && a.indexOf(s) === i);
  let html = null;
  for (const slug of opciones) {
    html = await texto(`https://www.playstation.com/es-es/games/${slug}/`);
    if (html) break;
    if (opciones.length > 1) await esperar(5000);
  }
  if (!html) return [];
  const ids = new Set();
  for (const m of html.matchAll(/store\.playstation\.com\/(?:[a-z]{2}-[a-z]{2}\/)?concept\/(\d+)/g)) ids.add(m[1]);
  for (const m of html.matchAll(/"conceptId"\s*:\s*"?(\d+)/g)) ids.add(m[1]);
  // Fichas de producto europeas (EP…) como alternativa
  for (const m of html.matchAll(/store\.playstation\.com\/(?:[a-z]{2}-[a-z]{2}\/)?product\/(EP[A-Z0-9_-]+)/g)) ids.add(m[1]);
  return [...ids].slice(0, 4);
}

// 2. Ficha de la tienda → precio en euros para España
async function precio(titulo, id) {
  const url = `https://store.playstation.com/es-es/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
  const html = await texto(url);
  if (!html) return null;
  const m = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let ld; try { ld = JSON.parse(m[1]); } catch { return null; }
  const oferta = [].concat(ld.offers || [])[0];
  if (!oferta || oferta.priceCurrency !== "EUR" || !(oferta.price > 0)) return null;
  // La ficha tiene que ser de este juego: todas las palabras del título
  const nombre = " " + limpiar(ld.name || "") + " ";
  if (!limpiar(titulo).split(" ").every((p) => nombre.includes(" " + p + " "))) return null;
  const plats = (html.match(/"platforms"\s*:\s*\[([^\]]*)\]/) || [])[1] || "";
  const plataformas = ["PS5", "PS4"].filter((p) => plats.includes(`"${p}"`));
  return { precio: Number(oferta.price), plataformas: plataformas.length ? plataformas : ["PS5"], url };
}

async function main() {
  const catalogo = await leer("precios.json", { juegos: [] });
  const estado = await leer("data/playstation.json", { juegos: {} });
  const ahora = Date.now();
  const cuenta = { descubiertos: 0, sinFicha: 0, precios: 0, fallos: 0 };
  const avisos = [];

  // Candidatos a descubrir: primero los que ya sabemos que salen en PlayStation (GAME, Instant Gaming, eBay…),
  // luego los más populares. Saltamos los ya buscados (salvo los no encontrados hace más de un mes).
  const pendientes = catalogo.juegos.filter((j) => {
    const e = estado.juegos[j.id];
    return !e || (!e.ids?.length && ahora - Date.parse(e.buscado || 0) > REINTENTAR_DIAS * 86400000);
  }).sort((a, b) => {
    const pa = (a.plataformas || []).some((p) => /^PS/.test(p)) ? 0 : 1, pb = (b.plataformas || []).some((p) => /^PS/.test(p)) ? 0 : 1;
    return pa - pb || (a.pop || 99999) - (b.pop || 99999);
  }).slice(0, DESCUBRIR);

  for (const j of pendientes) {
    try {
      const ids = await descubrir(j.titulo);
      estado.juegos[j.id] = { titulo: j.titulo, ids, buscado: new Date().toISOString(), ofertas: estado.juegos[j.id]?.ofertas || [] };
      ids.length ? cuenta.descubiertos++ : cuenta.sinFicha++;
    } catch (e) { cuenta.fallos++; if (avisos.length < 10) avisos.push(`descubrir ${j.titulo}: ${e.message}`); }
    await esperar(5000); // Crawl-delay de playstation.com
  }

  // Precios: los que llevan más tiempo sin actualizar primero
  const conFicha = Object.entries(estado.juegos).filter(([, e]) => e.ids?.length)
    .sort((a, b) => Date.parse(a[1].actualizado || 0) - Date.parse(b[1].actualizado || 0)).slice(0, PRECIOS);
  for (const [, e] of conFicha) {
    let p = null;
    for (const id of e.ids) {
      try { p = await precio(e.titulo, id); } catch (err) { if (avisos.length < 10) avisos.push(`precio ${e.titulo}: ${err.message}`); }
      await esperar(400);
      if (p) break;
    }
    e.actualizado = new Date().toISOString();
    e.ofertas = p ? p.plataformas.map((plat) => ({ tienda: "psstore", plataforma: plat, formato: "digital", estado: "nuevo", stock: true, precio: p.precio, url: p.url, fuente: "psstore" })) : [];
    if (p) cuenta.precios++;
  }

  await mkdir(join(RAIZ, "data"), { recursive: true });
  await writeFile(join(RAIZ, "data/playstation.json"), JSON.stringify(estado) + "\n");
  const total = Object.values(estado.juegos).filter((e) => e.ofertas?.length).length;
  console.log("PlayStation:", JSON.stringify(cuenta), `| juegos con precio de PS Store: ${total}`);
  if (avisos.length) console.warn("Avisos:\n - " + avisos.join("\n - "));
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
