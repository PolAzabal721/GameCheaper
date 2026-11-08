// Diagnóstico temporal: ¿las páginas de juego de playstation.com enlazan a la ficha de la tienda?
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
for (const slug of ["ghost-of-yotei", "battlefield-6", "hollow-knight-silksong", "clair-obscur-expedition-33", "god-of-war-ragnarok"]) {
  const u = `https://www.playstation.com/es-es/games/${slug}/`;
  try {
    const r = await fetch(u, { headers: H, redirect: "follow" }); const t = await r.text();
    const conc = [...new Set(t.match(/store\.playstation\.com\/[a-z-]*\/?concept\/\d+/g) || [])], prod = [...new Set(t.match(/store\.playstation\.com\/[a-z-]*\/?product\/[A-Z0-9_-]+/g) || [])];
    const ids = [...new Set(t.match(/"(?:conceptId|productId)"\s*:\s*"?[A-Z0-9_-]+/g) || [])].slice(0, 6);
    console.log("==", slug, r.status, r.url === u ? "" : "-> " + r.url, t.length, "| concept:", conc.slice(0, 3), "| product:", prod.slice(0, 3), "| ids:", ids, "| precio:", (t.match(/\d+,\d{2}\s?€/) || [])[0]);
  } catch (e) { console.log("==", slug, "ERR", e.message); }
  await new Promise((r) => setTimeout(r, 5000)); // Crawl-delay: 5 de su robots.txt
}
