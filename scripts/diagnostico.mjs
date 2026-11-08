// Diagnóstico temporal: precios dentro del estado de Eneba + campos de stock/región de Instant Gaming
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
let t = await (await fetch("https://www.eneba.com/es/store/all?text=battlefield%206", { headers: H })).text();
const m = t.match(/<script id="__APOLLO_STATE__" type="application\/json">([\s\S]*?)<\/script>/);
const st = JSON.parse(m[1]);
console.log("ROOT keys:", Object.keys(st.ROOT_QUERY).map((k) => k.slice(0, 90)).join("\n   "));
const vistos = []; const visto = new Set();
(function rec(o, ruta) { if (!o || typeof o !== "object" || visto.has(o)) return; visto.add(o);
  if (o.name && (o.cheapestAuction || o.price || o.slug) && vistos.length < 3) vistos.push([ruta.slice(-120), JSON.stringify(o).slice(0, 1200)]);
  for (const [k, v] of Object.entries(o)) rec(v, ruta + "/" + k.slice(0, 40)); })(st, "");
for (const [r, s] of vistos) console.log("ENODO", r, "\n  ", s);
t = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=battlefield%206", { headers: H })).text();
const i = t.indexOf("window.searchResults = "); const j = t.indexOf(";\n", i);
const sr = JSON.parse(t.slice(i + 23, j));
for (const h of sr.hits.slice(0, 5)) console.log("IG", h.prod_id, h.fullname, "|", h.region, "| eur", h.price_eur, "| stock", h.has_stock, "| wl", JSON.stringify(h.country_whitelist).slice(0, 60), "| bl", JSON.stringify(h.country_blacklist).slice(0, 60), "| type", h.type, "| dlc", h.is_dlc);
