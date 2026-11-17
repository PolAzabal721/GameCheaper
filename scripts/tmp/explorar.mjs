const H = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-MX,es;q=0.9" };
const t = async (n, f) => { try { console.log("\n=== " + n); await f(); } catch (e) { console.log("ERROR " + e.message); } };
const txt = async (u, o = {}) => { const r = await fetch(u, { headers: { ...H, ...(o.h || {}) }, ...o }); return [r.status, await r.text(), r]; };
await t("robots", async () => { for (const u of ["https://www.instant-gaming.com/robots.txt", "https://www.yuplay.com/robots.txt", "https://driffle.com/robots.txt", "https://www.nintendo.com/robots.txt"]) { const [s, b] = await txt(u); console.log(u, s, b.slice(0, 600).replace(/\n/g, " | ")); } });
await t("nintendo algolia", async () => {
  for (const [app, key, idx] of [["U3B6GR4UA3", "a29c6927638bfd8cee23993e51e721c9", "store_game_es_mx"], ["U3B6GR4UA3", "a29c6927638bfd8cee23993e51e721c9", "store_game_en_us"], ["U3B6GR4UA3", "c4da8be7fd29f0f5bfa42920b0a99dc7", "ncom_game_en_us"]]) {
    const r = await fetch(`https://${app}-dsn.algolia.net/1/indexes/${idx}/query`, { method: "POST", headers: { "X-Algolia-Application-Id": app, "X-Algolia-API-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ query: "zelda", hitsPerPage: 2 }) });
    const b = await r.text(); console.log(idx, key.slice(0, 6), r.status, b.slice(0, 900));
  }
  const [s, b] = await txt("https://www.nintendo.com/es-mx/store/games/"); console.log("es-mx store", s, (b.match(/algolia[^"']{0,80}|[0-9a-f]{32}/gi) || []).slice(0, 10));
  const [s2, b2] = await txt("https://api.ec.nintendo.com/v1/price?country=MX&lang=es&ids=70010000063714,70010000000025"); console.log("precio MX", s2, b2.slice(0, 500));
});
await t("instant gaming", async () => {
  const u = "https://www.instant-gaming.com/es/16413-comprar-grand-theft-auto-vi-ps5-playstation-store-europa/";
  const [s, b] = await txt("https://www.instant-gaming.com/es/");
  console.log("home", s, [...new Set(b.match(/data-price-[a-z]+|currency[^"<]{0,60}|\/(es|en|mx|ar|pt)-?[a-z]*\/"|hreflang="[^"]+"/g) || [])].slice(0, 30));
  const [s3, b3] = await txt("https://www.instant-gaming.com/es/sitemap.xml"); console.log("sitemap idx", s3, b3.slice(0, 300));
  const [s4, b4] = await txt("https://www.instant-gaming.com/sitemap.xml"); console.log("sitemap root", s4, (b4.match(/<loc>[^<]+<\/loc>/g) || []).slice(0, 40).join(" "));
  const [s5, b5] = await txt("https://www.instant-gaming.com/es/2361-comprar-juego-steam-elden-ring/", { h: { Cookie: "currency=USD" } });
  console.log("ficha", s5, [...new Set(b5.match(/data-price-[a-z]+="[^"]+"|"priceCurrency"\s*:\s*"[A-Z]+"|itemprop="priceCurrency"[^>]*/g) || [])].slice(0, 10));
});
await t("yuplay", async () => {
  const [s, b, r] = await txt("https://www.yuplay.com/"); console.log("home", s, (b.match(/\/api\/currency\/[a-z]+\//g) || []).slice(0, 20), [...new Set(b.match(/region[^"<]{0,50}/gi) || [])].slice(0, 10));
  const ck = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  for (const c of ["usd", "dollar", "us-dollar"]) { const r2 = await fetch("https://www.yuplay.com/api/currency/" + c + "/", { headers: { ...H, Cookie: ck }, redirect: "manual" }); console.log("cur", c, r2.status, (r2.headers.getSetCookie?.() || []).join(" ").slice(0, 200)); }
  const [s3, b3] = await txt("https://www.yuplay.com/api/products/?page=1", { h: { Accept: "application/json", Cookie: ck } }); console.log("prod", s3, b3.slice(0, 1200));
});
await t("driffle", async () => {
  const u = "https://driffle.com/007-first-light-europe-pc-steam-digital-key-p9986823";
  for (const c of ["USD", "ARS", "MXN"]) { const [s, b] = await txt(u + "?currency=" + c); console.log(c, s, (b.match(/"price"\s*:\s*"?[0-9.]+"?\s*,\s*"priceCurrency"\s*:\s*"[A-Z]+"|"priceCurrency"\s*:\s*"[A-Z]+"\s*,\s*"price"\s*:\s*"?[0-9.]+/g) || []).slice(0, 3)); }
  const [s, b] = await txt("https://driffle.com/sitemap.xml"); const subs = (b.match(/<loc>[^<]+<\/loc>/g) || []); console.log("submapas", subs.length, subs.slice(0, 5).join(" "));
  const sm = subs.map((x) => x.replace(/<\/?loc>/g, "")).filter((u) => /products-sitemap-\d+\.xml$/.test(u))[3];
  const [s2, b2] = await txt(sm); const us = (b2.match(/<loc>[^<]+<\/loc>/g) || []).map((x) => x.replace(/<\/?loc>/g, ""));
  console.log("productos en un submapa", us.length, "latam:", us.filter((u) => /-(latam|argentina|mexico|brazil|latin-america|south-america)-/.test(u)).slice(0, 8));
});
await t("gamersgate", async () => {
  for (const c of ["ARG", "MEX", "BRA", "USA", "CHL"]) { const r = await fetch(`https://feeds.gamersgate.com/feeds/products?country=${c}&aff=15600f04623a9a73fa267b81bfec59911a3e5263`, { headers: H }); const b = await r.text(); console.log(c, r.status, b.length, (b.match(/<currency>[^<]+<\/currency>|<price>[^<]+<\/price>/g) || []).slice(0, 4), (b.match(/<item>/g) || []).length); }
});
