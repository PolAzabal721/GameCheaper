// Prepara el proyecto HyperFrames de un chollo: node hacer.mjs <id-del-juego> <carpeta>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const [id, dir] = process.argv.slice(2);
const RAIZ = "../..";
const datos = JSON.parse(readFileSync(join(RAIZ, "precios.json"), "utf8"));
const tiendas = Object.fromEntries(datos.tiendas.map((t) => [t.id, t]));
const logos = JSON.parse(readFileSync(join(RAIZ, "config/logos.json"), "utf8"));
const j = datos.juegos.find((x) => x.id === id);
if (!j) throw new Error("No encuentro " + id);
const FUERA = new Set(["itad-gamesplanetus"]);
const total = (o) => o.precio + (o.envio || 0);
const ofs = j.ofertas.filter((o) => o.estado !== "usado" && o.stock !== false && o.precio > 0 && !FUERA.has(o.tienda));
const o = ofs.reduce((a, b) => (total(b) < total(a) ? b : a));
const antes = Math.max(j.pvp || 0, o.regular || 0), precio = total(o);
const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const minimo = j.minimo && precio <= j.minimo + 0.01;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
mkdirSync(join(dir, "assets/fonts"), { recursive: true }); mkdirSync(join(dir, "assets/lib"), { recursive: true });
// Letras de Pillao
let css = readFileSync(join(RAIZ, "fonts/fuentes.css"), "utf8").replace(/url\(([a-z0-9]+\.woff2)\)/g, (m, f) => { copyFileSync(join(RAIZ, "fonts", f), join(dir, "assets/fonts", f)); return `url(assets/fonts/${f})`; });
// Logo de la tienda
const dom = logos[o.tienda];
let logo = "";
if (dom && existsSync(join(RAIZ, "logos", dom + ".png"))) { copyFileSync(join(RAIZ, "logos", dom + ".png"), join(dir, "assets/logo.png")); logo = '<img src="assets/logo.png" alt="">'; }
// La imagen del juego: la URL va a un archivo para que render.sh la descargue
const STEAM = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
const v = j.img || j.cov;
const url = v.startsWith("sc:") ? STEAM + v.slice(3) : v.startsWith("s:") ? STEAM + v.slice(2) + "/header.jpg" : v;
writeFileSync(join(dir, "arte-url.txt"), url);
const largoTit = j.titulo.length > 26 ? 2 : 1;
const topTit = 980, topPre = topTit - 260 + largoTit * 64 + 44, topTie = topPre + 360;
let html = readFileSync("plantilla.html", "utf8")
  .replace("__FUENTES__", css)
  .replaceAll("__ANTES__", eur(antes)).replace("__ANTES_N__", String(antes)).replace("__PRECIO_N__", String(precio))
  .replace("__DTO__", String(Math.round((1 - precio / antes) * 100))).replace("__AHORRO__", eur(antes - precio))
  .replace("__TITULO__", esc(j.titulo)).replace("__TIENDA__", esc(tiendas[o.tienda]?.nombre || o.tienda)).replace("__LOGO__", logo)
  .replace("__SELLO__", minimo ? '<div class="capa sello" id="sello">MÍNIMO HISTÓRICO</div>' : "")
  .replace("__TOPTIT__", String(topTit)).replace("__TOPPRE__", String(topPre)).replace("__TOPTIE__", String(topTie))
;
writeFileSync(join(dir, "index.html"), html);
console.log(`${j.titulo}: ${eur(antes)} → ${eur(precio)} en ${tiendas[o.tienda]?.nombre} ${minimo ? "(mínimo)" : ""}`);
