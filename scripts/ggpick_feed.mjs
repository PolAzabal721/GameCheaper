// Catálogo de GGPick → feeds/ggpick.json (no tiene feed ni API: se lee su web, que su robots.txt permite).
// De cada página sale el bloque JSON-LD con las ofertas y sus precios (en dólares):
//  · juegos (/games/<juego>/): solo las claves («… Global Key»), nunca las cuentas («Account»);
//  · tarjetas regalo (/gift-card/…) y recargas de juegos (/top-up/…): cada importe es un producto.
// Las suscripciones que son cuentas compartidas (netflix-account, chat-gpt-account…) no entran.
import { writeFile, mkdir } from "node:fs/promises";
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-ES,es;q=0.9" };
const AFI = "https://rkdro.com/g/ja7n12si6wd007a92f8d15e49ef059/?ulp=";   // enlace de afiliado de GGPick (Admitad)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const FIN = Date.now() + +(process.env.GGPICK_MIN || 12) * 60000;
const limpia = (s) => String(s || "").replace(/^(Buy|Comprar)\s+/i, "").replace(/\s+[—–-]\s+(Instant|Entrega|Recarga|Delivery).*$/i, "").replace(/\s*\|\s*GGPICK.*$/i, "").trim();
const sm = await (await fetch("https://ggpick.com/sitemap.xml", { headers: H })).text();
const urls = [...new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /\/en\//.test(u)))]
  .filter((u) => /\/en\/games\/[^/]+\/$/.test(u) || /\/en\/(gift-card|top-up)\/[^/]+\/$/.test(u))
  .filter((u) => !/account/.test(u));
const filas = [];
let leidas = 0;
for (const u of urls) {
  if (Date.now() > FIN) break;
  try {
    const h = await (await fetch(u, { headers: H })).text(); leidas++;
    for (const [, js] of h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      let d; try { d = JSON.parse(js); } catch { continue; }
      for (const p of d["@graph"] || [d]) {
        if (p["@type"] !== "Product" || !p.offers) continue;
        const img = typeof p.image === "string" ? p.image : Array.isArray(p.image) ? p.image[0] : "";
        const ofs = p.offers.offers || [p.offers];
        const base = limpia(p.name);
        for (const o of ofs) {
          if (o.priceCurrency !== "USD" || !(+o.price > 0) || /OutOfStock/.test(o.availability || "")) continue;
          const variante = String(o.name || "").split(" - ").slice(1).join(" - ").trim();
          if (/\/games\//.test(u)) {
            if (!/key/i.test(variante) || /account/i.test(variante)) continue;   // solo claves
            const drm = (variante.match(/\b(Steam|Epic|Rockstar|EA App|Ubisoft|Xbox|PSN|Nintendo|GOG|Battle\.net)\b/i) || ["Steam"])[0];
            const plat = /xbox/i.test(drm) ? "Xbox Series" : /psn/i.test(drm) ? "PS5" : /nintendo/i.test(drm) ? "Switch" : "PC";
            filas.push({ n: base, t: "", pl: plat, p: +o.price, u: AFI + encodeURIComponent(o.url || u), d: drm, reg: /global/i.test(variante) ? "GLOBAL" : "?", img });
          } else {
            if (/account/i.test(variante + base)) continue;
            const recarga = /\/top-up\//.test(u);
            const moneda = (base.match(/\(([A-Z]{3})\)/) || [])[1] || "";
            const nombre = (base.replace(/\s*\([A-Z]{3}\)\s*/, " ").trim() + " " + variante).replace(/\s+/g, " ").trim();
            filas.push({ n: nombre, t: "tarjeta", pl: "Tarjeta regalo", p: +o.price, u: AFI + encodeURIComponent(o.url || u), d: recarga ? "Recarga" : "Código digital", reg: moneda || "GLOBAL", rec: recarga ? 1 : 0, img });
          }
        }
      }
    }
  } catch {}
  await esperar(400);
}
await mkdir("feeds", { recursive: true });
await writeFile("feeds/ggpick.json", JSON.stringify(filas));
console.log(`GGPick: ${leidas} de ${urls.length} páginas leídas, ${filas.length} productos (${filas.filter((f) => !f.t).length} claves de juegos)`);
