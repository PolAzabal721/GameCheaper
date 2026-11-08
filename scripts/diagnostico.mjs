const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
const t = await (await fetch("https://www.xtralife.com/robots.txt", { headers: H })).text();
console.log("XTRA sitemaps:", t.match(/Sitemap:.*$/gim));
for (const s of (t.match(/Sitemap:\s*(\S+)/gi) || []).map((x) => x.split(/\s+/)[1]).slice(0, 3)) {
  const r = await fetch(s, { headers: H }); const x = await r.text(); const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log("XTRA mapa", s, r.status, "locs", locs.length, locs.slice(0, 6));
  const sub = locs.find((l) => /product|producto|juego/i.test(l)) || locs[0];
  if (sub && /\.xml/.test(sub)) { const y = await (await fetch(sub, { headers: H })).text(); const l2 = [...y.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]); console.log("   sub", sub, "locs", l2.length, l2.slice(0, 5));
    const prod = l2.find((l) => /mario|zelda|fifa|fc-2|playstation|switch/i.test(l)) || l2[0];
    if (prod) { const p = await (await fetch(prod, { headers: H })).text(); console.log("   PRODUCTO", prod, p.length, "| ld+json:", p.split("application/ld+json").length - 1, "| precio:", (p.match(/"price"\s*:\s*"?[\d.,]+/) || [])[0], (p.match(/\d+,\d{2}\s?€/) || [])[0]); } }
}
const a = await (await fetch("https://www.compraonline.alcampo.es/robots.txt", { headers: H })).text();
console.log("ALCAMPO robots:\n" + a.slice(0, 800));
