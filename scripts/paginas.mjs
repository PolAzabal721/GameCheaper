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
const SALIDA = join(RAIZ, "_site");
const SITIO = (process.env.SITIO_URL || "https://polazabal721.github.io/GameCheaper/").replace(/\/?$/, "/");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const total = (o) => o.precio + (o.envio || 0);
const TIPO = { dlc: "DLC", edicion: "Edición especial", tarjeta: "Tarjeta regalo" };

// Política de seguridad (CSP): el navegador solo ejecuta los scripts de Pillao (por su huella exacta),
// solo se conecta con la propia web y con el buscador, y no deja que otra web meta Pillao dentro ni envíe formularios fuera.
function proteger(html, buscador) {
  const huellas = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
  const csp = [
    "default-src 'self'", `script-src 'self' ${huellas.join(" ")}`.trim(), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https://shared.akamai.steamstatic.com https://cdn.akamai.steamstatic.com https://fs-prod-cdn.nintendo-europe.com https://store-images.s-microsoft.com https://image.api.playstation.com",
    "font-src 'self'", `connect-src 'self'${buscador ? " " + new URL(buscador).origin : ""}`, "object-src 'none'", "base-uri 'self'",
    "form-action 'self'", "upgrade-insecure-requests",
  ].join("; ");
  const metas = `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin">`;
  return html.replace(/<meta charset="utf-8">/i, (m) => m + metas);
}

function estilos() {
  return `:root{--bg:#eef0f5;--surface:#fff;--surface-2:#f6f7fb;--ink:#141a2e;--muted:#5a6280;--line:#d9dce8;--accent:#2741d6;--tag:#ffd23f;--tag-ink:#1d1600;--good:#11804a}
@media (prefers-color-scheme:dark){:root{--bg:#0e1120;--surface:#161a2c;--surface-2:#1c2136;--ink:#e8ebf6;--muted:#98a0bf;--line:#2a3150;--accent:#8fa0ff;--good:#4fd18b;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.5}
a{color:var(--accent)}.wrap{max-width:900px;margin:0 auto;padding:0 16px}
header{background:var(--surface);border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:60px}
.logo{font-family:"Bricolage Grotesque","Arial Black",sans-serif;font-weight:800;font-size:24px;color:var(--ink);text-decoration:none;letter-spacing:-.02em}
.logo span{background:var(--tag);color:var(--tag-ink);border-radius:5px;font-size:13px;padding:1px 5px;margin-left:4px;vertical-align:4px}
main{padding:24px 0 40px;display:flex;flex-direction:column;gap:18px}.migas{font-size:13px;color:var(--muted)}.migas a{color:var(--muted)}
.ficha{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;align-items:flex-start}.ficha>div:first-child{flex:1 1 380px;min-width:0}
.tabla{overflow-x:auto;border-radius:14px}
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
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;padding:18px 0 30px}footer nav{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px}footer a{color:var(--muted)}
@media(max-width:600px){h1{font-size:24px}.ficha>div:first-child{flex-basis:100%}.etiqueta{align-self:flex-start}th:nth-child(3),td:nth-child(3){display:none}th,td{padding:9px 8px;font-size:13px}td a .l{display:none}}`;
}

