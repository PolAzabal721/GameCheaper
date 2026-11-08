// Diagnóstico temporal: posibles sitemaps de la PS Store
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
for (const u of ["https://store.playstation.com/sitemap.xml", "https://store.playstation.com/es-es/sitemap.xml", "https://store.playstation.com/sitemap/es-es.xml", "https://www.playstation.com/robots.txt"]) {
  try { const r = await fetch(u, { headers: H }); const t = await r.text(); const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
    console.log("==", u, r.status, t.length, "locs", locs.length, (locs.length ? locs.filter((l) => /es-es|store|game/i.test(l)).slice(0, 8) : t.slice(0, 600).replace(/\s+/g, " "))); } catch (e) { console.log("==", u, "ERR", e.message); }
}
