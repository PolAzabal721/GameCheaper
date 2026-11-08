// Diagnóstico temporal: fichas por país de tarjetas regalo en Instant Gaming
const UA = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0)", "Accept-Language": "es-ES,es;q=0.9" };
async function ficha(id) {
  const url = `https://www.instant-gaming.com/es/${id}-comprar-x/`;
  const r = await fetch(url, { headers: UA, redirect: "follow" }); const p = await r.text();
  console.log(`\n##### ${id} → ${r.url} (${p.length})`);
  for (const s of p.matchAll(/<select[^>]*>([\s\S]*?)<\/select>/g)) {
    const ops = [...s[1].matchAll(/<option value="([^"]*)"([^>]*)>\s*([^<]*?)\s*<\/option>/g)];
    if (ops.length > 60 || !ops.some((o) => /data-href/.test(o[2]))) continue;
    console.log("SELECT", s[0].slice(0, s[0].indexOf(">") + 1).slice(0, 160));
    for (const o of ops) console.log("  ", o[1], /selected/.test(o[2]) ? "*" : " ", o[3], (o[2].match(/data-href="([^"]+)"/) || [])[1]?.replace("https://www.instant-gaming.com/es/", ""));
  }
  const ld = [...p.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => /offers/.test(x));
  console.log("LD", ld ? ld.replace(/\s+/g, " ").slice(0, 700) : "ninguno");
  for (const re of [/itemprop="price"[^>]*/, /"price"\s*:\s*"?[\d.]+/, /class="total"[^<]*<[^>]*>[^<]*/]) { const m = p.match(re); console.log(String(re), m ? m[0].slice(0, 200) : "-"); }
}
for (const id of [3567, 3013, 1048, 2356]) { await ficha(id); await new Promise((r) => setTimeout(r, 1500)); }
