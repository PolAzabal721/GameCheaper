// Diagnóstico temporal: tarjetas regalo a fondo (Instant Gaming y GAME)
const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)", "Accept-Language": "es-ES,es;q=0.9" };
function bloque(t, i) { let p = 0, s = false; i = t.indexOf("{", i); for (let k = i; k < t.length; k++) { const c = t[k]; if (s) { if (c === "\\") k++; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === "{") p++; else if (c === "}" && --p === 0) return t.slice(i, k + 1); } }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const vistos = new Map();
for (const q of ["tarjeta playstation", "playstation store españa", "psn", "playstation plus", "tarjeta xbox", "xbox game pass", "steam", "ea play", "roblox", "fortnite", "riot", "valorant", "league of legends", "minecraft minecoins", "ubisoft", "battle.net", "google play", "apple", "amazon", "razer gold", "paysafecard", "tarjeta regalo"]) {
  const t = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=" + encodeURIComponent(q), { headers: H })).text();
  const i = t.indexOf("window.searchResults = "); if (i < 0) continue;
  for (const h of JSON.parse(bloque(t, i)).hits || []) if (h.is_prepaid || h.is_subscription || /tarjeta|gift|card|wallet|recarga|monedas|coins|points|puntos|v-bucks|robux|suscrip/i.test(h.name)) vistos.set(h.prod_id, h);
  await esperar(900);
}
const filas = [...vistos.values()].map((h) => `${h.name} | ${h.price_eur}€ | región ${h.region} | wl ${JSON.stringify(h.country_whitelist || []).slice(0, 40)} | stock ${h.has_stock} | prepago ${h.is_prepaid} | sub ${h.is_subscription}`);
console.log("IG total productos de tipo tarjeta/suscripción/monedas:", filas.length);
filas.filter((f) => /región (Europe|EU|Spain|ES|Worldwide|España)|"es"|"ES"/i.test(f)).sort().forEach((f) => console.log("IG-ES", f));
console.log("IG solo otras regiones (muestra):", filas.filter((f) => !/región (Europe|EU|Spain|ES|Worldwide|España)/i.test(f)).slice(0, 8).join("\n   "));
for (const q of ["playstation store", "psn", "nintendo eshop", "xbox", "prepago", "tarjeta regalo", "steam"]) {
  const html = await (await fetch("https://www.game.es/resultados?search=" + encodeURIComponent(q), { headers: H })).text();
  const fl = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((m) => { try { return JSON.parse('"' + m[1] + '"'); } catch { return ""; } }).join("");
  const k = fl.indexOf('"initialResult":'); const items = k < 0 ? [] : JSON.parse(bloque(fl, k)).items || [];
  console.log(`GAME «${q}»:`, items.filter((x) => /PREPAGO|TARJETA|SALDO|DIGITAL/i.test(`${x.category} ${x.category2} ${x.brand} ${x.allPlatforms}`)).map((x) => `${x.title} ${x.pricing?.current}€ [${x.category}/${x.category2}/${x.brand}]`).slice(0, 8).join(" ‖ ") || "(nada)");
  await esperar(900);
}
