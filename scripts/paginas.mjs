// Construye la web que se publica en GitHub Pages (carpeta _site):
//   - la web de siempre (index.html, legal.html, tipografías, precios, historial)
//   - una página por juego en juego/<id>/ con sus precios, para que Google la encuentre
//   - juegos/ con la lista de todos los juegos (enlaza todas las páginas) y sitemap.xml
// Uso: node scripts/paginas.mjs      (lo lanza el flujo «Publicar web»)

import { readFile, writeFile, mkdir, cp, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
// Logo de cada tienda (logos/<dominio>.png), para la lista de ofertas de cada ficha
let LOGOS = {};
try { LOGOS = JSON.parse(await readFile(join(RAIZ, "config", "logos.json"), "utf8")); } catch {}
const logoDe = (id) => LOGOS[id] && existsSync(join(RAIZ, "logos", LOGOS[id] + ".png")) ? LOGOS[id] : null;
const SALIDA = join(RAIZ, "_site");

// ---------- precios.json más ligero para la web (sobre todo para móviles) ----------
// Quita lo que la web no usa (fuente, hora de cada precio) y lo que vale lo de siempre (digital, nuevo, con stock,
// sin rebaja, sin envío), y acorta el principio de las direcciones repetidas: «~3…» = PREFIJOS[3] + «…».
// La web lo deshace al cargar (index.html, función expandir). Los demás programas usan el precios.json completo.
// «sc:<id>/<carpeta>/<fichero>» y «s:<id>» son las dos formas de guardar las fotos de Steam
const STEAM_IMG = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
function imagenDe(j) {
  const v = j.img || j.cov;
  if (!v) return null;
  if (v.startsWith("sc:")) return STEAM_IMG + v.slice(3);
  if (v.startsWith("s:")) return STEAM_IMG + v.slice(2) + "/header.jpg";
  return /^https:\/\//.test(v) ? v : null;
}

const PREFIJOS = ["https://store.steampowered.com/app/", "https://www.instant-gaming.com/es/", "https://www.nintendo.com/es-es/Juegos/",
  "https://www.game.es/", "https://www.xbox.com/es-ES/games/store/p/", "https://itad.link/", "https://store.playstation.com/es-es/concept/",
  "https://www.ebay.es/itm/", "https://www.compraonline.alcampo.es/products/", "https://store-images.s-microsoft.com/image/apps.",
  "https://www.nintendo.com/eu/media/images/10_share_images/games_15/", "https://www.nintendo.com/eu/media/images/11_square_images/games_18/",
  "https://www.nintendo.com/eu/media/images/assets/nintendo_switch_games/", "https://www.nintendo.com/eu/media/images/assets/nintendo_switch_2_games/",
  "https://assets.nintendo.eu/image/private/f_auto,q_auto,w_500/", "https://media.game.es/", "https://store.playstation.com/es-es/product/",
  "https://www.xbox.com/es-ES/games/"];
function comprimir(datos) {
  const corta = (u) => {
    if (typeof u !== "string") return u;
    let mejor = -1;
    PREFIJOS.forEach((p, i) => { if (u.startsWith(p) && (mejor < 0 || p.length > PREFIJOS[mejor].length)) mejor = i; });
    return mejor < 0 ? u : "~" + mejor.toString(36) + u.slice(PREFIJOS[mejor].length);
  };
  const juegos = datos.juegos.map(({ revisado, ...j }) => {
    const r = { ...j };
    if (revisado?.length) r.revisado = revisado;
    if (r.img) r.img = corta(r.img);
    if (r.cov) r.cov = corta(r.cov === r.img ? r.cov : r.cov);
    if (j.cov && j.cov === j.img) r.cov = 1; // la misma imagen: no se repite
    r.ofertas = j.ofertas.map(({ fuente, t, ...o }) => {
      const x = { ...o };
      if (x.formato === "digital") delete x.formato;
      if (x.estado === "nuevo") delete x.estado;
      if (x.stock !== false) delete x.stock;
      if (!(x.regular > x.precio + 0.001)) delete x.regular;
      if (!x.envio) delete x.envio;
      // el código de afiliado de Instant Gaming lo vuelve a poner la web
      x.url = corta(String(x.url || "").replace(/\?igr=gamer-681806$/, ""));
      return x;
    });
    return r;
  });
  return { ...datos, paginas: true, prefijos: PREFIJOS, juegos };
}
const SITIO = (process.env.SITIO_URL || "https://pillaojuegos.com/").replace(/\/?$/, "/");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const total = (o) => o.precio + (o.envio || 0);
const AFILIADAS = { instantgaming: 1, yuplay: 1, g2a: 1, gamivo: 1 };
const TIPO = { dlc: "DLC", edicion: "Edición especial", tarjeta: "Tarjeta regalo" };

// Política de seguridad (CSP): el navegador solo ejecuta los scripts de Pillao (por su huella exacta),
// solo se conecta con la propia web y con el buscador, y no deja que otra web meta Pillao dentro ni envíe formularios fuera.
function proteger(html, buscador) {
  const huellas = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
  const csp = [
    "default-src 'self'", `script-src 'self' ${huellas.join(" ")}`.trim(), "style-src 'self' 'unsafe-inline'", `img-src 'self' data:${buscador ? " " + new URL(buscador).origin : ""} https://shared.akamai.steamstatic.com https://cdn.akamai.steamstatic.com https://fs-prod-cdn.nintendo-europe.com https://www.nintendo.com https://assets.nintendo.eu https://store-images.s-microsoft.com https://image.api.playstation.com https://media.game.es https://assets.isthereanydeal.com`,
    "font-src 'self'", `connect-src 'self'${buscador ? " " + new URL(buscador).origin : ""}`, "object-src 'none'", "base-uri 'self'",
    "form-action 'self'", "upgrade-insecure-requests",
  ].join("; ");
  const metas = `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin">`;
  return html.replace(/<meta charset="utf-8">/i, (m) => m + metas);
}

function estilos() {
  return `:root{--bg:#eef0f5;--surface:#fff;--surface-2:#f6f7fb;--ink:#141a2e;--muted:#5a6280;--line:#d9dce8;--accent:#2741d6;--tag:#ffd23f;--tag-ink:#1d1600;--good:#11804a}
@media (prefers-color-scheme:dark){:root{--bg:#0e1120;--surface:#161a2c;--surface-2:#1c2136;--ink:#e8ebf6;--muted:#98a0bf;--line:#2a3150;--accent:#8fa0ff;--good:#4fd18b;color-scheme:dark}}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}html{scrollbar-color:var(--line) var(--bg);scrollbar-width:thin}::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--line);border-radius:99px;border:2px solid var(--bg)}::-webkit-scrollbar-thumb:hover{background:var(--muted)}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.5}
a{color:var(--accent)}.wrap{max-width:900px;margin:0 auto;padding:0 16px}
header{background:var(--surface);border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:60px}
.logo{font-family:"Bricolage Grotesque","Arial Black",sans-serif;font-weight:800;font-size:24px;color:var(--ink);text-decoration:none;letter-spacing:-.02em}
.logo span{background:var(--tag);color:var(--tag-ink);border-radius:5px;font-size:13px;padding:1px 5px;margin-left:4px;vertical-align:4px}
main.wrap{padding:24px 16px 56px;display:flex;flex-direction:column;gap:18px}.migas{font-size:13px;color:var(--muted)}.migas a{color:var(--muted)}
.poster{position:relative;min-height:400px;display:flex;align-items:flex-end;border-radius:18px;overflow:hidden;border:1px solid var(--line);background:linear-gradient(140deg,#1b2140,#3b1d8f 50%,#0e7490);color:#fff}
.poster>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.poster:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,17,32,0) 15%,rgba(14,17,32,.8) 50%,rgba(14,17,32,.98) 75%)}
.poster.sin-img{min-height:0}.poster.sin-img:after{background:rgba(14,17,32,.35)}
.poster-in{position:relative;z-index:1;width:100%;padding:22px;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;justify-content:space-between}
.poster-d{flex:1 1 380px;min-width:0}
.poster h1{color:#fff;font-size:40px;margin:0 0 10px;text-shadow:0 2px 20px rgba(0,0,0,.5)}
.poster .plat,.poster .tipo{background:rgba(10,12,24,.6);border-color:transparent;color:#fff;backdrop-filter:blur(6px)}
.poster .resumen{color:#cfd5ea}.poster .resumen b{color:#fff}
.poster .etiqueta{position:relative;transform:rotate(-2deg);box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:left}
.poster-dto{position:absolute;top:-12px;right:-12px;font-style:normal;background:#4fd18b;color:#06301c;font-weight:800;font-size:13px;padding:3px 8px;border-radius:7px;transform:rotate(4deg)}
@media(max-width:600px){.poster{min-height:420px}.poster h1{font-size:30px}.poster-in{padding:18px}}
.barra{flex:1 1 100%;display:grid;gap:7px;margin-top:4px}
.barra .linea{position:relative;height:10px;border-radius:99px;background:linear-gradient(90deg,#4fd18b,#ffd23f 45%,#ff4d6d)}
.barra .punto{position:absolute;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:#fff;border:4px solid #0e1120;box-shadow:0 0 0 2px #fff}
.barra .eti{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#cfd5ea}.barra .eti b,.barra .eti .ya{color:#fff;font-weight:700}
.ficha{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;align-items:flex-start}.ficha>div:first-child{flex:1 1 380px;min-width:0}
.tabla{overflow-x:auto;border-radius:14px}
.lista-of{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}.lista-of ul{list-style:none;margin:0;padding:0}
.lista-of li{display:grid;grid-template-columns:32px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid var(--line)}
.lista-of img,.lista-of .lg0{width:32px;height:32px;border-radius:8px;background:#fff;padding:3px;object-fit:contain}.lista-of .lg0{background:var(--surface-2)}
.lista-of .n{min-width:0}.lista-of .n b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lista-of .n small{display:block;color:var(--muted);font-size:12.5px}
.lista-of .p{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700;font-size:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.lista-of .ir{font-weight:700;font-size:13px;text-decoration:none;color:var(--accent);border:1px solid var(--line);border-radius:99px;padding:6px 13px;white-space:nowrap}.lista-of .ir:hover{border-color:var(--accent)}
.lista-of li.top{background:color-mix(in srgb,var(--good) 10%,var(--surface))}.lista-of li.top .p{color:var(--good)}.lista-of li.top .ir{background:var(--accent);border-color:var(--accent);color:var(--surface)}
.lista-of .tag{font-size:11px;font-weight:800;letter-spacing:.04em;color:var(--good);margin-left:8px;vertical-align:1px}.lista-of li.ago{opacity:.55}
.lista-of details{border-top:0}.lista-of summary{list-style:none;cursor:pointer;text-align:center;padding:13px;color:var(--accent);font-weight:700}.lista-of summary::-webkit-details-marker{display:none}
.lista-of summary::after{content:" ▾"}.lista-of details[open] summary{order:2}.lista-of details[open] summary::after{content:" ▴"}.lista-of summary .a,.lista-of details[open] summary .c{display:none}.lista-of details[open] summary .a{display:inline}.lista-of details[open]>ul{border-top:1px solid var(--line)}
.lista-of>ul>li:last-child{border-bottom:0}.lista-of details>ul>li:last-child{border-bottom:0}.lista-of details[open]{display:flex;flex-direction:column}
@media(max-width:600px){.lista-of li{gap:10px;padding:11px 14px}}
h1{font-family:"Bricolage Grotesque","Arial Black",sans-serif;font-size:30px;line-height:1.1;margin:0 0 8px;letter-spacing:-.01em}
.plats{display:flex;flex-wrap:wrap;gap:6px}.plat,.tipo{font-size:12px;font-weight:600;padding:2px 8px;border-radius:5px;background:var(--surface-2);border:1px solid var(--line);color:var(--muted)}
.etiqueta{background:var(--tag);color:var(--tag-ink);border-radius:8px;padding:10px 16px;text-align:right;transform:rotate(-1.5deg);min-width:170px}
.etiqueta small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;opacity:.75}
.etiqueta b{display:block;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:30px;line-height:1.1}.etiqueta span{font-size:13px;font-weight:600}
.resumen{color:var(--muted);margin:10px 0 0}.resumen b{color:var(--ink)}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);font-size:14px}th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);background:var(--surface-2)}
td.p{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700;white-space:nowrap}tr.mejor td{background:color-mix(in srgb,var(--tag) 18%,transparent)}
.agotado{color:var(--muted);font-size:12px}td a{font-weight:600;white-space:nowrap}
.cta{display:flex;flex-wrap:wrap;gap:10px}.boton{display:inline-block;background:var(--ink);color:var(--surface);padding:11px 16px;border-radius:9px;text-decoration:none;font-weight:700}
.boton.sec{background:var(--surface);color:var(--ink);border:1px solid var(--line)}
h2{font-family:"Bricolage Grotesque","Arial Black",sans-serif;font-size:20px;margin:8px 0 0}
.mas{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0}.mas a{display:inline-block;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:5px 12px;text-decoration:none;color:var(--ink);font-size:14px}
.letras{display:flex;flex-wrap:wrap;gap:6px}.letras a{font-weight:700;text-decoration:none;padding:4px 9px;border-radius:6px;background:var(--surface);border:1px solid var(--line)}
.lista{columns:3 230px;column-gap:18px;padding:0;list-style:none;margin:0}.lista li{break-inside:avoid;padding:0}
.lista a{display:block;padding:6px 10px;border-radius:8px;color:var(--ink);text-decoration:none;font-size:14px;line-height:1.3}.lista a:hover{background:var(--surface);color:var(--accent)}
.letras{position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}.letras a{color:var(--ink)}
h2[id^="l-"]{margin-top:22px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.ir-app{background:var(--ink);color:var(--surface);padding:8px 14px;border-radius:9px;text-decoration:none;font-weight:700;font-size:14px}
.migas a{text-decoration:none}
.migas{padding-top:16px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;padding:18px 0 30px}footer nav{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px}footer a{color:var(--muted)}
.hero{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px}.hero h1{font-size:34px}
.saltos{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.saltos a{background:var(--surface-2);border:1px solid var(--line);border-radius:99px;padding:6px 12px;text-decoration:none;color:var(--ink);font-weight:600;font-size:14px}
.ofertas{list-style:none;padding:0;margin:4px 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.of a{display:flex;flex-direction:column;height:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;text-decoration:none;color:var(--ink)}
.of a:hover{border-color:var(--accent)}.of img,.of .sin-img{display:block;width:100%;height:auto;aspect-ratio:460/215;object-fit:cover;background:var(--surface-2)}
.of-d{display:flex;flex-direction:column;gap:4px;padding:10px 12px 12px}.of-d b{font-size:14.5px;line-height:1.25}
.of-p{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px}.of-p strong{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:20px}
.of-p s{color:var(--muted);font-size:13px}.of-p em{font-style:normal;font-weight:800;font-size:12px;background:var(--good);color:#fff;border-radius:5px;padding:1px 6px}
.of-t{font-size:12.5px;color:var(--muted)}.of-t i{display:inline-block;margin-top:3px;font-style:normal;color:var(--tag-ink);background:var(--tag);border-radius:4px;padding:0 6px;font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em}
.faq{display:flex;flex-direction:column;gap:8px}.faq details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.faq summary{font-weight:700;cursor:pointer}.faq p{margin:8px 0 0;color:var(--muted)}
.volver{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:99px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-decoration:none;font-weight:700;font-size:14px;margin:0 0 4px}
.volver:hover{border-color:var(--accent)}
.mas-ch{margin-top:26px}.saltos.otras{gap:10px 12px;margin:0 0 36px}.saltos.otras a{padding:8px 16px}
.faq{margin-bottom:8px}
.banners{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px}
.banner{position:relative;display:flex;align-items:center;gap:16px;min-height:150px;padding:22px;border-radius:18px;overflow:hidden;text-decoration:none;color:#fff;background:linear-gradient(120deg,var(--c1),var(--c2));box-shadow:0 10px 28px rgba(0,0,0,.18);transition:transform .15s}
.banner:hover{transform:translateY(-2px)}
.b-logo{flex-shrink:0;width:64px;height:64px;border-radius:16px;background:#fff;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.2);position:relative;z-index:1}
.b-logo img{width:44px;height:44px;object-fit:contain}.b-logo svg{width:38px;height:38px;color:var(--c1)}
.b-txt{display:flex;flex-direction:column;gap:4px;position:relative;z-index:1;flex:1;min-width:0}
.b-txt b{font-family:"Bricolage Grotesque","Arial Black",sans-serif;font-size:26px;line-height:1.1;letter-spacing:-.01em}
.b-txt small{font-size:14px;opacity:.92}.b-ir{margin-top:8px;align-self:flex-start;background:#fff;color:#111;font-weight:800;font-size:13px;padding:6px 12px;border-radius:99px}
.b-covs{position:relative;z-index:0;display:flex;flex-shrink:0;margin-right:-6px}
.b-covs img{width:150px;aspect-ratio:460/215;object-fit:cover;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.85)}
.b-covs img+img{margin-left:-70px}.b-covs img:nth-child(1){transform:rotate(-5deg)}.b-covs img:nth-child(2){transform:rotate(2deg) translateY(10px)}.b-covs img:nth-child(3){transform:rotate(7deg)}
.b-num{display:none}
@media(max-width:600px){.banners{grid-template-columns:1fr 1fr;gap:10px}.banner:last-child:nth-child(odd){grid-column:1/-1}
.banner{flex-direction:column;align-items:flex-start;gap:10px;min-height:0;padding:14px;border-radius:16px}.b-covs,.b-ir,.b-cnt{display:none}
.b-logo{width:44px;height:44px;border-radius:12px}.b-logo img{width:30px;height:30px}.b-logo svg{width:26px;height:26px}
.b-txt b{font-size:17px;line-height:1.15}.b-txt small{font-size:12.5px}.b-num{display:block;font-weight:800;font-size:15px;margin-top:4px}.b-num small{display:block;font-weight:600;font-size:12.5px;opacity:.85}}
@media(max-width:600px){.hero h1{font-size:26px}.ofertas{grid-template-columns:1fr 1fr;gap:8px}.of-p strong{font-size:17px}}
@media(max-width:600px){h1{font-size:24px}.ficha>div:first-child{flex-basis:100%}.etiqueta{align-self:flex-start}th:nth-child(3),td:nth-child(3){display:none}th,td{padding:9px 8px;font-size:13px}td a .l{display:none}}`;
}

// Recuento de visitas y clics (el mismo que el de la portada): una visita por pestaña, sin cookies.
// Lo de la pestaña se guarda en sessionStorage, que el navegador borra al cerrarla.
let BUSCADOR = "";
const contador = () => !BUSCADOR ? "" : `<script>(function(){var B=${JSON.stringify(BUSCADOR.replace(/\/$/, ""))};var px=function(r){try{new Image().src=B+r}catch(e){}};
var ya=false;try{ya=!!sessionStorage.getItem("pillao-visita");sessionStorage.setItem("pillao-visita","1")}catch(e){}
if(!ya){var de="";try{de=document.referrer?new URL(document.referrer).hostname:""}catch(e){}if(de===location.hostname)de="";
setTimeout(function(){px("/v?p="+encodeURIComponent(location.pathname.slice(0,60))+(de?"&r="+encodeURIComponent(de):""))},1500)}
document.addEventListener("click",function(e){var a=e.target.closest?e.target.closest("a[data-t]"):null;if(a)px("/c?t="+encodeURIComponent(a.dataset.t)+"&j="+encodeURIComponent(a.dataset.j||""))},true)})();</script>`;
function plantilla({ titulo, descripcion, canonica, raiz, cuerpo, jsonld, imagen }) {
  // Imagen al compartir el enlace (WhatsApp, Telegram, X…): la del juego, o el icono de Pillao
  const og = imagen ? `<meta property="og:image" content="${esc(imagen)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(imagen)}">`
    : `<meta property="og:image" content="${SITIO}icono-192.png"><meta name="twitter:card" content="summary">`;
  return proteger(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${canonica}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}"><meta property="og:url" content="${canonica}"><meta property="og:locale" content="es_ES"><meta property="og:site_name" content="Pillao">${og}
<link rel="icon" href="${raiz}favicon.svg" type="image/svg+xml"><link rel="alternate icon" href="${raiz}favicon.ico" sizes="any"><link rel="icon" href="${raiz}icono-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="${raiz}icono-180.png">
<link rel="stylesheet" href="${raiz}fonts/fuentes.css"><link rel="stylesheet" href="${raiz}paginas.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head><body><header><div class="wrap"><a class="logo" href="${raiz}">Pillao<span>€</span></a><a class="ir-app" href="${raiz}">Ir al comparador →</a></div></header>
<main class="wrap">${cuerpo}</main>
<footer><div class="wrap">Pillao compara precios de videojuegos y no vende productos. Los precios son orientativos: el válido es siempre el de cada tienda. Algunos enlaces son de afiliado: si compras tras pulsarlos, la tienda puede pagarnos una comisión, sin coste para ti.
<nav><a href="${raiz}legal.html#aviso-legal">Aviso legal</a><a href="${raiz}legal.html#condiciones">Condiciones de uso</a><a href="${raiz}legal.html#privacidad">Privacidad</a><a href="${raiz}legal.html#cookies">Cookies</a></nav></div></footer>
${contador()}
</body></html>
`, BUSCADOR);
}

function enlaceOferta(o, j, tiendaPorId) {
  if (o.url) return o.url;
  const t = tiendaPorId[o.tienda];
  return t?.busqueda ? t.busqueda.replace("{q}", encodeURIComponent(j.titulo)) : null;
}

function paginaJuego(j, tiendaPorId, relacionados, actualizado) {
  // Mismas tiendas que la web enseña por defecto (de los revendedores de claves, solo Instant Gaming)
  // Manda el precio; en un empate, primero las tiendas con las que somos afiliados
  const ofs = j.ofertas.filter(() => true)
    .sort((a, b) => (b.stock - a.stock) || (Math.round(total(a) * 100) - Math.round(total(b) * 100)) || ((AFILIADAS[b.tienda] || 0) - (AFILIADAS[a.tienda] || 0)));
  if (!ofs.length) return null;
  const conStock = ofs.filter((o) => o.stock), mejor = conStock[0] || ofs[0];
  const tm = tiendaPorId[mejor.tienda]?.nombre || mejor.tienda;
  const nTiendas = new Set(ofs.map((o) => o.tienda)).size;
  const minimo = j.minimo ? Math.min(j.minimo, total(mejor)) : null;
  const plats = j.plataformas.filter((p) => p !== "Tarjeta regalo");
  const platTxt = plats.length ? ` (${plats.join(", ")})` : "";
  const fecha = new Date(actualizado).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
  const titulo = `${j.titulo}: precio más barato${platTxt} | Pillao`;
  const descripcion = `Compara el precio de ${j.titulo} en ${nTiendas} tienda${nTiendas === 1 ? "" : "s"}. Ahora desde ${eur(total(mejor))} en ${tm}` +
    (minimo ? `; mínimo histórico ${eur(minimo)}` : "") + ". Precios digitales, en disco y de segunda mano actualizados cada pocas horas.";
  const canonica = `${SITIO}juego/${j.id}/`;
  const nuevos = conStock.filter((o) => o.estado !== "usado").map(total);
  // Caducidad del precio: Google pide hasta cuándo vale; se actualiza varias veces al día, damos dos días de margen
  const valeHasta = new Date(Date.parse(actualizado) + 2 * 86400000).toISOString().slice(0, 10);
  const ofertasLD = ofs.slice(0, 20).map((o) => {
    const t = tiendaPorId[o.tienda], url = enlaceOferta(o, j, tiendaPorId);
    return {
      "@type": "Offer", priceCurrency: "EUR", price: total(o).toFixed(2), priceValidUntil: valeHasta,
      availability: o.stock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: o.estado === "usado" ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
      ...(url ? { url } : {}), ...(t?.nombre ? { seller: { "@type": "Organization", name: t.nombre } } : {}),
    };
  });
  const jsonld = [{
    "@context": "https://schema.org", "@type": "Product", name: j.titulo, url: canonica, description: descripcion,
    ...(imagenDe(j) ? { image: [imagenDe(j)] } : {}),
    ...(j.tipo === "tarjeta" && j.marca ? { brand: { "@type": "Brand", name: j.marca } } : {}),
    offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: Math.min(...(nuevos.length ? nuevos : [total(mejor)])).toFixed(2),
      highPrice: Math.max(...(nuevos.length ? nuevos : [total(mejor)])).toFixed(2), offerCount: ofs.length, offers: ofertasLD },
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Pillao", item: SITIO },
      { "@type": "ListItem", position: 2, name: "Juegos", item: SITIO + "juegos/" },
      { "@type": "ListItem", position: 3, name: j.titulo, item: canonica },
    ],
  }];
  // Lista de ofertas: logo, tienda, plataforma y formato, precio y botón; las 8 primeras a la vista y el resto en «Ver las N ofertas»
  const fila = (o) => {
    const t = tiendaPorId[o.tienda], url = enlaceOferta(o, j, tiendaPorId), lg = logoDe(o.tienda);
    const forma = o.estado === "usado" ? "2ª mano" : o.formato === "fisico" ? "En disco" : "Digital";
    return `<li class="${o === mejor ? "top" : ""}${o.stock ? "" : " ago"}">${lg ? `<img src="../../logos/${lg}.png" alt="" width="32" height="32" loading="lazy">` : `<span class="lg0"></span>`}` +
      `<span class="n"><b>${esc(t?.nombre || o.tienda)}${o === mejor ? '<span class="tag">MÁS BARATO</span>' : ""}</b><small>${esc(o.plataforma || "—")} · ${forma}${o.condicion ? " · " + esc(o.condicion) : ""}${o.stock ? "" : " · Agotado"}${o.envio ? " · envío incluido" : ""}</small></span>` +
      `<span class="p">${eur(total(o))}</span>${url ? `<a class="ir" href="${esc(url)}" rel="nofollow sponsored noopener" target="_blank" data-t="${esc(o.tienda)}" data-j="${esc(j.id)}">Ir ↗</a>` : "<span></span>"}</li>`;
  };
  const VISIBLES = 8, todas40 = ofs.slice(0, 40);
  const filas = todas40.slice(0, VISIBLES).map(fila).join("");
  const resto = todas40.slice(VISIBLES).map(fila).join("");
  // La imagen del juego en grande (las de Microsoft se piden a más resolución)
  const imgPoster = (imagenDe(j) || "").replace(/(store-images\.s-microsoft\.com\/image\/[^?]+)\?w=\d+/, "$1?w=1280") || null;
  const dtoPoster = j.pvp && j.pvp > total(mejor) ? Math.round((1 - total(mejor) / j.pvp) * 100) : 0;
  // Termómetro: dónde está el precio de ahora entre el mínimo histórico y el precio normal
  const tope = j.pvp || Math.max(0, ...ofs.filter((o) => o.estado !== "usado").map((o) => o.regular || 0));
  // Sin mínimo guardado todavía (juego recién añadido): el más bajo que tenemos es el de ahora
  const minTermo = minimo || total(mejor);
  const termometro = tope > minTermo + 0.5
    ? `<div class="barra"><div class="linea"><span class="punto" style="left:${Math.max(0, Math.min(100, ((total(mejor) - minTermo) / (tope - minTermo)) * 100)).toFixed(1)}%"></span></div><div class="eti"><span>Mínimo <b>${eur(minTermo)}</b></span><span class="ya">Ahora ${eur(total(mejor))}</span><span>Normal <b>${eur(tope)}</b></span></div></div>`
    : "";
  const cuerpo = `${volver("../../")}
<section class="poster${imgPoster ? "" : " sin-img"}">${imgPoster ? `<img src="${esc(imgPoster)}" alt="" width="1280" height="720" fetchpriority="high">` : ""}<div class="poster-in"><div class="poster-d">${j.tipo && TIPO[j.tipo] ? `<span class="tipo">${TIPO[j.tipo]}</span> ` : ""}<h1>${esc(j.titulo)}</h1>
<div class="plats">${plats.map((p) => `<span class="plat">${esc(p)}</span>`).join("")}</div>
<p class="resumen">Comparamos <b>${ofs.length} oferta${ofs.length === 1 ? "" : "s"}</b> de <b>${nTiendas} tienda${nTiendas === 1 ? "" : "s"}</b>` +
    (minimo ? ` · Mínimo histórico <b>${eur(minimo)}</b>` : "") + (j.pvp && j.pvp > total(mejor) ? ` · Precio normal <b>${eur(j.pvp)}</b>` : "") + ` · Actualizado el ${fecha}</p></div>
<div class="etiqueta"><small>Mejor precio</small><b>${eur(total(mejor))}</b><span>${esc(tm)} · ${esc(mejor.plataforma || "")}</span>${dtoPoster >= 5 ? `<i class="poster-dto">−${dtoPoster}%</i>` : ""}</div>${termometro}</div></section>
<div class="cta"><a class="boton" href="../../?q=${encodeURIComponent(j.titulo)}">Ver historial y crear aviso de precio</a><a class="boton sec" href="../../">Comparar otros juegos</a></div>
<div class="lista-of"><ul>${filas}</ul>${resto ? `<details><summary><span class="c">Ver las ${todas40.length} ofertas</span><span class="a">Ver menos</span></summary><ul>${resto}</ul></details>` : ""}</div>
${relacionados.length ? `<h2>Otros juegos</h2><ul class="mas">${relacionados.map((r) => `<li><a href="../${r.id}/">${esc(r.titulo)}</a></li>`).join("")}</ul>` : ""}`;
  return plantilla({ titulo, descripcion, canonica, raiz: "../../", cuerpo, jsonld, imagen: imgPoster });
}

function paginaLista(juegos) {
  const letra = (t) => { const c = t.normalize("NFD").replace(/[̀-ͯ]/g, "")[0]?.toUpperCase() || "#"; return /[A-Z]/.test(c) ? c : "#"; };
  const grupos = {};
  [...juegos].sort((a, b) => a.titulo.localeCompare(b.titulo, "es")).forEach((j) => (grupos[letra(j.titulo)] ||= []).push(j));
  const letras = Object.keys(grupos).sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));
  const cuerpo = `${volver("../")}<h1>Todos los juegos</h1>
<p class="resumen">${juegos.length.toLocaleString("es-ES")} juegos, DLC y tarjetas regalo con precios comparados. Para filtrar por plataforma, tienda o precio, usa el <a href="../">comparador</a>.</p>
<nav class="letras">${letras.map((l) => `<a href="#l-${l === "#" ? "num" : l}">${l}</a>`).join("")}</nav>
${letras.map((l) => `<h2 id="l-${l === "#" ? "num" : l}">${l}</h2><ul class="lista">${grupos[l].map((j) => `<li><a href="../juego/${j.id}/">${esc(j.titulo)}</a></li>`).join("")}</ul>`).join("\n")}`;
  return plantilla({ titulo: "Todos los juegos | Pillao", descripcion: "Lista de todos los videojuegos, DLC y tarjetas regalo cuyos precios compara Pillao en tiendas españolas.", canonica: SITIO + "juegos/", raiz: "../", cuerpo });
}

// ---------- Páginas de ofertas por búsqueda («juegos baratos para PC»…) ----------
// Se rehacen en cada actualización con los precios del momento: el texto es fijo y las listas cambian solas.
// Tiendas que no salen en estas páginas aunque estén en el comparador (claves que pueden no activarse en España)
const FUERA_OFERTAS = new Set(["itad-gamesplanetus"]);
const DLC_TXT = /\b(dlc|season pass|pase de temporada|expansion pack|soundtrack|banda sonora|upgrade|bundle|pack|shadow of the erdtree)\b/i;
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// «Juego: Algo» o «Juego - Algo» cuando «Juego» ya está en el catálogo suele ser una expansión (Sunbreak, Going East!…)
function esExpansion(titulo, titulos) {
  if (DLC_TXT.test(titulo)) return true;
  const partes = titulo.split(/\s*(?::|\s[-–—]\s)\s*/);
  for (let i = 1; i < partes.length; i++) if (titulos.has(norm(partes.slice(0, i).join(" ")))) return true;
  return false;
}

const volver = (destino) => `<a class="volver" href="${destino}" onclick="if(document.referrer.indexOf(location.host)>-1&&history.length>1){history.back();return false}">← Volver</a>`;

function chollosDe(datos, { plataformas, tienda, maxPrecio, soloMin }) {
  const total = (o) => o.precio + (o.envio || 0);
  const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const titulos = new Set(datos.juegos.map((j) => norm(j.titulo)));
  const vale = (o) => plataformas.includes(o.plataforma) && o.estado !== "usado" && o.stock !== false && o.precio > 0 && !FUERA_OFERTAS.has(o.tienda);
  const variasPlat = plataformas.length > 1;
  const filas = [];
  for (const j of datos.juegos) {
    if (j.tipo && j.tipo !== "juego") continue;
    if ((j.pop || 99999) > 6000) continue;                         // juegos conocidos
    if (esExpansion(j.titulo, titulos)) continue;
    const todas = j.ofertas.filter(vale);
    const ofs = tienda ? todas.filter((o) => o.tienda === tienda) : todas;
    if (!ofs.length) continue;
    const m = ofs.reduce((a, b) => (total(b) < total(a) ? b : a));
    const ref = Math.max(j.pvp || 0, ...ofs.map((o) => o.regular || 0));
    const dto = ref > total(m) ? Math.round((1 - total(m) / ref) * 100) : 0;
    if (ref > total(m) * 8) continue;                                // un precio normal 8 veces mayor suele ser un dato raro
    const rivales = todas.filter((o) => o.plataforma === m.plataforma);
    filas.push({ j, m, p: total(m), ref, dto, minimo: j.minimo && total(m) <= j.minimo + 0.005,
      tiendas: new Set((tienda ? rivales : ofs).map((o) => o.tienda)).size,
      elMejor: rivales.every((o) => total(o) >= total(m) - 0.005) });
  }
  const porPop = (a, b) => (a.j.pop || 99999) - (b.j.pop || 99999);
  // Páginas por precio o por mínimo histórico: los juegos que cumplen, agrupados por plataforma
  if (maxPrecio || soloMin) {
    const fs = filas.filter((x) => (!maxPrecio || x.p < maxPrecio) && (!soloMin || x.minimo) && x.dto >= 20);
    const PL = [["PC", ["PC"]], ["PlayStation", ["PS5", "PS4"]], ["Xbox", ["Xbox Series"]], ["Nintendo Switch", ["Switch", "Switch 2"]]];
    const secciones = PL.map(([t, ps]) => ({ id: t.toLowerCase().replace(/\s+/g, "-"), t, xs: fs.filter((x) => ps.includes(x.m.plataforma)).sort(porPop).slice(0, 12) })).filter((s) => s.xs.length);
    return { filas: fs, secciones, vale, variasPlat, total, eur };
  }
  const secciones = [
    { id: "menos-5", t: "Por menos de 5 €", xs: filas.filter((x) => x.p < 5 && x.dto >= 30).sort(porPop) },
    { id: "menos-10", t: "Por menos de 10 €", xs: filas.filter((x) => x.p >= 5 && x.p < 10 && x.dto >= 30).sort(porPop) },
    { id: "menos-20", t: "Por menos de 20 €", xs: filas.filter((x) => x.p >= 10 && x.p < 20 && x.dto >= 30).sort(porPop) },
    { id: "minimos", t: "En su mínimo histórico", xs: filas.filter((x) => x.minimo && x.dto >= 20).sort(porPop) },
    { id: "descuentos", t: "Los mayores descuentos", xs: filas.filter((x) => x.dto >= 60 && (x.j.pop || 99999) <= 2000).sort((a, b) => b.dto - a.dto) },
  ].map((s) => ({ ...s, xs: s.xs.slice(0, 12) })).filter((s) => s.xs.length);
  return { filas, secciones, vale, variasPlat, total, eur };
}

function paginaOfertas(datos, tiendaPorId, { ruta, titulo, h1, intro, plataformas, tienda, desc, cta, preguntas, maxPrecio, soloMin }) {
  const { filas, secciones, vale, variasPlat, total, eur } = chollosDe(datos, { plataformas, tienda, maxPrecio, soloMin });
  const tarjeta = (x) => {
    const t = tiendaPorId[x.m.tienda] || { nombre: x.m.tienda }, img = imagenDe(x.j);
    const plat = variasPlat ? `${esc(x.m.plataforma)} · ` : "";
    const pie = tienda
      ? `${plat}${x.elMejor && x.tiendas > 1 ? `El más barato de ${x.tiendas} tiendas` : esc(t.nombre)}`
      : `${plat}${esc(t.nombre)}${x.tiendas > 1 ? ` · ${x.tiendas} tiendas comparadas` : ""}`;
    return `<li class="of"><a href="../juego/${x.j.id}/">${img ? `<img src="${esc(img)}" alt="" loading="lazy" width="460" height="215">` : `<span class="sin-img"></span>`}
<span class="of-d"><b>${esc(x.j.titulo)}</b><span class="of-p"><strong>${eur(x.p)}</strong>${x.dto ? `<s>${eur(x.ref)}</s><em>−${x.dto} %</em>` : ""}</span>
<span class="of-t">${pie}${x.minimo ? `<br><i>Mínimo histórico</i>` : ""}</span></span></a></li>`;
  };
  const fecha = new Date(datos.actualizado).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
  const nTiendas = new Set(filas.flatMap((x) => x.j.ofertas.filter(vale).map((o) => o.tienda))).size;
  const otras = OFERTAS.filter((o) => o.ruta !== ruta).map((o) => `<a href="../${o.ruta}/">${esc(o.corto)}</a>`).join("");
  const cuerpo = `${volver("../chollos/")}
<section class="hero"><h1>${esc(h1)}</h1><p class="resumen">${intro} Precios actualizados el ${fecha}${tienda ? "" : `, de ${nTiendas} tiendas`}.</p>
<nav class="saltos">${secciones.map((s) => `<a href="#${s.id}">${s.t}</a>`).join("")}</nav></section>
${secciones.map((s) => `<h2 id="${s.id}">${s.t}</h2><ul class="ofertas">${s.xs.map(tarjeta).join("")}</ul>`).join("\n")}
<div class="cta"><a class="boton" href="../${cta.href}">${esc(cta.texto)}</a></div>
<h2>Preguntas frecuentes</h2><div class="faq">${preguntas.map(([q, r]) => `<details><summary>${q}</summary><p>${r}</p></details>`).join("")}</div>
<h2 class="mas-ch">Más chollos</h2><nav class="saltos otras"><a href="../chollos/">Todos los chollos</a>${otras}</nav>`;
  const jsonld = [{
    "@context": "https://schema.org", "@type": "ItemList", name: h1,
    itemListElement: secciones.flatMap((s) => s.xs).slice(0, 30).map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITIO}juego/${x.j.id}/`, name: x.j.titulo })),
  }, {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: preguntas.map(([q, r]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: r } })),
  }];
  return plantilla({ titulo, descripcion: desc, canonica: `${SITIO}${ruta}/`, raiz: "../", cuerpo, jsonld });
}

