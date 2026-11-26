// Cupones de las tiendas de Admitad → config/cupones-auto.json (los pone la web sola; los caducados se quitan solos).
// Solo cupones con código (promocode) de las tiendas que tenemos en Pillao.
import { writeFileSync } from "node:fs";
const ID = (process.env.ADMITAD_CLIENT_ID || "").trim(), SEC = (process.env.ADMITAD_CLIENT_SECRET || "").trim();
const TIENDA = [[/kinguin/i, "kinguin"], [/^g2a/i, "g2a"], [/ggpick/i, "ggpick"], [/gamesporium/i, "gamesporium"], [/gamivo/i, "gamivo"], [/godlike/i, "godlike"], [/k4g/i, "k4g"], [/difmark/i, "difmark"], [/ggsel/i, "ggsel"]];
const t = await (await fetch("https://api.admitad.com/token/", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(ID + ":" + SEC).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: ID, scope: "coupons_for_website websites" }) })).json();
if (!t.access_token) { console.log("Sin token:", JSON.stringify(t).slice(0, 200)); process.exit(1); }
const H = { Authorization: "Bearer " + t.access_token };
const webs = (await (await fetch("https://api.admitad.com/websites/?limit=50", { headers: H })).json()).results || [];
const hoy = new Date().toISOString().slice(0, 10), out = [], vistos = new Set();
for (const w of webs) {
  const d = await (await fetch(`https://api.admitad.com/coupons/website/${w.id}/?limit=500`, { headers: H })).json();
  for (const c of d.results || []) {
    const nombre = c.campaign?.name || "", tienda = (TIENDA.find(([re]) => re.test(nombre)) || [])[1];
    const cod = String(c.promocode || "").trim();
    if (!tienda || !cod || /^not ?required$|^no ?code$/i.test(cod) || cod.length > 30) continue;
    const hasta = c.date_end ? String(c.date_end).slice(0, 10) : null;
    if (hasta && hasta < hoy) continue;
    const k = tienda + "|" + cod.toUpperCase(); if (vistos.has(k)) continue; vistos.add(k);
    const m = String(c.discount || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
    out.push({ t: tienda, c: cod, pct: m ? Math.round(+m[1].replace(",", ".")) : null, hasta, para: ["juego", "edicion", "dlc", "software", "tarjeta", "skins"],
      txt: m ? "En toda la tienda" : "Descuento con código", nombre: String(c.name || "").slice(0, 120) });
    console.log("Cupón:", tienda, cod, c.discount || "", hasta || "sin fin", "·", c.name);
  }
}
writeFileSync("config/cupones-auto.json", JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} cupones`);
