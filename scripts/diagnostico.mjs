// Diagnóstico temporal: páginas de categoría de la PS Store
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
for (const id of ["4cbf39e2-5749-4970-ba81-93a489e4570c", "44d8bb20-653e-431e-8ad0-c0a365f68d2f", "28c9c2b2-cecc-415c-9a08-482a605cb104"]) {
  const u = `https://store.playstation.com/es-es/category/${id}/1`;
  const r = await fetch(u, { headers: H }); const t = await r.text();
  const conceptos = [...new Set(t.match(/\/concept\/\d+/g) || [])], productos = [...new Set(t.match(/\/product\/[A-Z0-9_-]+/g) || [])];
  console.log("== CAT", id, r.status, t.length, "concept", conceptos.length, "product", productos.length, "basePrice", t.split("basePrice").length - 1, "| titulo:", (t.match(/<title>([^<]*)/) || [])[1]);
  const i = t.indexOf("basePrice"); if (i > 0) console.log("   ", JSON.stringify(t.slice(i - 900, i + 250)));
  const tot = t.match(/"totalCount":(\d+)/); console.log("   totalCount", tot && tot[1], "| paginacion:", (t.match(/"pageInfo":\{[^}]*\}/) || [])[0]);
}