const P_MINIMO = ["¿Qué significa «mínimo histórico»?", "Que el juego nunca había estado tan barato desde que lo seguimos. Si no te corre prisa, puedes poner un aviso en la ficha del juego y te escribimos cuando baje al precio que tú digas."];
const P_CADA = ["¿Cada cuánto se actualizan los precios?", "Varias veces al día. Aun así, el precio válido es siempre el que marque la tienda al comprar."];
const TODAS_PLATS = ["PC", "PS5", "PS4", "Xbox Series", "Switch", "Switch 2"];
const OFERTAS = [
  { ruta: "juegos-por-menos-de-5-euros", corto: "Menos de 5 €", h1: "Juegos por menos de 5 €", plataformas: TODAS_PLATS, maxPrecio: 5,
    titulo: "Juegos por menos de 5 € hoy: PC, PS5, Xbox y Switch | Pillao",
    intro: "Juegos conocidos rebajados por debajo de 5 € hoy, para PC, PlayStation, Xbox y Nintendo Switch.",
    desc: "Juegos por menos de 5 euros hoy para PC, PS5, PS4, Xbox y Switch, comparando más de 40 tiendas españolas. Actualizado varias veces al día.",
    cta: { href: "", texto: "Buscar más juegos en el comparador" },
    preguntas: [
      ["¿De verdad hay juegos buenos por menos de 5 €?", "Sí: en rebajas muchos juegos conocidos bajan de 5 €, sobre todo en PC y en la eShop de Nintendo. Aquí solo salen juegos completos con al menos un 20 % de descuento sobre su precio normal."],
      P_MINIMO, P_CADA] },
  { ruta: "juegos-en-su-minimo-historico", corto: "Mínimos históricos", h1: "Juegos en su precio más bajo histórico", plataformas: TODAS_PLATS, soloMin: true,
    titulo: "Juegos en su mínimo histórico hoy: nunca habían estado tan baratos | Pillao",
    intro: "Juegos que hoy están más baratos que nunca desde que seguimos su precio, para PC, PlayStation, Xbox y Nintendo Switch.",
    desc: "Juegos de PC, PS5, PS4, Xbox y Switch en su precio más bajo histórico hoy, comparando más de 40 tiendas españolas.",
    cta: { href: "", texto: "Buscar más juegos en el comparador" },
    preguntas: [P_MINIMO, ["¿Volverán a bajar más?", "Puede pasar, pero un mínimo histórico suele ser un buen momento para comprar. Si prefieres esperar, crea un aviso en el comparador y te escribimos si baja todavía más."], P_CADA] },
  { ruta: "juegos-baratos-pc", corto: "PC", h1: "Juegos baratos para PC", plataformas: ["PC"],
    titulo: "Juegos baratos para PC: ofertas de hoy en Steam y tiendas de claves | Pillao",
    intro: "Las mejores ofertas de juegos de PC de hoy, comparando Steam, GOG, Epic, Instant Gaming y decenas de tiendas de claves válidas en España.",
    desc: "Juegos de PC por menos de 5, 10 y 20 €, mínimos históricos y los mayores descuentos de hoy, comparando más de 30 tiendas. Actualizado varias veces al día.",
    cta: { href: "?plat=PC", texto: "Ver todos los juegos de PC en el comparador" },
    preguntas: [
      ["¿Dónde comprar juegos baratos para PC?", "En tiendas oficiales como Steam, GOG o Epic cuando están de rebajas, y en tiendas de claves como Instant Gaming, Fanatical o Green Man Gaming, que suelen estar más baratas todo el año. En Pillao comparamos todas a la vez y te enseñamos la más barata para cada juego."],
      ["¿Son fiables las claves de PC baratas?", "Las de tiendas autorizadas por las editoras (Fanatical, Green Man Gaming, GamesPlanet…) son tan seguras como comprar en Steam. En los mercados de claves (Driffle, K4G, Eneba, G2A) vende gente de terceros: son más baratas, pero conviene mirar la valoración del vendedor. En cada oferta te decimos de qué tipo es la tienda y su nota en Trustpilot."],
      P_MINIMO, P_CADA] },
  { ruta: "juegos-baratos-playstation", corto: "PlayStation", h1: "Juegos baratos para PS5 y PS4", plataformas: ["PS5", "PS4"],
    titulo: "Juegos baratos para PS5 y PS4: ofertas de hoy | Pillao",
    intro: "Las mejores ofertas de juegos de PS5 y PS4 de hoy, comparando PlayStation Store, GAME, Instant Gaming y otras tiendas españolas, en digital y en físico.",
    desc: "Juegos de PS5 y PS4 por menos de 5, 10 y 20 €, mínimos históricos y los mayores descuentos de hoy en PlayStation Store y tiendas españolas.",
    cta: { href: "?plat=PS5,PS4", texto: "Ver todos los juegos de PlayStation en el comparador" },
    preguntas: [
      ["¿Dónde comprar juegos baratos de PS5 y PS4?", "En PlayStation Store cuando hay rebajas, en tiendas de claves como Instant Gaming (códigos para la PlayStation Store española) y en tiendas físicas como GAME. En Pillao comparamos todas y te enseñamos la más barata para cada juego, en digital y en físico."],
      ["¿Los códigos de PlayStation sirven para mi cuenta?", "Solo te enseñamos códigos válidos para cuentas de PlayStation Store de España o de Europa. Los de otras regiones no se pueden canjear en una cuenta española, así que los dejamos fuera."],
      P_MINIMO, P_CADA] },
  { ruta: "juegos-baratos-xbox", corto: "Xbox", h1: "Juegos baratos para Xbox", plataformas: ["Xbox Series"],
    titulo: "Juegos baratos para Xbox Series X|S: ofertas de hoy | Pillao",
    intro: "Las mejores ofertas de juegos de Xbox Series X|S de hoy, comparando Microsoft Store, Instant Gaming, GAME y tiendas de claves válidas en España.",
    desc: "Juegos de Xbox por menos de 5, 10 y 20 €, mínimos históricos y los mayores descuentos de hoy en Microsoft Store y tiendas de claves.",
    cta: { href: "?plat=Xbox%20Series", texto: "Ver todos los juegos de Xbox en el comparador" },
    preguntas: [
      ["¿Dónde comprar juegos baratos de Xbox?", "En Microsoft Store cuando hay rebajas, en tiendas de claves como Instant Gaming y en tiendas físicas como GAME. En Pillao comparamos todas y te enseñamos la más barata para cada juego."],
      ["¿Las claves de Xbox funcionan en España?", "Solo te enseñamos claves válidas para España, Europa o de cualquier región. Las de otras regiones, que suelen necesitar VPN, las dejamos fuera."],
      P_MINIMO, P_CADA] },
  { ruta: "juegos-baratos-nintendo-switch", corto: "Nintendo Switch", h1: "Juegos baratos para Nintendo Switch", plataformas: ["Switch", "Switch 2"],
    titulo: "Juegos baratos para Nintendo Switch y Switch 2: ofertas de hoy | Pillao",
    intro: "Las mejores ofertas de juegos de Nintendo Switch y Switch 2 de hoy, comparando la eShop española, GAME, Instant Gaming y otras tiendas, en digital y en físico.",
    desc: "Juegos de Switch y Switch 2 por menos de 5, 10 y 20 €, mínimos históricos y los mayores descuentos de hoy en la eShop y tiendas españolas.",
    cta: { href: "?plat=Switch,Switch%202", texto: "Ver todos los juegos de Switch en el comparador" },
    preguntas: [
      ["¿Dónde comprar juegos baratos de Switch?", "En la eShop de Nintendo cuando hay rebajas (sobre todo en juegos independientes), en tiendas de códigos como Instant Gaming y en tiendas físicas como GAME. En Pillao comparamos todas y te enseñamos la más barata para cada juego."],
      ["¿Los juegos de Switch funcionan en Switch 2?", "Casi todos, sí: Switch 2 es compatible con la mayoría de juegos de Switch. Los que se venden como «Nintendo Switch 2 Edition» solo funcionan en Switch 2."],
      P_MINIMO, P_CADA] },
  { ruta: "chollos-yuplay", corto: "Yuplay", h1: "Chollos de Yuplay", tienda: "yuplay",
    plataformas: TODAS_PLATS,
    titulo: "Chollos de Yuplay hoy: juegos baratos y mejores precios | Pillao",
    intro: "Las mejores ofertas de hoy en Yuplay, tienda de claves oficiales de PC y Xbox, comparadas con el resto de tiendas. Solo claves que se activan en España.",
    desc: "Juegos baratos en Yuplay hoy: por menos de 5, 10 y 20 €, en su mínimo histórico y con los mayores descuentos, comparados con más de 40 tiendas. Claves oficiales válidas en España.",
    cta: { href: "?tienda=yuplay", texto: "Ver todo Yuplay en el comparador" },
    preguntas: [
      ["¿Cuáles son los mejores juegos baratos de Yuplay?", "Los de esta página: los juegos conocidos con más descuento hoy en Yuplay, ordenados por popularidad y por precio. Cambian varias veces al día con las ofertas de la tienda."],
      ["¿Es fiable Yuplay?", "Sí. Es un distribuidor autorizado de muchas editoras y vende claves oficiales de Steam, GOG, Epic, Ubisoft o Xbox. Tiene una nota de 4,8 sobre 5 en Trustpilot."],
      ["¿Las claves de Yuplay funcionan en España?", "Algunas claves de Yuplay solo valen en ciertos países. Nosotros revisamos cada una y solo te enseñamos las que se activan en España."],
      ["¿Siempre es lo más barato?", "No siempre. En cada juego te decimos si Yuplay es la más barata de todas las tiendas que comparamos; si no lo es, en la ficha del juego ves dónde está mejor."],
      P_MINIMO, P_CADA] },
  { ruta: "chollos-instant-gaming", corto: "Instant Gaming", h1: "Chollos de Instant Gaming", tienda: "instantgaming",
    plataformas: ["PC", "PS5", "PS4", "Xbox Series", "Switch", "Switch 2"],
    titulo: "Chollos de Instant Gaming hoy: juegos baratos y mejores precios | Pillao",
    intro: "Los juegos más baratos y las mejores ofertas de hoy en Instant Gaming para PC, PlayStation, Xbox y Switch, comparadas con el resto de tiendas para que sepas cuándo es de verdad el mejor precio.",
    desc: "Juegos baratos en Instant Gaming hoy: por menos de 5, 10 y 20 €, en su mínimo histórico y con los mayores descuentos, comparados con más de 40 tiendas.",
    cta: { href: "?tienda=instantgaming", texto: "Ver todo Instant Gaming en el comparador" },
    preguntas: [
      ["¿Es fiable Instant Gaming?", "Sí. Es una tienda de claves francesa que compra las claves a distribuidores y las vende ella misma (no es un mercado de terceros). Tiene más de 800.000 reseñas en Trustpilot y una nota de 4,7 sobre 5."],
      ["¿Las claves de Instant Gaming funcionan en España?", "Solo te enseñamos las de España, Europa o de cualquier región. Las de otras regiones las dejamos fuera."],
      ["¿Cuáles son los mejores juegos baratos de Instant Gaming?", "Los de esta página: los juegos conocidos con más descuento hoy en Instant Gaming, ordenados por popularidad y por precio. Cambian varias veces al día con las ofertas de la tienda."],
      ["¿Siempre es lo más barato?", "No siempre. Por eso en cada juego te decimos si Instant Gaming es la más barata de todas las tiendas que comparamos; si no lo es, en la ficha del juego ves dónde está mejor."],
      P_MINIMO, P_CADA] },
];

