// Diagnóstico temporal: ¿responden las APIs internas de CeX y Wallapop a una petición normal?
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "application/json" };
for (const [n, u] of [
  ["cex", "https://wss2.cex.es.webuy.io/v3/boxes?q=mario%20kart%20world&firstRecord=1&count=5&sortBy=relevance&sortOrder=desc"],
  ["wallapop v3/search", "https://api.wallapop.com/api/v3/search?keywords=mario%20kart%20world&latitude=40.4168&longitude=-3.7038&source=search_box&order_by=most_relevance"],
  ["wallapop v3/general/search", "https://api.wallapop.com/api/v3/general/search?keywords=mario%20kart%20world&latitude=40.4168&longitude=-3.7038&filters_source=search_box"],
]) {
  try { const r = await fetch(u, { headers: H }); const t = await r.text(); console.log("==", n, r.status, t.length, t.slice(0, 500).replace(/\s+/g, " ")); }
  catch (e) { console.log("==", n, "ERR", e.message); }
}
