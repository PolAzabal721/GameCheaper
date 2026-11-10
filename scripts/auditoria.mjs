// Repaso diario de todo el catálogo: busca huecos y errores sin que nadie tenga que mirar.
// Uso: node scripts/auditoria.mjs   (lee precios.json y data/, y comprueba una muestra de direcciones de verdad)
//
// Qué revisa:
//   1. Cobertura por tienda: juegos con pruebas de que esa tienda debería tenerlos y que aún no se han consultado.
//   2. Fotos: cuántos juegos no tienen, y si las direcciones que usamos siguen funcionando (muestra al azar).
//   3. Enlaces: una muestra de ofertas de cada tienda; si muchos dan error, esa tienda ha cambiado su web.
//   4. Afiliados: que los enlaces de Instant Gaming y G2A lleven nuestro código.
//   5. Precios raros: tarjetas de saldo lejos de su valor, precios imposibles, regiones que no valen en España.
//   6. Datos viejos: precios que llevan demasiado tiempo sin revisarse.
// Deja el informe en data/auditoria.json y en el resumen de la ejecución. Si hay problemas graves, termina en rojo.
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";

const ENV = process.env;
const MUESTRA = +(ENV.AUD_MUESTRA || 12);      // direcciones a comprobar por tienda
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-ES,es;q=0.9" };
const leer = async (r, d) => { try { return JSON.parse(await readFile(r, "utf8")); } catch { return d; } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const precios = await leer("precios.json", { juegos: [], tiendas: [] });
const ps = (await leer("data/playstation.json", { juegos: {} })).juegos;
const juegos = precios.juegos;
const tienda = Object.fromEntries((precios.tiendas || []).map((t) => [t.id, t]));
const graves = [], avisos = [], informe = {};

// ---------- 1. Cobertura ----------
const tiene = (j, t) => j.ofertas.some((o) => o.tienda === t);
const revisado = (j, t) => (j.revisado || []).includes(t);
const platOtra = (j, re, salvo) => j.ofertas.some((o) => re.test(o.plataforma || "") && o.tienda !== salvo);
const juegosReales = juegos.filter((j) => j.tipo !== "tarjeta");
const cobertura = {
  "instantgaming (clave digital)": juegosReales.filter((j) => !tiene(j, "instantgaming") && !revisado(j, "instantgaming")),
  "xbox (PC o Xbox)": juegosReales.filter((j) => (j.plataformas || []).some((p) => p === "PC" || /^Xbox/.test(p)) && !tiene(j, "xbox") && !revisado(j, "xbox")),
  "game (consola)": juegosReales.filter((j) => (j.plataformas || []).some((p) => p !== "PC") && !tiene(j, "game") && !revisado(j, "game")),
  "psstore (PS4 o PS5)": juegosReales.filter((j) => platOtra(j, /^PS/, "psstore") && !tiene(j, "psstore")),
  "ebay (consola, 2ª mano)": juegosReales.filter((j) => j.tipo !== "dlc" && (j.plataformas || []).some((p) => p !== "PC") && !tiene(j, "ebay") && !revisado(j, "ebay")),
};
informe.cobertura = {};
for (const [k, lista] of Object.entries(cobertura)) {
  informe.cobertura[k] = { pendientes: lista.length, ejemplos: lista.sort((a, b) => a.pop - b.pop).slice(0, 5).map((j) => j.titulo) };
  // Un juego muy popular sin consultar es un fallo de verdad, no una espera de turno
  const popular = lista.filter((j) => (j.pop || 99999) <= 300);
  if (popular.length > 25) avisos.push(`${k}: ${popular.length} juegos populares aún sin consultar (p. ej. ${popular.slice(0, 3).map((j) => j.titulo).join(", ")})`);
}
// PlayStation: separar «no lo venden» de «no hemos podido encontrar su ficha»
const sinFicha = cobertura["psstore (PS4 o PS5)"].filter((j) => { const e = ps[j.id]; return !e || !e.ids?.length; });
informe.playstation = { sinPrecio: cobertura["psstore (PS4 o PS5)"].length, sinFicha: sinFicha.length, fichasEncontradas: Object.values(ps).filter((e) => e.ids?.length).length };

// ---------- 2. Fotos ----------
const conFoto = (j) => !!(j.img || j.cov);
informe.fotos = {};
for (const tipo of ["juego", "edicion", "dlc", "tarjeta"]) {
  const l = juegos.filter((j) => (j.tipo || "juego") === tipo);
  informe.fotos[tipo] = tipo === "tarjeta"
    ? { total: l.length, nota: "las tarjetas llevan un dibujo hecho por la web" }
    : { total: l.length, con: l.filter(conFoto).length, porcentaje: pct(l.filter(conFoto).length, l.length) };
}
const popSinFoto = juegos.filter((j) => (j.pop || 99999) <= 500 && j.tipo !== "tarjeta" && !conFoto(j));
if (popSinFoto.length > 40) avisos.push(`fotos: ${popSinFoto.length} juegos populares sin foto (p. ej. ${popSinFoto.slice(0, 3).map((j) => j.titulo).join(", ")})`);

// ---------- 3 y 4. Direcciones de verdad (muestra) y afiliados ----------
const STEAM = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
const prefijos = precios.prefijos || [];
const larga = (u) => (typeof u === "string" && u[0] === "~" ? (prefijos[parseInt(u[1], 36)] || "") + u.slice(2) : u);
const urlFoto = (j) => {
  const v = larga(j.img || j.cov);
  if (!v) return null;
  if (v.startsWith("sc:")) return STEAM + v.slice(3) + "/capsule_616x353.jpg";
  if (v.startsWith("s:")) return STEAM + v.slice(2) + "/header.jpg";
  return v;
};
const alAzar = (lista, n) => [...lista].sort(() => Math.random() - 0.5).slice(0, n);
let pedidas = 0, sinRespuesta = 0;
async function responde(url) {
  pedidas++;
  try {
    const r = await fetch(url, { headers: CABECERAS, redirect: "follow" });
    return r.status;
  } catch (e) { sinRespuesta++; return 0; }
}
// Fotos: una muestra por cada forma de dirección
informe.fotosComprobadas = {};
const porTipoFoto = { "steam (antiguas)": [], "steam (nuevas)": [], nintendo: [], microsoft: [], otras: [] };
for (const j of juegos) {
  const v = larga(j.img || j.cov); if (!v) continue;
  const k = v.startsWith("s:") ? "steam (antiguas)" : v.startsWith("sc:") ? "steam (nuevas)" : /nintendo/.test(v) ? "nintendo" : /microsoft/.test(v) ? "microsoft" : "otras";
  porTipoFoto[k].push(j);
}
for (const [k, lista] of Object.entries(porTipoFoto)) {
  if (!lista.length) { informe.fotosComprobadas[k] = { total: 0 }; continue; }
  let mal = 0; const ejemplos = [];
  for (const j of alAzar(lista, MUESTRA)) {
    const u = urlFoto(j); if (!u) continue;
    const s = await responde(u);
    if (s !== 200) { mal++; if (ejemplos.length < 3) ejemplos.push(`${j.titulo} → ${s} ${u}`); }
    await esperar(150);
  }
  informe.fotosComprobadas[k] = { total: lista.length, probadas: Math.min(MUESTRA, lista.length), fallan: mal, ejemplos };
  if (mal > MUESTRA / 2) graves.push(`fotos de ${k}: fallan ${mal} de ${Math.min(MUESTRA, lista.length)} (${ejemplos[0] || ""})`);
}
// Enlaces de las ofertas, por tienda
const porTienda = {};
for (const j of juegos) for (const o of j.ofertas) (porTienda[o.tienda] = porTienda[o.tienda] || []).push({ j, o });
informe.enlaces = {}; informe.afiliados = {};
let sinAfiliado = 0;
for (const [t, lista] of Object.entries(porTienda)) {
  if (t.startsWith("itad-")) continue; // todos pasan por el mismo redirector
  let mal = 0, bloqueado = 0; const ejemplos = [];
  for (const { j, o } of alAzar(lista, Math.min(MUESTRA, 6))) {
    const u = larga(o.url);
    if (t === "instantgaming" && !/igr=gamer-681806/.test(u)) sinAfiliado++;
    const s = await responde(u);
    // 403 y 429: la tienda frena a los programas, no es que el enlace esté roto (en el navegador funciona)
    if (s === 403 || s === 429) bloqueado++;
    else if (s >= 400 || s === 0) { mal++; if (ejemplos.length < 3) ejemplos.push(`${j.titulo} → ${s}`); }
    await esperar(250);
  }
  const probadas = Math.min(MUESTRA, 6, lista.length);
  informe.enlaces[t] = { ofertas: lista.length, probadas, fallan: mal, bloqueados: bloqueado, ejemplos };
  if (probadas >= 3 && mal === probadas) graves.push(`${t}: fallan todos los enlaces probados (${ejemplos[0] || ""})`);
}
informe.afiliados = { instantGamingSinCodigo: sinAfiliado };
if (sinAfiliado) graves.push(`afiliados: ${sinAfiliado} enlaces de Instant Gaming sin tu código`);

// ---------- 5. Precios raros ----------
const raros = [];
for (const j of juegos) for (const o of j.ofertas) {
  if (!(o.precio > 0) || o.precio > 400) raros.push(`${j.titulo}: ${o.tienda} ${o.precio} €`);
  if (j.valor && (o.precio < j.valor * 0.5 || o.precio > j.valor * 1.3)) raros.push(`${j.titulo}: ${o.tienda} ${o.precio} € para una tarjeta de ${j.valor} €`);
  if (o.formato !== "fisico" && o.tienda !== "ebay" && /(estados unidos|united states|reino unido|turqu|latam|brasil|india|argentina|m[eé]xico|finlandia|francia)/i.test(o.condicion || "")) raros.push(`${j.titulo}: ${o.tienda} con región que no vale en España (${o.condicion})`);
}
informe.preciosRaros = { total: raros.length, ejemplos: raros.slice(0, 8) };
if (raros.length > 30) graves.push(`precios raros: ${raros.length} ofertas (p. ej. ${raros[0]})`);

// ---------- 6. Datos viejos ----------
const dias = (iso) => (Date.now() - Date.parse(iso)) / 86400000;
informe.actualizado = { precios: precios.actualizado, diasDesdeLaUltima: +dias(precios.actualizado).toFixed(2) };
if (dias(precios.actualizado) > 0.6) graves.push(`los precios llevan ${dias(precios.actualizado).toFixed(1)} días sin actualizarse`);

// ---------- Informe ----------
// Sin conexión no se puede juzgar ninguna tienda: se avisa y se quitan esos problemas
const sinRed = pedidas > 0 && sinRespuesta === pedidas;
if (sinRed) {
  for (let i = graves.length - 1; i >= 0; i--) if (/fallan|enlaces/.test(graves[i])) graves.splice(i, 1);
  avisos.push("no he podido comprobar ninguna dirección: sin conexión a Internet en esta ejecución");
}
informe.red = { comprobadas: pedidas, sinRespuesta, sinConexion: sinRed };

informe.resumen = {
  juegos: juegos.length,
  ofertas: juegos.reduce((s, j) => s + j.ofertas.length, 0),
  tiendas: Object.keys(porTienda).length,
  conFoto: pct(juegos.filter(conFoto).length, juegos.length) + " %",
};
informe.fecha = new Date().toISOString();
informe.graves = graves; informe.avisos = avisos;

const linea = (t) => console.log(t);
linea(`Repaso del catálogo (${informe.fecha.slice(0, 16).replace("T", " ")})`);
linea(`${informe.resumen.juegos} juegos · ${informe.resumen.ofertas} ofertas · ${informe.resumen.tiendas} tiendas · ${informe.resumen.conFoto} con foto`);
linea("Pendientes por tienda: " + Object.entries(informe.cobertura).map(([k, v]) => `${k} ${v.pendientes}`).join(", "));
linea("Fotos: " + Object.entries(informe.fotos).filter(([k]) => k !== "tarjeta").map(([k, v]) => `${k} ${v.porcentaje} %`).join(", "));
linea("Direcciones de fotos que fallan: " + Object.entries(informe.fotosComprobadas).map(([k, v]) => `${k} ${v.fallan || 0}/${v.probadas || 0}`).join(", "));
linea("Enlaces que fallan: " + Object.entries(informe.enlaces).map(([k, v]) => `${k} ${v.fallan}/${v.probadas}` + (v.bloqueados ? ` (${v.bloqueados} sin comprobar)` : "")).join(", "));
if (avisos.length) linea("AVISOS:\n - " + avisos.join("\n - "));
if (graves.length) linea("PROBLEMAS:\n - " + graves.join("\n - "));
if (!avisos.length && !graves.length) linea("Todo correcto.");

await mkdir("data", { recursive: true });
await writeFile("data/auditoria.json", JSON.stringify(informe, null, 1) + "\n");
if (ENV.GITHUB_STEP_SUMMARY) {
  const resumen = ["```", `Repaso del catálogo · ${informe.resumen.juegos} juegos · ${informe.resumen.ofertas} ofertas · ${informe.resumen.conFoto} con foto`,
    "Pendientes por tienda: " + Object.entries(informe.cobertura).map(([k, v]) => `${k} ${v.pendientes}`).join(", "),
    "Fotos: " + Object.entries(informe.fotos).filter(([k]) => k !== "tarjeta").map(([k, v]) => `${k} ${v.porcentaje} %`).join(", "),
    graves.length ? "PROBLEMAS:\n - " + graves.join("\n - ") : "Sin problemas graves.",
    avisos.length ? "AVISOS:\n - " + avisos.join("\n - ") : "", "```"].filter(Boolean).join("\n");
  await appendFile(ENV.GITHUB_STEP_SUMMARY, resumen + "\n");
}
for (const g of graves) console.log(`::error title=Repaso del catálogo::${g}`);
for (const a of avisos) console.log(`::warning title=Repaso del catálogo::${a}`);
if (graves.length) process.exit(1);
