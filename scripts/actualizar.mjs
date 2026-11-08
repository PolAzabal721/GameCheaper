// Actualizador de precios de Pillao
// Uso: node scripts/actualizar.mjs        (Node 18 o superior, sin dependencias)
//
// Lee:   config/tiendas.json     -> tiendas que conoce la web
//        config/seguimiento.json -> juegos que quieres seguir
//        config/manual.json      -> ofertas que añades a mano (físico, Eneba, G2A…)
// Escribe: precios.json          -> lo que lee la web
//
// Fuentes automáticas:
//   - Steam: API pública de la tienda, precio en euros para España. Necesita "steamAppId" en el juego.
//   - IsThereAnyDeal (opcional): muchas tiendas digitales autorizadas. Necesita la variable ITAD_KEY.
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
const UA = { "User-Agent": "Pillao-comparador/1.0" };

// ---------- Fuente: Steam ----------
async function steam(juego) {
  if (!juego.steamAppId || !juego.plataformas.includes("PC")) return [];
  const url = `https://store.steampowered.com/api/appdetails?appids=${juego.steamAppId}&cc=es&l=spanish&filters=price_overview`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`Steam HTTP ${r.status}`);
  const d = (await r.json())[juego.steamAppId];
  const p = d?.success && d.data?.price_overview;
  if (!p || p.currency !== "EUR") return [];
  return [{
    tienda: "steam", plataforma: "PC", formato: "digital", stock: true, fuente: "steam",
    precio: p.final / 100,
    url: `https://store.steampowered.com/app/${juego.steamAppId}/`,
  }];
}

// ---------- Fuente: IsThereAnyDeal (opcional) ----------
// Pide una clave gratuita en isthereanydeal.com (sección de apps/API) y guárdala como ITAD_KEY.
// Comprueba los endpoints en la documentación oficial si algo cambia.
const ITAD = "https://api.isthereanydeal.com";
async function itad(juegos, tiendas) {
  const key = process.env.ITAD_KEY;
  if (!key) return null;
  const ids = {};
  for (const j of juegos) {
    if (!j.plataformas.includes("PC")) continue;
    if (j.itadId) { ids[j.itadId] = j; continue; }
    const r = await fetch(`${ITAD}/games/lookup/v1?key=${key}&title=${encodeURIComponent(j.titulo)}`, { headers: UA });
    if (!r.ok) throw new Error(`ITAD lookup HTTP ${r.status}`);
    const d = await r.json();
    if (d.found && d.game?.id) ids[d.game.id] = j;
    await esperar(250);
  }
  const lista = Object.keys(ids);
  if (!lista.length) return {};
  const r = await fetch(`${ITAD}/games/prices/v3?key=${key}&country=ES`, {
    method: "POST", headers: { ...UA, "Content-Type": "application/json" }, body: JSON.stringify(lista),
  });
  if (!r.ok) throw new Error(`ITAD prices HTTP ${r.status}`);
  const porJuego = {};
  for (const g of await r.json()) {
    const j = ids[g.id]; if (!j) continue;
    porJuego[j.id] = (g.deals || []).filter((x) => x.price?.currency === "EUR").map((x) => {
      const id = "itad-" + String(x.shop?.name || x.shop?.id).toLowerCase().replace(/[^a-z0-9]+/g, "");
      // Steam ya viene de su propia fuente
      if (/^itad-steam$/.test(id)) return null;
      if (!tiendas.some((t) => t.id === id)) tiendas.push({ id, nombre: x.shop?.name || id, tipo: "revendedor", formatos: ["digital"] });
      return { tienda: id, plataforma: "PC", formato: "digital", precio: x.price.amount, stock: true, url: x.url, fuente: "itad" };
    }).filter(Boolean);
  }
  return porJuego;
}

// ---------- Programa ----------
async function main() {
  const tiendas = await leer("config/tiendas.json");
  const seguimiento = await leer("config/seguimiento.json");
  const manual = await leer("config/manual.json", []);
  const anterior = await leer("precios.json", { juegos: [] });
  const viejas = Object.fromEntries((anterior.juegos || []).map((j) => [j.id, j.ofertas || []]));
  const conservar = (id, fuente) => (viejas[id] || []).filter((o) => o.fuente === fuente);
  const errores = [];

  let deItad = null;
  try { deItad = await itad(seguimiento, tiendas); }
  catch (e) { errores.push(`IsThereAnyDeal: ${e.message}`); deItad = "fallo"; }

  const juegos = [];
  for (const j of seguimiento) {
    const ofertas = [];
    try { ofertas.push(...await steam(j)); }
    catch (e) { errores.push(`Steam (${j.titulo}): ${e.message}`); ofertas.push(...conservar(j.id, "steam")); }
    if (deItad === "fallo") ofertas.push(...conservar(j.id, "itad"));
    else if (deItad) ofertas.push(...(deItad[j.id] || []));
    for (const m of manual) if (m.juego === j.id) {
      const { juego, ...o } = m;
      const usado = o.estado === "usado";
      ofertas.push({ formato: usado ? "fisico" : "digital", estado: usado ? "usado" : "nuevo", stock: true, ...o, fuente: "manual" });
    }
    juegos.push({ id: j.id, titulo: j.titulo, plataformas: j.plataformas, pvp: j.pvp, ofertas });
    await esperar(300); // no saturar a Steam
  }

  const salida = { actualizado: new Date().toISOString(), ejemplo: false, tiendas, juegos };
  await writeFile(join(RAIZ, "precios.json"), JSON.stringify(salida, null, 1) + "\n");
  const total = juegos.reduce((s, j) => s + j.ofertas.length, 0);
  console.log(`precios.json listo: ${juegos.length} juegos, ${total} ofertas.`);
  if (errores.length) { console.warn("Avisos:\n - " + errores.join("\n - ")); }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