// Cómo es el banner de cada página de chollos en /chollos/
const PC_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
const EURO5_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" font-family="Bricolage Grotesque,Arial Black,sans-serif" fill="currentColor">5€</text></svg>';
const MIN_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l6 6 4-4 8 8"/><path d="M21 11v5h-5"/></svg>';
const BANNERS = {
  "juegos-por-menos-de-5-euros": { t: "Juegos por menos de 5 €", sub: "Todas las plataformas", c1: "#b45309", c2: "#7c2d12", ico: EURO5_ICO },
  "juegos-en-su-minimo-historico": { t: "En su mínimo histórico", sub: "Nunca habían estado tan baratos", c1: "#0f766e", c2: "#134e4a", ico: MIN_ICO },
  "chollos-instant-gaming": { t: "Chollos de Instant Gaming", sub: "PC y consolas", c1: "#ff5a00", c2: "#c2185b", logo: "instant-gaming.com" },
  "chollos-yuplay": { t: "Chollos de Yuplay", sub: "Claves oficiales de PC y Xbox", c1: "#5b21b6", c2: "#0f766e", logo: "yuplay.com" },
  "juegos-baratos-pc": { t: "Chollos de PC", sub: "Steam, GOG, Epic y tiendas de claves", c1: "#3b2bd6", c2: "#0e7490", ico: PC_ICO },
  "juegos-baratos-playstation": { t: "Chollos de PlayStation", sub: "PS5 y PS4", c1: "#0050b5", c2: "#00439c", logo: "playstation.com" },
  "juegos-baratos-xbox": { t: "Chollos de Xbox", sub: "Xbox Series X|S", c1: "#107c10", c2: "#0b4f0b", logo: "xbox.com" },
  "juegos-baratos-nintendo-switch": { t: "Chollos de Nintendo", sub: "Switch y Switch 2", c1: "#e60012", c2: "#a3000d", logo: "nintendo.com" },
};
function paginaChollos(datos) {
  const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00a0€";
  const banners = Object.entries(BANNERS).map(([ruta, b]) => {
    const o = OFERTAS.find((x) => x.ruta === ruta);
    const { secciones } = chollosDe(datos, o);
    const vistos = new Map();
    for (const sec of secciones) for (const x of sec.xs) if (!vistos.has(x.j.id)) vistos.set(x.j.id, x);
    const xs = [...vistos.values()];
    if (!xs.length) return "";
    const desde = Math.min(...xs.map((x) => x.p));
    // Sin juegos de deporte: sus portadas llevan fotos de deportistas reales
    const portadas = xs.filter((x) => imagenDe(x.j) && !/\b(ea sports|fc \d|fifa|nba 2k|football manager|madden|nhl|mlb|efootball|wwe|ufc|f1 \d|top spin|tennis)\b/i.test(x.j.titulo)).sort((a, c) => (a.j.pop || 99999) - (c.j.pop || 99999)).slice(0, 3);
    return `<a class="banner" href="../${ruta}/" style="--c1:${b.c1};--c2:${b.c2}">
<span class="b-logo">${b.logo ? `<img src="../logos/${b.logo}.png" alt="">` : b.ico}</span>
<span class="b-txt"><b>${esc(b.t)}</b><small>${esc(b.sub)}<span class="b-cnt"> · ${xs.length} chollos hoy, desde ${eur(desde)}</span></small><span class="b-num">${xs.length} chollos<small>desde ${eur(desde)}</small></span><span class="b-ir">Ver chollos →</span></span>
<span class="b-covs">${portadas.map((x) => `<img src="${esc(imagenDe(x.j))}" alt="" loading="lazy">`).join("")}</span></a>`;
  }).join("\n");
  const cuerpo = `${volver("../")}
<section class="hero"><h1>Chollos de hoy</h1><p class="resumen">Las mejores ofertas de videojuegos de hoy, por plataforma y por tienda. Se actualizan solas varias veces al día.</p></section>
<div class="banners">${banners}</div>`;
  return plantilla({ titulo: "Chollos de videojuegos hoy: PC, PlayStation, Xbox, Switch e Instant Gaming | Pillao",
    descripcion: "Los mejores chollos de videojuegos de hoy para PC, PS5, PS4, Xbox y Nintendo Switch, y las ofertas de Instant Gaming, comparando más de 30 tiendas.",
    canonica: `${SITIO}chollos/`, raiz: "../", cuerpo });
}

