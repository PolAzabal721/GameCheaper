// Lectura de precios.json para todos los scripts.
// 1. Partido en dos archivos para no pasar del límite de 100 MB de GitHub: precios.json (los más populares, con «parte2»)
//    y precios-2.json (el resto). Aquí se juntan.
// 2. Las ofertas se guardan sin los valores más comunes: sin «formato» es "digital", sin «estado» es "nuevo",
//    sin «stock» es true y sin «fuente» es la propia tienda. Aquí se reponen.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MAX_PARTE = 60e6;   // bytes por archivo: deja sitio de sobra hasta los 100 MB

export function completar(d, parte2) {
  if (d && d.parte2 && !d._juntado) {
    try { const p = parte2 !== undefined ? parte2 : JSON.parse(readFileSync(join(RAIZ, d.parte2), "utf8")); if (p && Array.isArray(p.juegos)) d.juegos = (d.juegos || []).concat(p.juegos); } catch {}
    d._juntado = true;
  }
  for (const j of (d && d.juegos) || []) for (const o of j.ofertas || []) {
    if (o.formato === undefined) o.formato = "digital";
    if (o.estado === undefined) o.estado = "nuevo";
    if (o.stock === undefined) o.stock = true;
    if (!o.fuente) o.fuente = o.tienda;
  }
  return d;
}
export function compactar(o) {
  const r = { ...o };
  if (r.fuente === r.tienda) delete r.fuente;
  if (r.formato === "digital") delete r.formato;
  if (r.estado === "nuevo") delete r.estado;
  if (r.stock === true) delete r.stock;
  return r;
}
// Reparte los juegos (ya en orden de popularidad) entre precios.json y precios-2.json
export function partir(salida) {
  const juegos = salida.juegos, tam = juegos.map((j) => JSON.stringify(j).length + 1);
  let acum = JSON.stringify({ ...salida, juegos: [] }).length, corte = juegos.length;
  for (let i = 0; i < juegos.length; i++) { acum += tam[i]; if (acum > MAX_PARTE) { corte = i; break; } }
  if (corte >= juegos.length) return { principal: salida, segunda: { juegos: [] } };
  return { principal: { ...salida, parte2: "precios-2.json", juegos: juegos.slice(0, corte) }, segunda: { juegos: juegos.slice(corte) } };
}
