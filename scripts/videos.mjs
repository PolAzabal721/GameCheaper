// Vídeos verticales (TikTok / Reels) con los chollos que se han publicado en Telegram el último día.
// Uso: node scripts/videos.mjs        (necesita ffmpeg y HyperFrames: npm install -g hyperframes; en GitHub Actions ya están)
//
// Hace un vídeo por chollo (hasta VIDEOS_MAX), de unos 13 segundos y 1080x1920, con la imagen del juego,
// el precio de antes tachado, el de ahora, el descuento y la tienda. Sin música: así cada quien le pone
// el audio de moda al publicarlo, que es lo que más ayuda en TikTok y en Reels.
// Los deja en videos/ y escribe videos/index.json con los datos de cada uno.
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

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
let chollos = [];
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
// GamesPlanet US: algunas de sus claves solo se activan en EE. UU., así que no sale en los vídeos
const FUERA = new Set(["itad-gamesplanetus"]);
chollos = chollos.filter((c) => !FUERA.has(c.o.tienda));
chollos.sort((a, b) => b.dto - a.dto);
console.log(`Chollos de las últimas ${HORAS} h: ${chollos.length}.`);

// 2. La imagen de cada juego (si no hay, un fondo de color)
const STEAM = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
const urlImagen = (j) => {
  const v = j.img || j.cov;
  if (!v) return null;
  if (v.startsWith("sc:")) return STEAM + v.slice(3);
  if (v.startsWith("s:")) return STEAM + v.slice(2) + "/header.jpg";
  return /^https:\/\//.test(v) ? v : null;
};
await mkdir("tmp-videos", { recursive: true });

