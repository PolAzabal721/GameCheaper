// Vídeos verticales (TikTok / Reels) con los chollos que se han publicado en Telegram el último día.
// Uso: node scripts/videos.mjs        (necesita ffmpeg y Playwright; en GitHub Actions ya están)
//
// Hace un vídeo por chollo (hasta VIDEOS_MAX), de unos 13 segundos y 1080x1920, con la imagen del juego,
// el precio de antes tachado, el de ahora, el descuento y la tienda. Sin música: así cada quien le pone
// el audio de moda al publicarlo, que es lo que más ayuda en TikTok y en Reels.
// Los deja en videos/ y escribe videos/index.json con los datos de cada uno.
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { createRequire } from "node:module";
// Playwright se busca donde esté instalado (en GitHub Actions, en la carpeta del proyecto)
const require_ = createRequire(import.meta.url);
const { chromium } = require_(process.env.PLAYWRIGHT_RUTA || "playwright");

const ejecutar = promisify(execFile);
const ENV = process.env;
const MAX = +(ENV.VIDEOS_MAX || 5);
const HORAS = +(ENV.VIDEOS_HORAS || 26);       // chollos publicados en las últimas horas
const GUARDAR = +(ENV.VIDEOS_GUARDAR || 15);   // vídeos que se conservan en la carpeta
const SITIO = "pillaojuegos.com";
const CANAL = "@pillaoChollos";
const leer = async (r, d) => { try { return JSON.parse(await readFile(r, "utf8")); } catch { return d; } };

const precios = await leer("precios.json", { juegos: [], tiendas: [] });
const estado = await leer("data/telegram.json", { publicados: {} });
const tienda = Object.fromEntries((precios.tiendas || []).map((t) => [t.id, t]));
const porId = new Map(precios.juegos.map((j) => [j.id, j]));

// 1. Qué chollos salen: los publicados en Telegram hace poco, el mayor descuento primero
const chollos = [];
for (const [clave, v] of Object.entries(estado.publicados || {})) {
  if (Date.now() - Date.parse(v.fecha) > HORAS * 3600000) continue;
  const [id, idTienda, plataforma, formato] = clave.split("|");
  const j = porId.get(id); if (!j) continue;
  const o = j.ofertas.find((x) => x.tienda === idTienda && (x.plataforma || "") === plataforma && (x.formato || "digital") === formato);
  if (!o) continue;
  const ref = Math.max(j.pvp || 0, o.regular || 0), p = o.precio + (o.envio || 0);
  if (!(ref > p)) continue;
  chollos.push({ j, o, precio: p, antes: ref, dto: Math.round((1 - p / ref) * 100), minimo: j.minimo && p <= j.minimo + 0.01,
    nombre: (tienda[o.tienda] || {}).nombre || o.tienda });
}
chollos.sort((a, b) => b.dto - a.dto);
const elegidos = chollos.slice(0, MAX);
console.log(`Chollos de las últimas ${HORAS} h: ${chollos.length}; hago vídeo de ${elegidos.length}.`);
if (!elegidos.length) { console.log("Nada que contar hoy."); process.exit(0); }

// 2. La imagen de cada juego (si no hay, un fondo de color)
const STEAM = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
const urlImagen = (j) => {
  const v = j.img || j.cov;
  if (!v) return null;
  if (v.startsWith("sc:")) return STEAM + v.slice(3) + "/capsule_616x353.jpg";
  if (v.startsWith("s:")) return STEAM + v.slice(2) + "/header.jpg";
  return /^https:\/\//.test(v) ? v : null;
};
await mkdir("tmp-videos", { recursive: true });
for (const c of elegidos) {
  const u = urlImagen(c.j);
  if (!u) continue;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Pillao/2.0; +https://pillaojuegos.com)" } });
    if (!r.ok) continue;
    const f = join("tmp-videos", `img-${c.j.id.slice(0, 40)}.jpg`);
    await writeFile(f, Buffer.from(await r.arrayBuffer()));
    c.imagen = "file://" + join(process.cwd(), f);
  } catch { /* sin imagen: fondo de color */ }
}

