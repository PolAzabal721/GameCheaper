// Diagnóstico temporal: orden de la eShop y estructura de resultados de GAME
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
for (const s of ["popularity%20desc", "popularity%20asc", "date_from%20desc", "score%20desc"]) {
  const r = await fetch(`https://searching.nintendo-europe.com/es/select?q=*&fq=type:GAME&fq=nsuid_txt:*&sort=${s}&rows=12&wt=json&fl=title,popularity,date_from`, { headers: H });
  const d = await r.json(); console.log("ESHOP", s, r.status, d.response?.docs?.map((x) => `${x.title} (${x.popularity ?? "-"})`).join(" | "));
}
const r = await fetch("https://www.game.es/resultados?search=mario%20kart%20world", { headers: H });
const t = await r.text();
console.log("GAME", r.status, t.length);
for (const k of ["Seminuevo", "seminuevo", "€", "price", "precio", "application/ld+json", "productList", "\"sku\"", "Mario Kart World"]) {
  const idx = []; let i = -1; while ((i = t.indexOf(k, i + 1)) >= 0 && idx.length < 400) idx.push(i);
  console.log("KEY", JSON.stringify(k), idx.length, idx.length ? JSON.stringify(t.slice(Math.max(0, idx[Math.min(5, idx.length - 1)] - 300), idx[Math.min(5, idx.length - 1)] + 300)) : "");
}
