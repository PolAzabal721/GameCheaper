// Vuelve a pasar las fichas guardadas por la unión de repetidas (unificar.mjs) sin descargar precios:
// sirve para aplicar al momento una mejora de la unión en todas las regiones.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guardarPartes } from "./completar.mjs";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const archivo of ["precios.json", "precios-de.json", "precios-fr.json", "precios-pt.json", "precios-it.json", "precios-be.json", "precios-us.json", "precios-latam.json"]) {
  const ruta = join(RAIZ, archivo);
  if (!existsSync(ruta)) continue;
  const principal = JSON.parse(readFileSync(ruta, "utf8"));
  let juegos = principal.juegos || [];
  for (const p of principal.partes || []) if (existsSync(join(RAIZ, p))) juegos = juegos.concat(JSON.parse(readFileSync(join(RAIZ, p), "utf8")).juegos || []);
  const antes = juegos.length;
  const { partes, ...resto } = principal;
  guardarPartes(archivo, { ...resto, juegos });
  const ahora = JSON.parse(readFileSync(ruta, "utf8"));
  let total = (ahora.juegos || []).length; for (const p of ahora.partes || []) total += JSON.parse(readFileSync(join(RAIZ, p), "utf8")).juegos.length;
  console.log(`${archivo}: ${antes} → ${total} fichas`);
}
