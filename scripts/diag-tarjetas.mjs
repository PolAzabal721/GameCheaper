// Diagnóstico temporal: qué tarjetas regalo devuelve Instant Gaming y por qué se descartan
const UA = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0)", "Accept-Language": "es-ES,es;q=0.9" };
function bloqueJSON(t, desde) { const i = t.indexOf("{", desde); let d = 0, s = false, e = false; for (let k = i; k < t.length; k++) { const c = t[k]; if (s) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === "{") d++; else if (c === "}" && --d === 0) return t.slice(i, k + 1); } }
for (const q of ["playstation", "psn", "playstation network", "tarjeta playstation", "playstation plus", "playstation store", "xbox", "tarjeta xbox", "xbox gift card", "steam", "steam gift card", "google play", "amazon", "apple", "nintendo eshop"]) {
  const html = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=" + encodeURIComponent(q), { headers: UA })).text();
  const i = html.indexOf("window.searchResults = ");
  const hits = i < 0 ? [] : JSON.parse(bloqueJSON(html, i)).hits || [];
  console.log(`\n=== ${q}: ${hits.length} resultados (total ${i < 0 ? "?" : JSON.parse(bloqueJSON(html, i)).nbHits})`);
  for (const h of hits) if (h.is_prepaid || h.is_subscription || /card|tarjeta|plus|gift|saldo|wallet/i.test(h.name))
    console.log(JSON.stringify({ n: h.name, p: h.price_eur, r: h.region, rf: h.region_fulltext, wl: h.country_whitelist, bl: h.country_blacklist, pre: h.is_prepaid, sub: h.is_subscription, st: h.has_stock, id: h.prod_id }));
  await new Promise((r) => setTimeout(r, 1500));
}
