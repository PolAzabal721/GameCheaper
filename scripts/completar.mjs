// Lectura de precios.json para todos los scripts.
// 1. Partido en dos archivos para no pasar del límite de 100 MB de GitHub: precios.json (los más populares, con «parte2»)
//    y precios-2.json (el resto). Aquí se juntan.
// 2. Las ofertas se guardan sin los valores más comunes: sin «formato» es "digital", sin «estado» es "nuevo",
//    sin «stock» es true y sin «fuente» es la propia tienda. Aquí se reponen.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MAX_PARTE = 60e6;   // bytes por archivo: deja sitio de sobra hasta los 100 MB

export function completar(d, parte2) {
  // Varias partes («partes»: precios-de-2.json, precios-de-3.json…)
  if (d && Array.isArray(d.partes) && !d._juntado) {
    for (const nombre of d.partes) { try { const p = JSON.parse(readFileSync(join(RAIZ, nombre), "utf8")); if (p && Array.isArray(p.juegos)) d.juegos = (d.juegos || []).concat(p.juegos); } catch {} }
    d._juntado = true;
  }
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

// Guarda un catálogo en una o varias partes de como mucho MAX_PARTE bytes (GitHub no deja subir archivos de más de 100 MB):
// base.json (los más populares, con «partes») y base-2.json, base-3.json… Borra las partes que sobren de la vez anterior.
export const MAX_PARTES = 6;
export function guardarPartes(archivo, salida) {
  const base = archivo.replace(/\.json$/, "");
  const juegos = salida.juegos || [], trozos = [[]];
  let acum = JSON.stringify({ ...salida, juegos: [], partes: [] }).length + 200;
  for (const j of juegos) {
    const t = JSON.stringify(j).length + 1;
    if (acum + t > MAX_PARTE && trozos[trozos.length - 1].length) { trozos.push([]); acum = 50; }
    trozos[trozos.length - 1].push(j); acum += t;
  }
  if (trozos.length > MAX_PARTES) throw new Error(`${archivo}: harían falta ${trozos.length} partes (máximo ${MAX_PARTES})`);
  const partes = trozos.slice(1).map((_, i) => `${base}-${i + 2}.json`);
  const { _juntado, parte2, ...limpia } = salida;
  writeFileSync(join(RAIZ, archivo), JSON.stringify({ ...limpia, ...(partes.length ? { partes } : {}), juegos: trozos[0] }) + "\n");
  partes.forEach((nombre, i) => writeFileSync(join(RAIZ, nombre), JSON.stringify({ juegos: trozos[i + 1] }) + "\n"));
  for (let i = partes.length + 2; i <= MAX_PARTES + 1; i++) { const f = join(RAIZ, `${base}-${i}.json`); if (existsSync(f)) unlinkSync(f); }
  return [archivo, ...partes];
}
