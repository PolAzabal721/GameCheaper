const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-MX,es;q=0.9" };
const t = async (n, f) => { try { console.log("\n=== " + n); await f(); } catch (e) { console.log("ERROR " + e.message); } };
await t("nintendo sitemap", async () => {
  const r = await fetch("https://www.nintendo.com/es-mx/sitemap.xml", { headers: H }); const b = await r.text(); console.log(r.status, (b.match(/<loc>[^<]+<\/loc>/g) || []).slice(0, 15).join(" "));
  const r2 = await fetch("https://www.nintendo.com/es-mx/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/", { headers: H }); const b2 = await r2.text();
  console.log("ficha", r2.status, [...new Set(b2.match(/"nsuid"\s*:\s*"?\d+"?|"sku"\s*:\s*"[^"]+"|"price"\s*:\s*\{[^}]{0,120}|"platform"\s*:\s*"[^"]+"/g) || [])].slice(0, 8));
});
await t("ig", async () => {
  const r = await fetch("https://www.instant-gaming.com/es/2361-comprar-juego-steam-elden-ring/", { headers: { ...H, Cookie: "currency=USD" } }); const b = await r.text();
  const i = b.indexOf('itemprop="priceCurrency"'); console.log(b.slice(i - 700, i + 200).replace(/\s+/g, " "));
  const s = await (await fetch("https://www.instant-gaming.com/sitemap_ig_products_es.xml", { headers: H })).text(); const l = s.match(/<loc>[^<]+<\/loc>/g) || []; console.log("sitemap es", l.length, l.filter((x) => /latam|america-latina|argentina|mexico/.test(x)).slice(0, 8));
});
await t("yuplay", async () => {
  const d = await (await fetch("https://www.yuplay.com/api/products/?page=1", { headers: { ...H, Accept: "application/json" } })).json();
  const p = d.products[1]; console.log(JSON.stringify(p).slice(0, 1500));
  const r = await fetch("https://www.yuplay.com" + p.link, { headers: H }); const b = await r.text(); console.log("ficha", r.status, [...new Set(b.match(/[^<>]{0,60}(region|Region|activat|Activat|countries|Countries)[^<>]{0,80}/g) || [])].slice(0, 15));
});
