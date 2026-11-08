// Diagnóstico temporal: qué URL de búsqueda de GAME y Xbox funciona
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
for (const u of ["https://www.game.es/buscar?q=mario%20kart", "https://www.game.es/search?q=mario%20kart", "https://www.game.es/buscador?q=mario%20kart", "https://www.game.es/busqueda?q=mario%20kart", "https://www.game.es/buscar?query=mario%20kart", "https://www.game.es/search?query=mario%20kart", "https://www.game.es/", "https://www.xbox.com/es-ES/search/results?q=Mario"]) {
  try { const r = await fetch(u, { headers: H }); const t = await r.text(); console.log(r.status, u, "->", r.url, t.length, "mario:", (t.match(/mario/gi) || []).length); if (u.endsWith("game.es/")) console.log([...new Set(t.match(/(?:href|action)=\\?"[^"]*(?:busca|search)[^"]*\\?"/gi) || [])].slice(0, 10)); } catch (e) { console.log("ERR", u, e.message); }
}
