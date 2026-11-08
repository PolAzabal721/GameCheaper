// Diagnóstico temporal: tarjetas regalo en Instant Gaming y GAME
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
function bloque(t, i) { let p = 0, s = false; i = t.indexOf("{", i); for (let k = i; k < t.length; k++) { const c = t[k]; if (s) { if (c === "\\") k++; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === "{") p++; else if (c === "}" && --p === 0) return t.slice(i, k + 1); } }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
for (const q of ["playstation store", "nintendo eshop", "xbox tarjeta regalo", "steam tarjeta regalo", "amazon tarjeta regalo", "apple", "google play", "uber eats", "just eat", "samsung", "spotify", "netflix"]) {
  const t = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=" + encodeURIComponent(q), { headers: H })).text();
  const i = t.indexOf("window.searchResults = ");
  if (i < 0) { console.log("IG", q, "sin datos"); continue; }
  const hits = JSON.parse(bloque(t, i)).hits || [];
  const pre = hits.filter((h) => h.is_prepaid || /tarjeta|gift|card|wallet|recarga|credit/i.test(h.name));
  console.log(`IG «${q}»: ${hits.length} resultados, ${pre.length} tarjetas →`, pre.slice(0, 6).map((h) => `${h.name} | ${h.price_eur}€ | ${h.region} | stock ${h.has_stock} | ${h.type}`).join("  ‖  "));
  await esperar(900);
}
for (const q of ["tarjeta playstation", "tarjeta nintendo", "tarjeta xbox", "tarjeta steam"]) {
  const html = await (await fetch("https://www.game.es/resultados?search=" + encodeURIComponent(q), { headers: H })).text();
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return ""; } }).join("");
  const i = flight.indexOf('"initialResult":');
  const items = i < 0 ? [] : JSON.parse(bloque(flight, i)).items || [];
  console.log(`GAME «${q}»:`, items.slice(0, 6).map((x) => `${x.title} | ${x.pricing?.current}€ | ${x.category}/${x.category2} | ${x.allPlatforms}`).join("  ‖  "));
  await esperar(900);
}
