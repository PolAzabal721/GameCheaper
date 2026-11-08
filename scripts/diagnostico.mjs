// Diagnóstico temporal de fuentes. Se borra al terminar.
import { readFileSync } from "node:fs";
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
const get = async (u, extra = {}) => { try { const r = await fetch(u, { headers: { ...H, ...extra }, redirect: "follow" }); const t = await r.text(); return { s: r.status, t, u: r.url }; } catch (e) { return { s: "ERR " + e.message, t: "" }; } };
const cut = (t, k, a = 200, b = 300) => { const i = t.indexOf(k); return i < 0 ? "(no)" : JSON.stringify(t.slice(Math.max(0, i - a), i + b)); };

console.log("== STEAM TOPSELLERS");
let r = await get("https://store.steampowered.com/search/results/?query&start=0&count=100&filter=topsellers&cc=es&l=spanish&infinite=1");
console.log(r.s, r.t.length); try { const j = JSON.parse(r.t); console.log("total", j.total_count, "appids", (j.results_html.match(/data-ds-appid=/g) || []).length); console.log(cut(j.results_html, "data-price-final", 600, 400)); } catch (e) { console.log("no json", r.t.slice(0, 200)); }

console.log("== ESHOP CATALOGO");
r = await get("https://searching.nintendo-europe.com/es/select?q=*&fq=type:GAME&rows=3&wt=json&sort=popularity%20asc");
try { const j = JSON.parse(r.t); console.log("numFound", j.response.numFound); console.log(JSON.stringify(j.response.docs[0]).slice(0, 1500)); } catch { console.log(r.s, r.t.slice(0, 300)); }

console.log("== PS STORE BROWSE");
r = await get("https://store.playstation.com/es-es/pages/browse");
console.log(r.s, r.t.length, [...new Set(r.t.match(/\/es-es\/category\/[0-9a-f-]{36}/g) || [])].slice(0, 10));
for (const k of ["basePrice", "application/ld+json", "Concept:", "Product:"]) console.log(k, (r.t.match(new RegExp(k.replace(/[+]/g, "\\+"), "g")) || []).length);
const cats = [...new Set(r.t.match(/\/es-es\/category\/[0-9a-f-]{36}/g) || [])];
if (cats[0]) { const c = await get("https://store.playstation.com" + cats[0] + "/1"); console.log("CAT", cats[0], c.s, c.t.length, "basePrice", (c.t.match(/basePrice/g) || []).length, "concept", (c.t.match(/\/concept\/\d+/g) || []).length); console.log(cut(c.t, "basePrice", 700, 300)); }

console.log("== CEX");
for (const u of ["https://wss2.cex.es.webuy.io/v3/boxes?q=mario%20kart&firstRecord=1&count=5", "https://es.webuy.com/search?stext=mario%20kart"]) { r = await get(u, { Accept: "application/json, text/html" }); console.log(u, r.s, r.t.length, r.t.slice(0, 400).replace(/\s+/g, " ")); }

console.log("== GAME");
r = await get("https://www.game.es/buscar/mario-kart-world");
console.log(r.s, r.t.length, r.u, "seminuevo", (r.t.match(/seminuevo/gi) || []).length, cut(r.t, "€", 400, 100));

console.log("== ENLACES DE BUSQUEDA");
const tiendas = JSON.parse(readFileSync("config/tiendas.json", "utf8"));
for (const t of tiendas) { const u = t.busqueda.replace("{q}", encodeURIComponent("Mario Kart World")); const x = await get(u); console.log(t.id.padEnd(15), x.s, x.u === u ? "" : "-> " + x.u, x.t.length); }
