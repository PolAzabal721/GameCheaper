// Canal de Telegram de chollos: después de cada actualización publica las bajadas fuertes de precio.
// Uso: TELEGRAM_BOT_TOKEN=… TELEGRAM_CANAL=@canal node scripts/telegram.mjs   (sin las dos variables no hace nada)
//
// Qué se publica (en cualquier tienda, salvo particulares, que no tienen «precio rebajado»):
//   - el precio ha BAJADO respecto a la actualización anterior (así no se anuncian ofertas que ya existían),
//   - y queda al menos un 50 % por debajo de su precio normal, o es su mínimo histórico con al menos un 30 % menos;
//   - solo juegos conocidos (los POPULARES primeros del catálogo), nuevos y con stock; ni tarjetas regalo ni DLC sueltos.
// Como mucho MAXIMO mensajes por actualización, y un juego ya publicado no vuelve a salir en 15 días (en ninguna tienda, aunque baje más).
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tarjetaHTML } from "./tg-tarjeta.mjs";
import { execFileSync } from "node:child_process";

const ENV = process.env;
const TOKEN = (ENV.TELEGRAM_BOT_TOKEN || "").trim(), CANAL = (ENV.TELEGRAM_CANAL || "").trim();
const POPULARES = +(ENV.TG_POPULARES || 2000), MAXIMO = +(ENV.TG_MAXIMO || (ENV.TG_EJEMPLO ? 1 : 5)), DIAS = 15;
const SITIO = "https://pillaojuegos.com/";
if (!TOKEN || !CANAL) { console.log("Telegram: faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CANAL; no publico nada."); process.exit(0); }

const leer = async (r, d) => { try { return JSON.parse(await readFile(r, "utf8")); } catch { return d; } };
const ahora = await leer("precios.json", { juegos: [], tiendas: [] });
// La versión anterior de los precios es la del último commit (este paso va antes de guardar los nuevos)
let antes = { juegos: [] };
try { antes = ENV.TG_ANTES ? JSON.parse(await readFile(ENV.TG_ANTES, "utf8")) : JSON.parse(execFileSync("git", ["show", "HEAD:precios.json"], { maxBuffer: 1 << 30 }).toString()); } catch { console.log("Telegram: no hay versión anterior; no comparo."); process.exit(0); }
const estado = await leer("data/telegram.json", { publicados: {} });

const tienda = Object.fromEntries((ahora.tiendas || []).map((t) => [t.id, t]));
const total = (o) => o.precio + (o.envio || 0);
const clave = (j, o) => `${j.id}|${o.tienda}|${o.plataforma}|${o.formato}`;
const previo = new Map();
for (const j of antes.juegos) for (const o of j.ofertas) if (o.estado !== "usado") previo.set(clave(j, o), total(o));

// Días desde que se publicó por última vez cualquier oferta de ese juego (Infinity si nunca)
const ultimoPorJuego = new Map();
for (const [k, v] of Object.entries(estado.publicados || {})) {
  const id = k.split("|")[0], t = Date.parse(v.fecha);
  if (!(ultimoPorJuego.get(id) > t)) ultimoPorJuego.set(id, t);
}
const publicadoHace = (id) => (ultimoPorJuego.has(id) ? (Date.now() - ultimoPorJuego.get(id)) / 86400000 : Infinity);
const candidatos = [];
for (const j of ahora.juegos) {
  if ((j.pop || 99999) > POPULARES || j.tipo === "tarjeta" || j.tipo === "dlc") continue;
  if (ENV.TG_EJEMPLO && !(j.img || j.cov)) continue;
  for (const o of j.ofertas) {
    const t = tienda[o.tienda] || {};
    if (o.estado === "usado" || o.stock === false || t.tipo === "particulares") continue;
    const p = total(o), anterior = previo.get(clave(j, o));
    if (!ENV.TG_EJEMPLO && !(anterior > p + 0.01)) continue;    // tiene que haber BAJADO en esta actualización (salvo en la prueba)
    const ref = Math.max(j.pvp || 0, o.regular || 0);
    if (!(ref > p)) continue;
    const dto = 1 - p / ref, minimo = j.minimo && p <= j.minimo + 0.01;
    if (!(dto >= 0.5 || (minimo && dto >= 0.3))) continue;
    if (ref > p * 6) continue;                                  // un «precio normal» 6 veces mayor es un dato erróneo
    if (publicadoHace(j.id) < DIAS) continue;               // el mismo juego no se repite en 15 días
    candidatos.push({ j, o, p, ref, dto, minimo, nota: dto * 100 + (minimo ? 15 : 0) + Math.max(0, 20 - (j.pop || 99999) / 100) });
  }
}
// Lo mejor primero, y un solo mensaje por juego (su mejor oferta)
candidatos.sort((a, b) => b.nota - a.nota);
const vistos = new Set(), elegidos = [];
for (const c of candidatos) { if (vistos.has(c.j.id)) continue; vistos.add(c.j.id); elegidos.push(c); if (elegidos.length >= MAXIMO) break; }
console.log(`Telegram: ${candidatos.length} bajadas que cumplen; publico ${elegidos.length}.`);

