// Canal de Telegram de chollos: después de cada actualización publica las bajadas fuertes de precio.
// Uso: TELEGRAM_BOT_TOKEN=… TELEGRAM_CANAL=@canal node scripts/telegram.mjs   (sin las dos variables no hace nada)
//
// Qué se publica (en cualquier tienda, salvo particulares, que no tienen «precio rebajado»):
//   - el precio ha BAJADO respecto a la actualización anterior (así no se anuncian ofertas que ya existían),
//   - y queda al menos un 50 % por debajo de su precio normal, o es su mínimo histórico con al menos un 30 % menos;
//   - solo juegos conocidos (los POPULARES primeros del catálogo), nuevos y con stock; ni tarjetas regalo ni DLC sueltos.
// Como mucho MAXIMO mensajes por actualización, y el mismo juego en la misma tienda no se repite en 7 días salvo que baje más.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const ENV = process.env;
const TOKEN = (ENV.TELEGRAM_BOT_TOKEN || "").trim(), CANAL = (ENV.TELEGRAM_CANAL || "").trim();
const POPULARES = +(ENV.TG_POPULARES || 2000), MAXIMO = ENV.TG_EJEMPLO ? 1 : +(ENV.TG_MAXIMO || 5), DIAS = 7;
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
    const ya = estado.publicados[clave(j, o)];
    if (ya && Date.now() - Date.parse(ya.fecha) < DIAS * 86400000 && p >= ya.precio - 0.01) continue;
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

let enviados = 0;
for (const { j, o, p, ref, dto, minimo } of elegidos) {
  const t = tienda[o.tienda] || { nombre: o.tienda };
  const texto = [
    `🔥 <b>${esc(j.titulo)}</b> · ${esc(o.plataforma || "")}`,
    `<s>${eur(ref)}</s> → <b>${eur(p)}</b> (−${Math.round(dto * 100)} %)${minimo ? " · 📉 Mínimo histórico" : ""}`,
    `🛒 ${esc(t.nombre)} · ${o.formato === "fisico" ? "Disco nuevo" : "Digital"}${o.envio ? ` (envío incluido)` : ""}`,
    `👉 <a href="${esc(enlace(o))}">Ver oferta</a>`,
    `🔎 <a href="${SITIO}?q=${encodeURIComponent(j.titulo)}">Compara todas las tiendas en Pillao</a>`,
  ].join("\n");
  try {
    const foto = imagen(j);
    if (foto) {
      try { await telegram("sendPhoto", { chat_id: CANAL, photo: foto, caption: texto, parse_mode: "HTML" }); }
      catch { await telegram("sendMessage", { chat_id: CANAL, text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } }); }
    } else await telegram("sendMessage", { chat_id: CANAL, text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    estado.publicados[clave(j, o)] = { precio: p, fecha: new Date().toISOString() };
    enviados++;
    console.log(`  publicado: ${j.titulo} · ${t.nombre} · ${eur(p)} (−${Math.round(dto * 100)} %)`);
  } catch (e) { console.warn(`  no se ha podido publicar «${j.titulo}»: ${e.message}`); if (/chat not found|not enough rights|bot was kicked|Unauthorized/i.test(e.message)) break; }
  await new Promise((r) => setTimeout(r, 3500)); // Telegram limita los mensajes seguidos a un canal
}
// Olvida lo publicado hace más de 7 días
for (const [k, v] of Object.entries(estado.publicados)) if (Date.now() - Date.parse(v.fecha) > DIAS * 86400000) delete estado.publicados[k];
if (!ENV.TG_EJEMPLO) await writeFile("data/telegram.json", JSON.stringify(estado) + "\n");
console.log(`Telegram: ${enviados} mensajes publicados en ${CANAL}.`);
