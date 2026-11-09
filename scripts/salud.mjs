// Revisión de las fuentes de precios después de cada actualización.
// Avisa (y deja la ejecución en rojo, con lo que GitHub manda un correo) si una tienda deja de dar precios
// sin que se note: porque cambió su web, porque su buscador ya no encuentra ciertos nombres, etc.
//   1. Juegos testigo: juegos muy populares que cada tienda tiene que traer en cada ejecución.
//   2. Volumen: si una tienda trae menos del 40 % de los precios nuevos que trajo la última vez que estaba bien.
//   3. Fuentes caídas: las que el actualizador ha tenido que parar por errores.
import { readFile, writeFile, appendFile } from "node:fs/promises";

const leer = async (r, d) => { try { return JSON.parse(await readFile(r, "utf8")); } catch { return d; } };
const precios = await leer("precios.json", { juegos: [] });
const anterior = await leer("data/salud.json", { referencia: {} });
const grupo = (t) => (t.startsWith("itad-") ? "itad" : t);
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Los precios consultados en esta ejecución llevan la hora de esta ejecución (lo conservado lleva la suya, más antigua)
const horas = {};
for (const j of precios.juegos) for (const o of j.ofertas) horas[o.t] = (horas[o.t] || 0) + 1;
const ahora = Object.keys(horas).sort().pop();
const frescas = {};
for (const j of precios.juegos) for (const o of j.ofertas) if (o.t === ahora) frescas[grupo(o.tienda)] = (frescas[grupo(o.tienda)] || 0) + 1;

const TESTIGOS = [
  ["steam", "Hogwarts Legacy"], ["eshop", "Mario Kart World"], ["xbox", "Cyberpunk 2077"],
  ["instantgaming", "EA SPORTS FC 27"], ["game", "EA SPORTS FC 27"], ["itad", "Hogwarts Legacy"],
];
const problemas = [];
for (const [tienda, titulo] of TESTIGOS) {
  const j = precios.juegos.find((x) => norm(x.titulo) === norm(titulo));
  if (!j) { problemas.push(`«${titulo}» ha desaparecido del catálogo (testigo de ${tienda})`); continue; }
  if (!j.ofertas.some((o) => grupo(o.tienda) === tienda && o.t === ahora)) problemas.push(`${tienda}: no ha traído precio de «${titulo}» en esta ejecución`);
}
const referencia = { ...anterior.referencia };
for (const t of new Set([...Object.keys(referencia), ...Object.keys(frescas)])) {
  const ref = referencia[t] || 0, hoy = frescas[t] || 0;
  if (ref >= 20 && hoy < ref * 0.4) problemas.push(`${t}: ${hoy} precios nuevos (la última vez que estaba bien, ${ref})`);
  else if (hoy) referencia[t] = hoy; // solo se actualiza la referencia cuando la tienda está bien
}
for (const c of precios.caidas || []) problemas.push(`${c}: la fuente se ha parado por errores`);

const informe = [`Revisión de fuentes (${ahora})`, "Precios nuevos por tienda: " + Object.entries(frescas).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", "),
  problemas.length ? "PROBLEMAS:\n - " + problemas.join("\n - ") : "Todo bien."].join("\n");
console.log(informe);
await writeFile("data/salud.json", JSON.stringify({ revisado: ahora, referencia, problemas }, null, 1) + "\n");
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, "```\n" + informe + "\n```\n");
if (problemas.length && process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, "FUENTES_CON_PROBLEMAS=1\n");
for (const p of problemas) console.log(`::error title=Fuente de precios::${p}`);