async function main() {
  const datos = JSON.parse(await readFile(join(RAIZ, "precios.json"), "utf8"));
  BUSCADOR = datos.buscador || "";
  const tiendaPorId = Object.fromEntries(datos.tiendas.map((t) => [t.id, t]));
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });

  // 1. La web de siempre
  for (const f of await readdir(RAIZ)) {
    if (/^(index|legal)\.html$/.test(f)) await writeFile(join(SALIDA, f), proteger(await readFile(join(RAIZ, f), "utf8"), datos.buscador));
    else if (/\.(html|txt|svg|png|ico)$/.test(f) || f === "minimos.json") await cp(join(RAIZ, f), join(SALIDA, f));
  }
  for (const d of ["fonts", "data/historial", "logos"]) if (existsSync(join(RAIZ, d))) await cp(join(RAIZ, d), join(SALIDA, d), { recursive: true });
  // El catálogo en dos partes: los juegos más populares (y las tiendas y packs) llegan primero y se ven al momento;
  // el resto lo pide la web en segundo plano y lo añade sin que se note
  const todo = comprimir(datos);
  const PRIMEROS = 800;
  const primeros = new Set([...todo.juegos].sort((a, b) => (a.pop || 99999) - (b.pop || 99999)).slice(0, PRIMEROS).map((j) => j.id));
  // Los totales los calcula la web con todo el catálogo; aquí se guardan los de la última vez para enseñarlos desde el primer momento
  const totales = { juegos: todo.juegos.filter((j) => j.ofertas.length).length, ofertas: todo.juegos.reduce((n, j) => n + j.ofertas.length, 0) };
  await writeFile(join(SALIDA, "precios.json"), JSON.stringify({ ...todo, totales, juegos: todo.juegos.filter((j) => primeros.has(j.id)), resto: "precios-resto.json" }) + "\n");
  await writeFile(join(SALIDA, "precios-resto.json"), JSON.stringify({ prefijos: todo.prefijos, juegos: todo.juegos.filter((j) => !primeros.has(j.id)) }) + "\n");
  await writeFile(join(SALIDA, ".nojekyll"), "");
  // Con dominio propio la web está en la raíz: aquí sí vale un robots.txt que indique el sitemap
  await writeFile(join(SALIDA, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /panel.html\n\nSitemap: ${SITIO}sitemap.xml\n`);
  await writeFile(join(SALIDA, "paginas.css"), estilos());

  // 2. Una página por juego
  const juegos = datos.juegos.filter((j) => /^[a-z0-9-]{1,80}$/.test(j.id));
  let n = 0;
  const hechas = [];
  for (let i = 0; i < juegos.length; i++) {
    const j = juegos[i];
    // juegos de alrededor en popularidad: enlaces internos para que Google llegue a todos
    const relacionados = juegos.slice(Math.max(0, i - 4), i).concat(juegos.slice(i + 1, i + 9)).slice(0, 10);
    const html = paginaJuego(j, tiendaPorId, relacionados, datos.actualizado);
    if (!html) continue;
    await mkdir(join(SALIDA, "juego", j.id), { recursive: true });
    await writeFile(join(SALIDA, "juego", j.id, "index.html"), html);
    hechas.push(j); n++;
  }

  // 3. Páginas de ofertas por búsqueda
  for (const o of OFERTAS) { await mkdir(join(SALIDA, o.ruta), { recursive: true }); await writeFile(join(SALIDA, o.ruta, "index.html"), paginaOfertas(datos, tiendaPorId, o)); }
  await mkdir(join(SALIDA, "chollos"), { recursive: true }); await writeFile(join(SALIDA, "chollos", "index.html"), paginaChollos(datos));

  // 4. Lista de todos los juegos y mapa del sitio
  await mkdir(join(SALIDA, "juegos"), { recursive: true });
  await writeFile(join(SALIDA, "juegos", "index.html"), paginaLista(hechas));
  const dia = datos.actualizado.slice(0, 10);
  const urls = [SITIO, SITIO + "juegos/", `${SITIO}chollos/`, ...OFERTAS.map((o) => `${SITIO}${o.ruta}/`), ...hechas.map((j) => `${SITIO}juego/${j.id}/`)];
  await writeFile(join(SALIDA, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${u}</loc><lastmod>${dia}</lastmod></url>`).join("\n") + "\n</urlset>\n");
  console.log(`Web lista en _site: ${n} páginas de juego, sitemap con ${urls.length} direcciones (${SITIO}).`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
