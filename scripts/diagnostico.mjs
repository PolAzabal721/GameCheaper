// Diagnóstico temporal: ¿se pueden leer precios de xtralife y tiendas parecidas?
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
const ver = (t, k) => { const i = t.indexOf(k); return i < 0 ? "" : JSON.stringify(t.slice(Math.max(0, i - 250), i + 350)); };
for (const [n, u] of [
  ["xtralife robots", "https://www.xtralife.com/robots.txt"],
  ["xtralife buscar1", "https://www.xtralife.com/buscar/mario-kart-world"],
  ["xtralife buscar2", "https://www.xtralife.com/search?q=mario+kart+world"],
  ["xtralife buscar3", "https://www.xtralife.com/busqueda?q=mario+kart+world"],
  ["pccomponentes", "https://www.pccomponentes.com/buscar/?query=mario+kart+world"],
  ["carrefour", "https://www.carrefour.es/?q=mario+kart+world"],
  ["alcampo", "https://www.compraonline.alcampo.es/search?q=mario%20kart%20world"],
]) {
  try {
    const r = await fetch(u, { headers: H, redirect: "follow" }); const t = await r.text();
    console.log("==", n, r.status, r.url === u ? "" : "-> " + r.url, t.length, "| titulo:", (t.match(/<title>([^<]*)/) || [])[1]?.trim().slice(0, 80));
    if (n.includes("robots")) console.log(t.slice(0, 700));
    else if (r.ok) { for (const k of ["Mario Kart World", "€", "application/ld+json", "__NEXT_DATA__", "price"]) console.log("   ", k, t.split(k).length - 1); console.log("   ", ver(t, "Mario Kart World")); }
  } catch (e) { console.log("==", n, "ERR", e.message); }
}
