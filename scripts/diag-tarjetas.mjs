// Diagnóstico temporal: variantes por país de las tarjetas regalo en las fichas de Instant Gaming
const UA = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0)", "Accept-Language": "es-ES,es;q=0.9" };
function bloqueJSON(t, desde) { const i = t.indexOf("{", desde); let d = 0, s = false, e = false; for (let k = i; k < t.length; k++) { const c = t[k]; if (s) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === "{") d++; else if (c === "}" && --d === 0) return t.slice(i, k + 1); } }
const html = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=tarjeta+playstation", { headers: UA })).text();
const hits = JSON.parse(bloqueJSON(html, html.indexOf("window.searchResults = "))).hits;
const h = hits.find((x) => /100\$/.test(x.name)) || hits[0];
console.log("HIT", JSON.stringify(h).slice(0, 1500));
const url = `https://www.instant-gaming.com/es/${h.prod_id}-comprar-${h.seo_name}/`;
const p = await (await fetch(url, { headers: UA })).text();
console.log("URL", url, "len", p.length);
const enlaces = [...new Set([...p.matchAll(/instant-gaming\.com\/es\/(\d+)-comprar-([a-z0-9-]+)\//g)].map((m) => m[1] + " " + m[2]))].filter((x) => /playstation|psn/.test(x));
console.log("ENLACES PSN", enlaces.length, enlaces.slice(0, 80).join("\n"));
for (const re of [/España/g, /"country"/g, /variant/gi, /<select/g, /data-region/g, /regions?"\s*:/g]) {
  const ms = [...p.matchAll(re)].slice(0, 4);
  console.log(`--- ${re} (${[...p.matchAll(re)].length})`);
  for (const m of ms) console.log(p.slice(Math.max(0, m.index - 300), m.index + 500).replace(/\s+/g, " "));
}
