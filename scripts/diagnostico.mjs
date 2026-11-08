// Diagnóstico temporal: datos estructurados de los resultados de GAME
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
function bloque(texto, desde) {
  let i = texto.indexOf("{", desde), prof = 0, enCad = false;
  for (let k = i; k < texto.length; k++) {
    const c = texto[k];
    if (enCad) { if (c === "\\") k++; else if (c === '"') enCad = false; continue; }
    if (c === '"') enCad = true; else if (c === "{") prof++; else if (c === "}" && --prof === 0) return texto.slice(i, k + 1);
  }
}
for (const q of ["mario kart world", "ghost of yotei"]) {
  const t = await (await fetch("https://www.game.es/resultados?search=" + encodeURIComponent(q), { headers: H })).text();
  const flight = [...t.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map((m) => JSON.parse('"' + m[1] + '"')).join("");
  const i = flight.indexOf('"initialResult":');
  console.log("Q", q, "flight", flight.length, "idx", i);
  if (i < 0) continue;
  const r = JSON.parse(bloque(flight, i));
  console.log("KEYS", Object.keys(r), "items", r.items?.length, "total", r.total ?? r.totalItems ?? "");
  for (const it of (r.items || []).slice(0, 4)) console.log("ITEM", JSON.stringify(it).slice(0, 1500));
}
