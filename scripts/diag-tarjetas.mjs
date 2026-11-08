// Diagnóstico temporal: enlaces a fichas de España/Europa y disponibilidad
const UA = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0)", "Accept-Language": "es-ES,es;q=0.9" };
for (const id of [3567, 3013, 1048, 16983, 18845]) {
  const r = await fetch(`https://www.instant-gaming.com/es/${id}-comprar-x/`, { headers: UA }); const p = await r.text();
  const links = [...new Set([...p.matchAll(/instant-gaming\.com\/es\/(\d+)-comprar-([a-z0-9-]+)\//g)].map((m) => m[1] + " " + m[2]))];
  console.log(`\n##### ${id} ${r.url.slice(36, 140)}`);
  console.log("H1", (p.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, "").trim());
  console.log("AVAIL", (p.match(/itemprop="availability"[^>]*/) || ["-"])[0], "| PRICE", (p.match(/itemprop="price"[^>]*/) || ["-"])[0]);
  console.log("STOCKTXT", /Agotado|Out of stock|nostock/i.test(p) ? "menciona agotado" : "-", (p.match(/class="[^"]*stock[^"]*"[^>]*>[^<]{0,40}/gi) || []).slice(0, 4).join(" || "));
  links.filter((l) => /espana|europa|europe|-eur-|eur\d|\d+eur/.test(l)).slice(0, 60).forEach((l) => console.log("  L", l));
  await new Promise((r) => setTimeout(r, 1500));
}