// 3. Las tres pantallas de cada vídeo
const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fuentes = "file://" + join(process.cwd(), "fonts", "fuentes.css");
function pantalla(c, n) {
  const fondo = c.imagen
    ? `<div class="fondo" style="background-image:url('${c.imagen}')"></div>`
    : `<div class="fondo liso"></div>`;
  const arte = c.imagen ? `<div class="arte" style="background-image:url('${c.imagen}')"></div>` : `<div class="arte liso"></div>`;
  const cuerpo = n === 0 ? `
      <div class="cinta">CHOLLO DE HOY</div>
      ${arte}
      <h1>${esc(c.j.titulo)}</h1>
      <div class="plat">${esc(c.o.plataforma || "")} · ${esc(c.o.formato === "fisico" ? "En disco" : "Digital")}</div>`
    : n === 1 ? `
      ${arte}
      <h1 class="chico">${esc(c.j.titulo)}</h1>
      <div class="precios"><s>${eur(c.antes)}</s><b>${eur(c.precio)}</b></div>
      <div class="dto">−${c.dto} %</div>
      ${c.minimo ? '<div class="minimo">MÍNIMO HISTÓRICO</div>' : ""}
      <div class="tienda">en ${esc(c.nombre)}</div>`
    : `
      <div class="logo"><span>€</span>Pillao</div>
      <h1 class="chico">${esc(c.j.titulo)}</h1>
      <div class="precios"><b>${eur(c.precio)}</b></div>
      <div class="cta">Compáralo en <b>${SITIO}</b></div>
      <div class="canal">Más chollos cada día en Telegram ${CANAL}</div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><link rel="stylesheet" href="${fuentes}">
<style>
  *{box-sizing:border-box;margin:0}
  html,body{width:1080px;height:1920px;overflow:hidden;background:#0e1120;color:#e8ebf6;font-family:"Figtree",sans-serif}
  .fondo{position:absolute;inset:-80px;background-size:cover;background-position:center;filter:blur(60px) saturate(1.4) brightness(.55)}
  .fondo.liso,.arte.liso{background:linear-gradient(140deg,#1b2140,#3b1d8f 45%,#0e7490)}
  .capa{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,17,32,.35),rgba(14,17,32,.9))}
  .todo{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;padding:110px 80px;text-align:center}
  .cinta{background:#ffd23f;color:#1d1600;font-weight:800;font-size:46px;letter-spacing:.08em;padding:18px 44px;border-radius:18px;transform:rotate(-2deg)}
  .arte{width:860px;height:492px;border-radius:32px;background-size:cover;background-position:center;box-shadow:0 30px 80px rgba(0,0,0,.55)}
  h1{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:82px;line-height:1.08;letter-spacing:-.02em}
  h1.chico{font-size:62px;opacity:.95}
  .plat{font-size:42px;color:#98a0bf;font-weight:600}
  .precios{display:flex;align-items:baseline;gap:34px;justify-content:center;flex-wrap:wrap}
  .precios s{font-size:62px;color:#98a0bf}
  .precios b{font-family:"Bricolage Grotesque",sans-serif;font-size:150px;color:#ffd23f;line-height:1}
  .dto{background:#4fd18b;color:#06301c;font-weight:800;font-size:66px;padding:14px 40px;border-radius:20px}
  .minimo{background:#ffd23f;color:#1d1600;font-weight:800;font-size:44px;padding:14px 34px;border-radius:16px;letter-spacing:.04em}
  .tienda{font-size:50px;color:#e8ebf6;font-weight:700}
  .logo{display:flex;align-items:center;gap:22px;font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:96px}
  .logo span{background:#ffd23f;color:#1d1600;border-radius:22px;padding:6px 28px 14px;transform:rotate(-4deg)}
  .cta{font-size:58px;line-height:1.3}.cta b{color:#ffd23f}
  .canal{font-size:40px;color:#98a0bf}
</style></head><body>${fondo}<div class="capa"></div><div class="todo">${cuerpo}</div></body></html>`;
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
await mkdir("videos", { recursive: true });
const hoy = new Date().toISOString().slice(0, 10);
const hechos = [];
for (let i = 0; i < elegidos.length; i++) {
  const c = elegidos[i];
  const pngs = [];
  for (let n = 0; n < 3; n++) {
    await pagina.setContent(pantalla(c, n), { waitUntil: "load" });
    await pagina.waitForTimeout(250);
    const f = join("tmp-videos", `p-${i}-${n}.png`);
    await pagina.screenshot({ path: f });
    pngs.push(f);
  }
  // Cada pantalla con un zoom lento y un fundido entre ellas
  const salida = join("videos", `${hoy}-${i + 1}.mp4`);
  const dur = [4, 5.5, 4];
  const args = [];
  pngs.forEach((f, n) => args.push("-loop", "1", "-t", String(dur[n] + 1), "-i", f));
  const filtros = pngs.map((_, n) =>
    `[${n}:v]scale=1188:2112,zoompan=z='min(zoom+0.0006,1.10)':d=${Math.round((dur[n] + 1) * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,setsar=1[v${n}]`);
  filtros.push(`[v0][v1]xfade=transition=fade:duration=0.5:offset=${dur[0] - 0.5}[a]`);
  filtros.push(`[a][v2]xfade=transition=fade:duration=0.5:offset=${dur[0] + dur[1] - 1}[v]`);
  await ejecutar("ffmpeg", ["-y", ...args, "-filter_complex", filtros.join(";"), "-map", "[v]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
    "-t", String(dur[0] + dur[1] + dur[2] - 1), "-movflags", "+faststart", salida], { maxBuffer: 1 << 28 });
  hechos.push({ archivo: salida.replace(/\\/g, "/"), juego: c.j.titulo, precio: c.precio, antes: c.antes, dto: c.dto,
    tienda: c.nombre, plataforma: c.o.plataforma || "", minimo: !!c.minimo, url: `https://${SITIO}/?q=${encodeURIComponent(c.j.titulo)}` });
  console.log(`  ${salida} · ${c.j.titulo} · ${eur(c.precio)} (−${c.dto} %)`);
}
await navegador.close();
await rm("tmp-videos", { recursive: true, force: true });

// 4. Una página sencilla para descargarlos desde el móvil
const paginaLista = (lista) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Vídeos de hoy | Pillao</title>
<meta name="robots" content="noindex"><link rel="icon" href="../favicon.svg" type="image/svg+xml">
<style>body{margin:0;background:#0e1120;color:#e8ebf6;font-family:system-ui,sans-serif;padding:20px;max-width:760px;margin:auto}
h1{font-size:22px}article{background:#161a2c;border:1px solid #2a3150;border-radius:14px;padding:14px;margin-bottom:14px}
video{width:100%;max-width:280px;border-radius:10px;display:block;margin-bottom:10px}
b{color:#ffd23f}a{display:inline-block;background:#ffd23f;color:#1d1600;font-weight:700;text-decoration:none;padding:10px 16px;border-radius:10px}
p{color:#98a0bf;font-size:14px}</style></head><body><h1>Vídeos de hoy</h1>
<p>Descárgalos y súbelos a TikTok o a Reels. Añade allí el audio de moda, que ayuda a que lleguen a más gente.</p>
${lista.map((v) => `<article><video src="${v.archivo.replace("videos/", "")}" controls preload="metadata"></video>
<div><b>${esc(v.juego)}</b> · ${eur(v.precio)} (−${v.dto} %) en ${esc(v.tienda)}</div>
<p>${esc(v.plataforma)}${v.minimo ? " · Mínimo histórico" : ""}</p>
<a href="${v.archivo.replace("videos/", "")}" download>Descargar vídeo</a></article>`).join("")}
</body></html>`;
await writeFile(join("videos", "index.html"), paginaLista(hechos));

// 5. Aviso en Telegram con los enlaces, si está encendido (VIDEOS_TELEGRAM=1)
if (ENV.VIDEOS_TELEGRAM === "1" && ENV.TELEGRAM_BOT_TOKEN && ENV.TELEGRAM_CANAL) {
  const texto = `🎬 <b>Vídeos de hoy listos</b>\n\n${hechos.map((v) => `· ${v.juego} — ${eur(v.precio)} (−${v.dto} %)`).join("\n")}\n\n<a href="https://${SITIO}/videos/">Descargarlos para TikTok y Reels</a>`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${ENV.TELEGRAM_BOT_TOKEN.trim()}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ENV.TELEGRAM_CANAL.trim(), text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } }) });
    console.log("Aviso en Telegram:", (await r.json()).ok ? "enviado" : "no se ha podido");
  } catch (e) { console.warn("Telegram: " + e.message); }
}

// 6. Solo se guardan los últimos vídeos, para que la carpeta no crezca sin parar
const todos = (await readdir("videos")).filter((f) => f.endsWith(".mp4")).sort();
for (const f of todos.slice(0, Math.max(0, todos.length - GUARDAR))) await rm(join("videos", f), { force: true });
await writeFile(join("videos", "index.json"), JSON.stringify({ fecha: new Date().toISOString(), videos: hechos }, null, 1) + "\n");
console.log(`Listos ${hechos.length} vídeos en videos/.`);