function plantilla({ titulo, descripcion, canonica, raiz, cuerpo, jsonld }) {
  return proteger(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${canonica}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}"><meta property="og:url" content="${canonica}"><meta property="og:locale" content="es_ES"><meta property="og:site_name" content="Pillao">
<link rel="stylesheet" href="${raiz}fonts/fuentes.css"><link rel="stylesheet" href="${raiz}paginas.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head><body><header><div class="wrap"><a class="logo" href="${raiz}">Pillao<span>€</span></a><a class="ir-app" href="${raiz}">Ir al comparador →</a></div></header>
<main class="wrap">${cuerpo}</main>
<footer><div class="wrap">Pillao compara precios de videojuegos y no vende productos. Los precios son orientativos: el válido es siempre el de cada tienda. Algunos enlaces son de afiliado: si compras tras pulsarlos, la tienda puede pagarnos una comisión, sin coste para ti.
<nav><a href="${raiz}legal.html#aviso-legal">Aviso legal</a><a href="${raiz}legal.html#condiciones">Condiciones de uso</a><a href="${raiz}legal.html#privacidad">Privacidad</a><a href="${raiz}legal.html#cookies">Cookies</a></nav></div></footer>
</body></html>
`);
}

function enlaceOferta(o, j, tiendaPorId) {
  if (o.url) return o.url;
  const t = tiendaPorId[o.tienda];
  return t?.busqueda ? t.busqueda.replace("{q}", encodeURIComponent(j.titulo)) : null;
}

function paginaJuego(j, tiendaPorId, relacionados, actualizado) {
  // Mismas tiendas que la web enseña por defecto (de los revendedores de claves, solo Instant Gaming)
  const ofs = j.ofertas.filter((o) => { const t = tiendaPorId[o.tienda]; return !(t?.tipo === "revendedor" && o.tienda !== "instantgaming"); })
    .sort((a, b) => (b.stock - a.stock) || (total(a) - total(b)));
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
  const jsonld = [{
    "@context": "https://schema.org", "@type": "Product", name: j.titulo,
    ...(j.tipo === "tarjeta" && j.marca ? { brand: { "@type": "Brand", name: j.marca } } : {}),
    offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: Math.min(...(nuevos.length ? nuevos : [total(mejor)])).toFixed(2),
      highPrice: Math.max(...(nuevos.length ? nuevos : [total(mejor)])).toFixed(2), offerCount: ofs.length },
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Pillao", item: SITIO },
      { "@type": "ListItem", position: 2, name: "Juegos", item: SITIO + "juegos/" },
      { "@type": "ListItem", position: 3, name: j.titulo, item: canonica },
    ],
  }];
  const filas = ofs.slice(0, 40).map((o) => {
    const t = tiendaPorId[o.tienda], url = enlaceOferta(o, j, tiendaPorId);
    const forma = o.estado === "usado" ? "2ª mano" : o.formato === "fisico" ? "En disco" : "Digital";
    return `<tr${o === mejor ? ' class="mejor"' : ""}><td><b>${esc(t?.nombre || o.tienda)}</b>${o.stock ? "" : ' <span class="agotado">Agotado</span>'}</td><td>${esc(o.plataforma || "—")}</td><td>${forma}${o.condicion ? " · " + esc(o.condicion) : ""}</td>` +
      `<td class="p">${eur(total(o))}${o.envio ? ` <span class="agotado">(envío incl.)</span>` : ""}</td><td>${url ? `<a href="${esc(url)}" rel="nofollow sponsored noopener" target="_blank">Ver<span class="l"> oferta</span> ↗</a>` : ""}</td></tr>`;
  }).join("");
  const cuerpo = `<nav class="migas"><a href="../../">Pillao</a> › <a href="../../juegos/">Juegos</a> › ${esc(j.titulo)}</nav>
<section class="ficha"><div>${j.tipo && TIPO[j.tipo] ? `<span class="tipo">${TIPO[j.tipo]}</span> ` : ""}<h1>${esc(j.titulo)}</h1>
<div class="plats">${plats.map((p) => `<span class="plat">${esc(p)}</span>`).join("")}</div>
<p class="resumen">Comparamos <b>${ofs.length} oferta${ofs.length === 1 ? "" : "s"}</b> de <b>${nTiendas} tienda${nTiendas === 1 ? "" : "s"}</b>.` +
    (minimo ? ` Mínimo histórico: <b>${eur(minimo)}</b>.` : "") + (j.pvp && j.pvp > total(mejor) ? ` Precio normal: <b>${eur(j.pvp)}</b>.` : "") + ` Actualizado el ${fecha}.</p></div>
<div class="etiqueta"><small>Mejor precio</small><b>${eur(total(mejor))}</b><span>${esc(tm)} · ${esc(mejor.plataforma || "")}</span></div></section>
<div class="cta"><a class="boton" href="../../?q=${encodeURIComponent(j.titulo)}">Ver historial y crear aviso de precio</a><a class="boton sec" href="../../">Comparar otros juegos</a></div>
<div class="tabla"><table><thead><tr><th>Tienda</th><th>Plataforma</th><th>Formato</th><th>Precio</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
${relacionados.length ? `<h2>Otros juegos</h2><ul class="mas">${relacionados.map((r) => `<li><a href="../${r.id}/">${esc(r.titulo)}</a></li>`).join("")}</ul>` : ""}`;
  return plantilla({ titulo, descripcion, canonica, raiz: "../../", cuerpo, jsonld });
}

function paginaLista(juegos) {
  const letra = (t) => { const c = t.normalize("NFD").replace(/[̀-ͯ]/g, "")[0]?.toUpperCase() || "#"; return /[A-Z]/.test(c) ? c : "#"; };
  const grupos = {};
  [...juegos].sort((a, b) => a.titulo.localeCompare(b.titulo, "es")).forEach((j) => (grupos[letra(j.titulo)] ||= []).push(j));
  const letras = Object.keys(grupos).sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));
  const cuerpo = `<nav class="migas"><a href="../">Pillao</a> › Todos los juegos</nav><h1>Todos los juegos</h1>
<p class="resumen">${juegos.length.toLocaleString("es-ES")} juegos, DLC y tarjetas regalo con precios comparados. Para filtrar por plataforma, tienda o precio, usa el <a href="../">comparador</a>.</p>
<nav class="letras">${letras.map((l) => `<a href="#l-${l === "#" ? "num" : l}">${l}</a>`).join("")}</nav>
${letras.map((l) => `<h2 id="l-${l === "#" ? "num" : l}">${l}</h2><ul class="lista">${grupos[l].map((j) => `<li><a href="../juego/${j.id}/">${esc(j.titulo)}</a></li>`).join("")}</ul>`).join("\n")}`;
  return plantilla({ titulo: "Todos los juegos | Pillao", descripcion: "Lista de todos los videojuegos, DLC y tarjetas regalo cuyos precios compara Pillao en tiendas españolas.", canonica: SITIO + "juegos/", raiz: "../", cuerpo });
}

async function main() {
  const datos = JSON.parse(await readFile(join(RAIZ, "precios.json"), "utf8"));
  const tiendaPorId = Object.fromEntries(datos.tiendas.map((t) => [t.id, t]));
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });

  // 1. La web de siempre
  for (const f of await readdir(RAIZ)) {
    if (/^(index|legal)\.html$/.test(f)) await writeFile(join(SALIDA, f), proteger(await readFile(join(RAIZ, f), "utf8"), datos.buscador));
    else if (/\.(html|txt)$/.test(f) || f === "minimos.json") await cp(join(RAIZ, f), join(SALIDA, f));
  }
  for (const d of ["fonts", "data/historial"]) if (existsSync(join(RAIZ, d))) await cp(join(RAIZ, d), join(SALIDA, d), { recursive: true });
  await writeFile(join(SALIDA, "precios.json"), JSON.stringify({ ...datos, paginas: true }) + "\n");
  await writeFile(join(SALIDA, ".nojekyll"), "");
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

  // 3. Lista de todos los juegos y mapa del sitio
  await mkdir(join(SALIDA, "juegos"), { recursive: true });
  await writeFile(join(SALIDA, "juegos", "index.html"), paginaLista(hechas));
  const dia = datos.actualizado.slice(0, 10);
  const urls = [SITIO, SITIO + "juegos/", ...hechas.map((j) => `${SITIO}juego/${j.id}/`)];
  await writeFile(join(SALIDA, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${u}</loc><lastmod>${dia}</lastmod></url>`).join("\n") + "\n</urlset>\n");
  console.log(`Web lista en _site: ${n} páginas de juego, sitemap con ${urls.length} direcciones (${SITIO}).`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
