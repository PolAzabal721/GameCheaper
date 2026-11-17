const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-MX,es;q=0.9" };
const t = async (n, f) => { try { console.log("\n=== " + n); await f(); } catch (e) { console.log("ERROR " + e.message); } };
await t("nintendo", async () => {
  const b = await (await fetch("https://www.nintendo.com/es-mx/sitemap.xml", { headers: H })).text(); const l = (b.match(/<loc>[^<]+<\/loc>/g) || []).map((x) => x.slice(5, -6));
  console.log("total", l.length, "products", l.filter((u) => /\/store\/products\//.test(u)).length, l.filter((u) => /\/store\/products\//.test(u)).slice(0, 5), l.filter((u) => /sitemap/.test(u)).slice(0, 10));
  const rb = await (await fetch("https://www.nintendo.com/robots.txt", { headers: H })).text(); console.log((rb.match(/Sitemap:[^\n]+/gi) || []).join(" | "));
  const p = await (await fetch("https://www.nintendo.com/es-mx/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/", { headers: H })).text();
  const i = p.indexOf('"nsuid":"70010000063714"'); console.log(p.slice(i - 600, i + 300).replace(/\s+/g, " "));
});
await t("yuplay paises", async () => {
  const d = await (await fetch("https://www.yuplay.com/api/products/?page=3", { headers: { ...H, Accept: "application/json" } })).json();
  for (const p of d.products.slice(0, 6)) { const b = await (await fetch("https://www.yuplay.com" + p.link, { headers: H })).text(); const m = b.match(/data-tooltip_content="Can be activated in ([^"]+)"/); const c = m ? m[1] : ""; console.log(p.name, p.price, p.currency_code, "| MX:", /Mexico/.test(c), "AR:", /Argentina/.test(c), "BR:", /Brazil/.test(c), "CL:", /Chile/.test(c), "CO:", /Colombia/.test(c), "n:", c.split(",").length); await new Promise((r) => setTimeout(r, 400)); }
});
