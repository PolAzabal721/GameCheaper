// Historial de precios y precios mínimos para los avisos por email
//
// - data/historial/NNN.json: por cada juego, un punto al día [fecha, más barato, más caro, medio].
//   Repartido en TROZOS ficheros para que la web solo descargue el trozo del juego que abres.
// - minimos.json: el precio nuevo más barato de cada juego ahora mismo (lo lee el buscador para mandar los avisos).
//
// Qué precios cuentan: nuevos, con stock, en las tiendas que la web enseña por defecto
// (de los revendedores de claves, solo Instant Gaming; el resto está desmarcado de serie).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const TROZOS = 128;
const MAX_DIAS = 1095; // tres años de historial por juego

// El mismo cálculo está en index.html (función trozoDe): si cambias uno, cambia el otro
export function trozoDe(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % TROZOS;
}
const nombreTrozo = (n) => String(n).padStart(3, "0") + ".json";
const r2 = (n) => Math.round(n * 100) / 100;

export function preciosQueCuentan(j, tiendaPorId) {
  return (j.ofertas || []).filter((o) => {
    if (!o.stock || o.estado === "usado") return false;
    const t = tiendaPorId[o.tienda];
    if (t && t.tipo === "revendedor" && o.tienda !== "instantgaming") return false;
    return o.precio > 0;
  }).map((o) => ({ total: o.precio + (o.envio || 0), tienda: o.tienda }));
}

export async function guardarHistorial(raiz, lista, tiendas, ahora = new Date()) {
  const tiendaPorId = Object.fromEntries(tiendas.map((t) => [t.id, t]));
  const dia = ahora.toISOString().slice(0, 10);
  const dir = join(raiz, "data", "historial");
  await mkdir(dir, { recursive: true });

  // 1. Leer los trozos anteriores
  const trozos = await Promise.all([...Array(TROZOS).keys()].map(async (n) => {
    try { return JSON.parse(await readFile(join(dir, nombreTrozo(n)), "utf8")); } catch { return {}; }
  }));

  // 2. El punto de hoy de cada juego (si ya había uno de hoy, se combina: el más barato del día, el más caro del día)
  const minimos = {};
  let puntos = 0;
  for (const j of lista) {
    const ps = preciosQueCuentan(j, tiendaPorId);
    if (!ps.length) continue;
    ps.sort((a, b) => a.total - b.total);
    const min = r2(ps[0].total), max = r2(ps[ps.length - 1].total), med = r2(ps.reduce((s, p) => s + p.total, 0) / ps.length);
    const nombreTienda = tiendaPorId[ps[0].tienda]?.nombre || ps[0].tienda;
    minimos[j.id] = [min, nombreTienda];
    const t = trozos[trozoDe(j.id)];
    const serie = t[j.id] || (t[j.id] = []);
    const ult = serie[serie.length - 1];
    if (ult && ult[0] === dia) serie[serie.length - 1] = [dia, Math.min(ult[1], min), Math.max(ult[2], max), med];
    else serie.push([dia, min, max, med]);
    if (serie.length > MAX_DIAS) serie.splice(0, serie.length - MAX_DIAS);
    puntos++;
  }

  // 3. Guardar
  await Promise.all(trozos.map((t, n) => writeFile(join(dir, nombreTrozo(n)), JSON.stringify(t))));
  await writeFile(join(raiz, "minimos.json"), JSON.stringify({ actualizado: ahora.toISOString(), p: minimos }) + "\n");
  console.log(`Historial: ${puntos} juegos con punto del ${dia}. minimos.json: ${Object.keys(minimos).length} juegos.`);
}
