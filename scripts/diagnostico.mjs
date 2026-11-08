// Diagnóstico temporal: índice público (robots.txt / sitemap) de la PS Store
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
const get = async (u) => { const r = await fetch(u, { headers: H }); const t = await r.text(); return [r.status, t, r.headers.get("content-type")]; };
let [s, t] = await get("https://store.playstation.com/robots.txt");
console.log("ROBOTS", s, "\n" + t.slice(0, 1500));
const maps = [...t.matchAll(/Sitemap:\s*(\S+)/gi)].map((m) => m[1]);
for (const m of maps.slice(0, 4)) {
  const [s2, t2, ct] = await get(m);
  const locs = [...t2.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
  console.log("MAPA", m, s2, ct, t2.length, "locs", locs.length, locs.filter((l) => /es-es|sitemap/i.test(l)).slice(0, 8));
  const es = locs.find((l) => /es-es/i.test(l)) || locs.find((l) => /sitemap/i.test(l));
  if (es && /xml|sitemap/.test(es)) { const [s3, t3] = await get(es); const l3 = [...t3.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]); console.log("  SUB", es, s3, "locs", l3.length, l3.slice(0, 5)); }
}
