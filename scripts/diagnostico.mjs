// Diagnóstico temporal: catálogo público de Microsoft Store / Xbox
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
const prueba = async (n, u) => { try { const r = await fetch(u, { headers: H }); const t = await r.text(); console.log("==", n, r.status, t.length, t.slice(0, 700).replace(/\s+/g, " ")); return t; } catch (e) { console.log("==", n, "ERR", e.message); return ""; } };
await prueba("autosuggest", "https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=es-ES&query=forza%20horizon%205&mediaType=games");
await prueba("autosuggest2", "https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=es-ES&query=forza%20horizon%205&productFamilyNames=Games");
const t = await prueba("producto FH5", "https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=9NKX70BBCDRN&market=ES&languages=es-es");
try { const d = JSON.parse(t); const p = d.Products[0]; console.log("TITULO", p.LocalizedProperties[0].ProductTitle); for (const s of p.DisplaySkuAvailabilities.slice(0, 3)) for (const a of s.Availabilities.slice(0, 2)) console.log("PRECIO", s.Sku.LocalizedProperties[0].SkuTitle, JSON.stringify(a.OrderManagementData?.Price), a.Actions?.join(",")); } catch (e) { console.log("parse", e.message); }
const x = await (await fetch("https://www.xbox.com/es-ES/search/results/games?q=forza%20horizon%205", { headers: H })).text();
for (const k of ["__PRELOADED_STATE__", "productSummaries", "listPrice", "msrp", "9NKX70BBCDRN", "\"price\""]) { const i = x.indexOf(k); console.log("XBOX", k, x.split(k).length - 1, i >= 0 ? JSON.stringify(x.slice(i - 100, i + 400)) : ""); }