const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const imagen = (j) => {
  const u = j.img || j.cov;
  if (!u) return null;
  if (u.startsWith("sc:")) return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${u.slice(3)}`;
  if (u.startsWith("s:")) return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${u.slice(2)}/header.jpg`;
  return /^https:\/\//.test(u) ? u : null;
};
// Todos los enlaces a Instant Gaming y G2A salen con nuestro código de afiliado (si traen otro, se cambia por el nuestro)
const enlace = (o) => {
  let u; try { u = new URL(o.url); } catch { return o.url; }
  if (/(^|\.)instant-gaming\.com$/.test(u.hostname)) u.searchParams.set("igr", "gamer-681806");
  else if (/(^|\.)g2a\.com$/.test(u.hostname)) u.searchParams.set("gname", "reflink-ad5993112c");
  else return o.url;
  return u.toString();
};

async function telegram(metodo, datos) {
  if (ENV.TG_PRUEBA) { console.log(`--- ${metodo}${datos.photo ? " (foto: " + datos.photo + ")" : ""}\n${datos.caption || datos.text}`); return; }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(`Telegram ${metodo}: ${d.description || r.status}`);
}

// La imagen de Pillao de cada chollo (tg-tarjeta.mjs), hecha con Playwright; si no se puede, va la foto del juego tal cual
const LOGOS = await leer("config/logos.json", {});
let navegador = null;
try { const { chromium } = await import("playwright"); navegador = await chromium.launch(); } catch (e) { console.log("Telegram: sin navegador para las imágenes (" + e.message.split("\n")[0] + "); van las fotos de las tiendas."); }
let fuentes = "";
try {
  fuentes = (await readFile("fonts/fuentes.css", "utf8")).replace(/url\(([a-z0-9]+\.woff2)\)/g, (m, f) => { try { return `url(data:font/woff2;base64,${execFileSync("base64", ["-w0", "fonts/" + f]).toString()})`; } catch { return m; } });
} catch {}
const comoDato = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Pillao/2.0; +https://pillaojuegos.com)" } });
  if (!r.ok) throw new Error("imagen " + r.status);
  const tipo = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  return `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
};
async function tarjeta(j, o, p, ref, minimo, nombre) {
  if (!navegador || !imagen(j)) return null;
  try {
    const dom = LOGOS[o.tienda];
    const logo = dom && existsSync(`logos/${dom}.png`) ? `data:image/png;base64,${(await readFile(`logos/${dom}.png`)).toString("base64")}` : "";
    const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    await pagina.setContent(tarjetaHTML({ titulo: j.titulo, plataforma: o.plataforma, formato: o.formato, antes: ref, precio: p, tienda: nombre, logo, arte: await comoDato(imagen(j)), minimo, fuentes }), { waitUntil: "load" });
    await pagina.waitForTimeout(300);
    const png = await pagina.screenshot({ type: "png" });
    await pagina.close();
    return png;
  } catch (e) { console.warn(`  imagen de «${j.titulo}»: ${e.message}`); return null; }
}
async function enviarFoto(png, datos) {
  if (ENV.TG_PRUEBA) { await writeFile(`tg-prueba-${Date.now()}.png`, png); console.log(`--- sendPhoto (imagen de Pillao)\n${datos.caption}`); return; }
  const fd = new FormData();
  for (const [k, v] of Object.entries(datos)) fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
  fd.append("photo", new Blob([png], { type: "image/png" }), "chollo.png");
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: "POST", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(`Telegram sendPhoto: ${d.description || r.status}`);
}
const etiqueta = (s) => "#" + String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "");

let enviados = 0;
for (const { j, o, p, ref, dto, minimo } of elegidos) {
  const t = tienda[o.tienda] || { nombre: o.tienda };
  // Lo que cuesta en una tienda oficial de la misma plataforma, para que se vea que es un chollo de verdad
  const oficial = j.ofertas.filter((x) => x.plataforma === o.plataforma && x.tienda !== o.tienda && x.estado !== "usado" && (tienda[x.tienda] || {}).tipo === "oficial" && total(x) > p + 0.5)
    .sort((a, b) => total(a) - total(b))[0];
  const texto = [
    `🔥 <b>${esc(j.titulo)}</b> por <b>${eur(p)}</b> en ${esc(t.nombre)}`,
    `💸 −${Math.round(dto * 100)} % · te ahorras ${eur(ref - p)}${o.envio ? " (envío incluido)" : ""}`,
    minimo ? "📉 Su precio más bajo hasta ahora" : "",
    oficial ? `📊 En ${esc((tienda[oficial.tienda] || {}).nombre || oficial.tienda)} cuesta ${eur(total(oficial))}` : "",
    "",
    [etiqueta(o.plataforma || "PC"), etiqueta(t.nombre), "#chollo"].join(" "),
  ].filter((l, i, a) => l || (i > 0 && a[i - 1])).join("\n");
  const botones = { inline_keyboard: [[{ text: `🛒 Ver oferta en ${t.nombre}`, url: enlace(o) }], [{ text: "🔎 Comparar precios en Pillao", url: `${SITIO}?q=${encodeURIComponent(j.titulo)}` }]] };
  try {
    const png = await tarjeta(j, o, p, ref, minimo, t.nombre);
    const foto = imagen(j);
    let hecho = false;
    // Un corte de conexión al subir la imagen no puede dejar el chollo sin foto: hasta 3 intentos, con una pausa entre ellos
    if (png) for (let intento = 1; intento <= 3 && !hecho; intento++) {
      try { await enviarFoto(png, { chat_id: CANAL, caption: texto, parse_mode: "HTML", reply_markup: botones }); hecho = true; }
      catch (e) { console.warn(`  imagen de «${j.titulo}», intento ${intento}: ${e.message}`); await new Promise((r) => setTimeout(r, 4000 * intento)); }
    }
    if (!hecho && foto) for (let intento = 1; intento <= 2 && !hecho; intento++) {
      try { await telegram("sendPhoto", { chat_id: CANAL, photo: foto, caption: texto, parse_mode: "HTML", reply_markup: botones }); hecho = true; }
      catch (e) { console.warn(`  foto de la tienda de «${j.titulo}», intento ${intento}: ${e.message}`); await new Promise((r) => setTimeout(r, 4000)); }
    }
    if (!hecho) await telegram("sendMessage", { chat_id: CANAL, text: texto, parse_mode: "HTML", reply_markup: botones, link_preview_options: { is_disabled: true } });
    estado.publicados[clave(j, o)] = { precio: p, fecha: new Date().toISOString() };
    enviados++;
    console.log(`  publicado: ${j.titulo} · ${t.nombre} · ${eur(p)} (−${Math.round(dto * 100)} %)`);
  } catch (e) { console.warn(`  no se ha podido publicar «${j.titulo}»: ${e.message}`); if (/chat not found|not enough rights|bot was kicked|Unauthorized/i.test(e.message)) break; }
  await new Promise((r) => setTimeout(r, 3500)); // Telegram limita los mensajes seguidos a un canal
}
if (navegador) await navegador.close();
// Olvida lo publicado hace más de 15 días
for (const [k, v] of Object.entries(estado.publicados)) if (Date.now() - Date.parse(v.fecha) > DIAS * 86400000) delete estado.publicados[k];
if (!ENV.TG_EJEMPLO || ENV.TG_GUARDAR === "1") await writeFile("data/telegram.json", JSON.stringify(estado) + "\n");
console.log(`Telegram: ${enviados} mensajes publicados en ${CANAL}.`);
