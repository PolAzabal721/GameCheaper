const ENV = process.env;
const pedir = async (u) => { const r = await fetch(u, { headers: { "User-Agent": "Pillao/2.0" } }); if (!r.ok) throw new Error(u + " " + r.status); return r; };
async function packsITAD() {
  const key = encodeURIComponent(ENV.ITAD_KEY.trim());
  let cambio = { EUR: 1 };
  try {
    const xml = await (await pedir("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml")).text();
    for (const m of xml.matchAll(/currency='([A-Z]{3})' rate='([0-9.]+)'/g)) cambio[m[1]] = 1 / +m[2];
  } catch { cambio = { EUR: 1, USD: 0.86, GBP: 1.15 }; }
  const todos = [];
  for (let off = 0; off < 300; off += 50) {
    const r = await pedir(`https://api.isthereanydeal.com/bundles/v1?key=${key}&country=ES&limit=50&offset=${off}`);
    const lote = await r.json();
    if (!Array.isArray(lote)) break;
    todos.push(...lote);
    if (lote.length < 50) break;
  }
  const enEuros = (p) => (p && cambio[p.currency] ? Math.round(p.amount * cambio[p.currency] * 100) / 100 : null);
  return todos.filter((b) => !b.isMature && b.counts?.games > 0).map((b) => {
    const tiers = (b.tiers || []).map((t) => ({ precio: enEuros(t.price), aprox: t.price && t.price.currency !== "EUR" ? 1 : undefined,
      juegos: (t.games || []).filter((g) => !g.mature).map((g) => g.title) }));
    const conPrecio = tiers.filter((t) => t.precio != null);
    const portadas = (b.tiers || []).flatMap((t) => t.games || []).filter((g) => !g.mature && g.assets?.banner400).slice(0, 3).map((g) => g.assets.banner400);
    return { id: b.id, titulo: b.title, tienda: b.page?.name || "", url: b.url, expira: b.expiry || undefined, juegos: b.counts.games,
      desde: conPrecio.length ? Math.min(...conPrecio.map((t) => t.precio)) : null, hasta: conPrecio.length ? Math.max(...conPrecio.map((t) => t.precio)) : null,
      aprox: conPrecio.some((t) => t.aprox) ? 1 : undefined, elige: conPrecio.length ? undefined : 1, tiers, portadas };
  });
}


import { writeFileSync } from "node:fs";
writeFileSync("packs.json", JSON.stringify(await packsITAD(), null, 1));