// 2. Quiénes salen: un vídeo por juego, solo si su foto se ve de verdad (un vídeo sin foto no vale)
// y sin repetir juego del que ya se hizo vídeo hace poco.
const hechosAntes = await leer("data/videos.json", { hechos: {} });
for (const [id, f] of Object.entries(hechosAntes.hechos)) if (Date.now() - Date.parse(f) > HORAS * 3600000) delete hechosAntes.hechos[id];
const foto = async (j) => {
  const u = urlImagen(j);
  if (!u) return null;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Pillao/2.0; +https://pillaojuegos.com)" } });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\//.test(tipo)) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 2000) return null;
    return `data:${tipo};base64,${b.toString("base64")}`;
  } catch { return null; }
};
// Si se piden juegos concretos (VIDEOS_JUEGOS), solo esos y por delante de todo
const pedidos = (ENV.VIDEOS_JUEGOS || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
const pedido = (j) => pedidos.some((t) => j.titulo.toLowerCase() === t || j.id === t);
if (pedidos.length) {
  // Un juego pedido que no ha salido en Telegram: se graba con su mejor precio de ahora mismo
  for (const t of pedidos) {
    if (chollos.some((c) => pedido(c.j) && (c.j.titulo.toLowerCase() === t || c.j.id === t))) continue;
    const j = precios.juegos.find((x) => x.titulo.toLowerCase() === t || x.id === t);
    if (!j) { console.log(`  no encuentro «${t}» en el catálogo`); continue; }
    const ofs = j.ofertas.filter((o) => o.estado !== "usado" && o.stock !== false && o.precio > 0 && !FUERA.has(o.tienda));
    if (!ofs.length) continue;
    const o = ofs.reduce((a, b) => (b.precio + (b.envio || 0) < a.precio + (a.envio || 0) ? b : a));
    const ref = Math.max(j.pvp || 0, o.regular || 0), p = o.precio + (o.envio || 0);
    if (!(ref > p)) { console.log(`  «${j.titulo}» no tiene descuento ahora`); continue; }
    chollos.push({ j, o, precio: p, antes: ref, dto: Math.round((1 - p / ref) * 100), minimo: j.minimo && p <= j.minimo + 0.01,
      nombre: (tienda[o.tienda] || {}).nombre || o.tienda });
  }
  const fuera = chollos.filter((c) => !pedido(c.j)).length;
  chollos = chollos.filter((c) => pedido(c.j));
  console.log(`Solo los pedidos (${pedidos.join(", ")}): ${chollos.length} chollos; ${fuera} descartados.`);
}
const yaVisto = new Set(), elegidos = [];
let sinFoto = 0, repetidos = 0;
for (const c of chollos) {
  if (elegidos.length >= MAX) break;
  if (yaVisto.has(c.j.id)) continue;
  yaVisto.add(c.j.id);
  if (hechosAntes.hechos[c.j.id] && !pedidos.length) { repetidos++; continue; }
  const img = await foto(c.j);
  if (!img) { sinFoto++; console.log(`  sin foto, lo salto: ${c.j.titulo}`); continue; }
  c.imagen = img;
  elegidos.push(c);
}
console.log(`Hago vídeo de ${elegidos.length}${sinFoto ? `; ${sinFoto} saltados por no tener foto` : ""}${repetidos ? `; ${repetidos} ya tenían vídeo` : ""}.`);
if (!elegidos.length) { console.log("Nada que contar hoy."); process.exit(0); }

// 3. Cada vídeo
const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Plantilla HyperFrames (HTML animado con GSAP → MP4): gancho, precio que baja contando, tienda con su logo y cierre con la marca.
// Todo el texto va entre 168 y 1330 px de alto, la zona que TikTok y Reels no tapan con sus botones.
const PLANTILLA = await readFile(join("scripts", "video-plantilla.html"), "utf8");
const LOGOS = await leer("config/logos.json", {});
const GSAP = await (await fetch("https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js")).text();
const fuentesCss = await readFile(join("fonts", "fuentes.css"), "utf8");
async function proyecto(c, dir) {
  await mkdir(join(dir, "assets", "fonts"), { recursive: true }); await mkdir(join(dir, "assets", "lib"), { recursive: true });
  await writeFile(join(dir, "assets", "lib", "gsap.min.js"), GSAP);
  const ficheros = [];
  const css = fuentesCss.replace(/url\(([a-z0-9]+\.woff2)\)/g, (m, f) => { ficheros.push(f); return `url(assets/fonts/${f})`; });
  for (const f of ficheros) await copyFile(join("fonts", f), join(dir, "assets", "fonts", f));
  await writeFile(join(dir, "assets", "arte.jpg"), Buffer.from(c.imagen.split(",")[1], "base64"));
  await ejecutar("ffmpeg", ["-v", "error", "-y", "-i", join(dir, "assets", "arte.jpg"), "-vf", "scale=540:-2,boxblur=24:3,eq=saturation=1.3:brightness=-0.08", join(dir, "assets", "fondo.jpg")]);
  let logo = "";
  const dom = LOGOS[c.o.tienda];
  if (dom && existsSync(join("logos", dom + ".png"))) { await copyFile(join("logos", dom + ".png"), join(dir, "assets", "logo.png")); logo = '<img src="assets/logo.png" alt="">'; }
  const lineas = c.j.titulo.length > 26 ? 2 : 1, topTit = 980, topPre = topTit - 260 + lineas * 64 + 44, topTie = topPre + 360;
  const html = PLANTILLA.replace("__FUENTES__", css)
    .replaceAll("__ANTES__", eur(c.antes)).replace("__ANTES_N__", String(c.antes)).replace("__PRECIO_N__", String(c.precio))
    .replace("__DTO__", String(c.dto)).replace("__AHORRO__", eur(c.antes - c.precio))
    .replace("__TITULO__", esc(c.j.titulo)).replace("__TIENDA__", esc(c.nombre)).replace("__LOGO__", logo)
    .replace("__SELLO__", c.minimo ? '<div class="capa sello" id="sello">MÍNIMO HISTÓRICO</div>' : "")
    .replace("__TOPTIT__", String(topTit)).replace("__TOPPRE__", String(topPre)).replace("__TOPTIE__", String(topTie));
  await writeFile(join(dir, "index.html"), html);
}
const LARGO = 13;   // segundos, los que marca la plantilla

// 3b. La voz que lo cuenta (Piper: funciona sin conexión y sin pagar nada; si no está, el vídeo sale sin voz)
const PIPER = (ENV.PIPER_CMD || "piper").split(" ");
const VOZ = ENV.PIPER_VOZ || "es_ES-davefx-medium";
const VOZ_DIR = ENV.PIPER_DIR || "voz";
const hayVoz = !!ENV.PIPER_CMD && ENV.VIDEOS_VOZ === "1";   // por defecto el vídeo sale mudo y el diálogo se entrega aparte
// «8,47 €» se lee mejor como «8 euros con 47»
const enVoz = (n) => {
  const e = Math.floor(n + 1e-6), c = Math.round((n - e) * 100);
  return c ? `${e} euros con ${c}` : `${e} euros`;
};
function guion(c) {
  const partes = [`Chollo de hoy en Pillao.`, `${c.j.titulo}, para ${c.o.plataforma || "PC"}.`];
  partes.push(`Costaba ${enVoz(c.antes)} y ahora está en ${enVoz(c.precio)}.`);
  partes.push(`Un ${c.dto} por ciento menos en ${c.nombre}.`);
  if (c.minimo) partes.push("Es su precio más bajo hasta ahora.");
  partes.push("Compara todas las tiendas en pillaojuegos punto com.");
  return partes.join(" ");
}
async function narrar(texto, salida) {
  if (!hayVoz) return 0;
  try {
    // El texto se le pasa por la entrada estándar (execFile no sabe hacerlo, así que lanzamos el proceso a mano)
    await new Promise((listo, fallo) => {
      const p = spawn(PIPER[0], [...PIPER.slice(1), "-m", VOZ, "--data-dir", VOZ_DIR, "-f", salida], { stdio: ["pipe", "ignore", "pipe"] });
      let err = "";
      p.stderr.on("data", (d) => { err += d; });
      p.on("error", fallo);
      p.on("close", (code) => (code === 0 ? listo() : fallo(new Error(err.split("\n").slice(-4).join(" | ")))));
      p.stdin.end(texto + "\n");
    });
    const { stdout } = await ejecutar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", salida]);
    return Math.max(0, parseFloat(stdout.trim()) || 0);
  } catch (e) { console.warn("voz: " + (e.stderr || e.message || "").toString().split("\n").slice(0, 3).join(" | ")); return 0; }
}

for (const c of elegidos) hechosAntes.hechos[c.j.id] = new Date().toISOString();
await writeFile("data/videos.json", JSON.stringify(hechosAntes) + "\n");

await mkdir("videos", { recursive: true });
const hoy = new Date().toISOString().slice(0, 10);
const hechos = [];
for (let i = 0; i < elegidos.length; i++) {
  const c = elegidos[i];
  const dir = join("tmp-videos", `hf-${i}`);
  const salida = join("videos", `${hoy}-${c.j.id.slice(0, 40)}.mp4`);
  const texto = guion(c);
  try {
    await proyecto(c, dir);
    const mudo = join("tmp-videos", `mudo-${i}.mp4`);
    await ejecutar("hyperframes", ["render", "--output", join("..", "..", mudo)], { cwd: dir, maxBuffer: 1 << 28, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1" } });
    // Con voz (VIDEOS_VOZ=1) se le pone encima; si no, sale mudo para ponerle el audio de moda al publicarlo
    const wav = join("tmp-videos", `voz-${i}.wav`);
    const segundos = await narrar(texto, wav);
    if (segundos) await ejecutar("ffmpeg", ["-v", "error", "-y", "-i", mudo, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-af", "adelay=300|300,apad", "-t", String(LARGO), "-movflags", "+faststart", salida]);
    else await copyFile(mudo, salida);
  } catch (e) { console.warn(`  no se ha podido hacer el vídeo de ${c.j.titulo}: ${(e.stderr || e.message || "").toString().split("\n").slice(-3).join(" | ")}`); continue; }
  hechos.push({ archivo: salida.replace(/\\/g, "/"), juego: c.j.titulo, precio: c.precio, antes: c.antes, dto: c.dto,
    tienda: c.nombre, plataforma: c.o.plataforma || "", minimo: !!c.minimo, guion: texto, segundos: LARGO,
    url: `https://${SITIO}/?q=${encodeURIComponent(c.j.titulo)}` });
  console.log(`  ${salida} · ${c.j.titulo} · ${eur(c.precio)} (−${c.dto} %)`);
}
await rm("tmp-videos", { recursive: true, force: true });

// 4. Aviso en Telegram con los enlaces, si está encendido (VIDEOS_TELEGRAM=1)
if (ENV.VIDEOS_TELEGRAM === "1" && ENV.TELEGRAM_BOT_TOKEN && ENV.TELEGRAM_CANAL) {
  const texto = `🎬 <b>Vídeos de hoy listos</b>\n\n${hechos.map((v) => `· ${v.juego} — ${eur(v.precio)} (−${v.dto} %)`).join("\n")}`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${ENV.TELEGRAM_BOT_TOKEN.trim()}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ENV.TELEGRAM_CANAL.trim(), text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } }) });
    console.log("Aviso en Telegram:", (await r.json()).ok ? "enviado" : "no se ha podido");
  } catch (e) { console.warn("Telegram: " + e.message); }
}

// 5. Solo se guardan los últimos vídeos, para que la carpeta no crezca sin parar
const todos = (await readdir("videos")).filter((f) => f.endsWith(".mp4")).sort();
for (const f of todos.slice(0, Math.max(0, todos.length - GUARDAR))) await rm(join("videos", f), { force: true });
await writeFile(join("videos", "index.json"), JSON.stringify({ fecha: new Date().toISOString(), videos: hechos }, null, 1) + "\n");
// Los diálogos, para ponerles la voz con otra herramienta
const rutaGuiones = join("videos", `${hoy}-guiones.txt`);
const antesGuiones = (await readFile(rutaGuiones, "utf8").catch(() => "")).split(/\n\n(?=### )/).filter(Boolean);
const nuevos = hechos.map((v) => `### ${v.archivo}  ·  ${v.juego}  ·  ${v.segundos} s\n${v.guion}`);
const porArchivo = new Map();
for (const b of [...antesGuiones, ...nuevos]) porArchivo.set(b.split("\n")[0].split("·")[0].trim(), b.trim());
await writeFile(rutaGuiones, [...porArchivo.values()].join("\n\n") + "\n");
console.log(`Listos ${hechos.length} vídeos en videos/.`);
