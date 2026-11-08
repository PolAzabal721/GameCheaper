// Diagnóstico temporal: estructura de datos de Instant Gaming y Eneba
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
function bloque(t, i, ab = "{", ci = "}") { let p = 0, s = false; i = t.indexOf(ab, i); for (let k = i; k < t.length; k++) { const c = t[k]; if (s) { if (c === "\\") k++; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === ab) p++; else if (c === ci && --p === 0) return t.slice(i, k + 1); } }
// Instant Gaming
let t = await (await fetch("https://www.instant-gaming.com/es/busquedas/?query=ghost%20of%20yotei", { headers: H })).text();
let i = t.indexOf('"prod_id"'); const ini = t.lastIndexOf("[", t.lastIndexOf("{", i)); console.log("IG contexto", JSON.stringify(t.slice(ini - 200, ini + 5)));
try { const arr = JSON.parse(bloque(t, ini, "[", "]")); console.log("IG hits", arr.length); for (const h of arr.slice(0, 6)) console.log("IGHIT", JSON.stringify({ prod_id: h.prod_id, name: h.name, fullname: h.fullname, seo: h.seo_name, plat: h.platform_names, type: h.type, region: h.region, dlc: h.is_dlc, pre: h.preorder, eur: h.price_eur, retail: h.retail, stock: h.stock ?? h.has_stock ?? h.instock, keys: Object.keys(h).join(",") })); } catch (e) { console.log("IG parse", e.message); }
console.log("IG enlaces", [...new Set(t.match(/https:\/\/www\.instant-gaming\.com\/es\/\d+-[a-z0-9-]+\//g) || [])].slice(0, 3));
// Eneba
t = await (await fetch("https://www.eneba.com/es/store/all?text=ghost%20of%20yotei", { headers: H })).text();
i = t.indexOf("__APOLLO_STATE__"); console.log("ENEBA ctx", JSON.stringify(t.slice(i - 50, i + 120)));
try {
  const st = JSON.parse(bloque(t, i));
  const claves = Object.keys(st); console.log("ENEBA claves", claves.length, claves.slice(0, 12).join(" | "));
  const prods = claves.filter((k) => /^Product/.test(k)).slice(0, 4);
  for (const k of prods) console.log("EPROD", k, JSON.stringify(st[k]).slice(0, 900));
  const auct = claves.filter((k) => /Auction/i.test(k)).slice(0, 2);
  for (const k of auct) console.log("EAUC", k, JSON.stringify(st[k]).slice(0, 500));
} catch (e) { console.log("ENEBA parse", e.message); }
