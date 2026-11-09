// Diagnóstico temporal: qué fecha de lanzamiento da cada fuente
const UA = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0)", "Accept-Language": "es-ES,es;q=0.9" };
function bloqueJSON(t, desde) { const i = t.indexOf("{", desde); let d = 0, s = false, e = false; for (let k = i; k < t.length; k++) { const c = t[k]; if (s) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === "{") d++; else if (c === "}" && --d === 0) return t.slice(i, k + 1); } }
// Instant Gaming
for (const q of ["grand theft auto vi", "battlefield"]) {
  const html = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=" + encodeURIComponent(q), { headers: UA })).text();
  const hits = JSON.parse(bloqueJSON(html, html.indexOf("window.searchResults = "))).hits || [];
  console.log("IG CLAVES", Object.keys(hits[0] || {}).join(","));
  hits.slice(0, 6).forEach((h) => console.log("IG", h.name, "| preorder", h.preorder, "| stock", h.has_stock, "| precio", h.price_eur, "|", JSON.stringify(Object.fromEntries(Object.entries(h).filter(([k]) => /date|release|time|launch|created|publish/i.test(k))))));
}
// Steam: búsqueda (columna de fecha)
const st = await (await fetch("https://store.steampowered.com/search/results/?query&start=0&count=8&filter=topsellers&cc=es&l=spanish&infinite=1", { headers: UA })).json();
[...st.results_html.matchAll(/<span class="title">([^<]+)<\/span>[\s\S]*?search_released[^>]*>\s*([^<]*)</g)].slice(0, 8).forEach((m) => console.log("STEAM", m[1], "→", JSON.stringify(m[2].trim())));
const st2 = await (await fetch("https://store.steampowered.com/search/results/?query&start=0&count=6&filter=comingsoon&cc=es&l=spanish&infinite=1", { headers: UA })).json();
[...st2.results_html.matchAll(/<span class="title">([^<]+)<\/span>[\s\S]*?search_released[^>]*>\s*([^<]*)</g)].slice(0, 6).forEach((m) => console.log("STEAM PROX", m[1], "→", JSON.stringify(m[2].trim())));
// Nintendo
const n = await (await fetch("https://searching.nintendo-europe.com/es/select?q=*&fq=type:GAME&fq=nsuid_txt:*&sort=popularity%20asc&rows=4&start=0&wt=json", { headers: UA })).json();
n.response.docs.forEach((d) => console.log("ESHOP", d.title, JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => /date|release/i.test(k))))));
// Microsoft
const ms = await (await fetch("https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NBLGGH4R315,9PNJXVCVWD4K&market=ES&languages=es-es", { headers: UA })).json();
(ms.Products || []).forEach((p) => console.log("MS", p.LocalizedProperties?.[0]?.ProductTitle, JSON.stringify(p.MarketProperties?.[0]?.OriginalReleaseDate)));
