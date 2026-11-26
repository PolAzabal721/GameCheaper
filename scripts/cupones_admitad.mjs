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
    if (!tienda || !cod || !/^[A-Za-z0-9_-]{3,30}$/.test(cod)) continue;   // fuera «no hace falta código» (en cualquier idioma) y raros
    if (c.date_start && String(c.date_start).slice(0, 10) > hoy) continue;   // aún no ha empezado: entrará el día que empiece
    const hasta = c.date_end ? String(c.date_end).slice(0, 10) : null;
    if (hasta && hasta < hoy) continue;
    const k = tienda + "|" + cod.toUpperCase(); if (vistos.has(k)) continue; vistos.add(k);
    const m = String(c.discount || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
    // A qué productos vale, según lo que dice el cupón
    const n2 = String(c.name || "") + " " + String(c.description || "");
    const para = /subscription|gift ?card|top-?up|prepaid/i.test(n2) ? ["tarjeta"] : /in-?game|skins?\b/i.test(n2) ? ["skins"] : /ram|server|hosting/i.test(n2) ? ["software"] : ["juego", "edicion", "dlc", "software", "tarjeta", "skins"];
    // «Para nuevos usuarios», «primer pedido», «hasta un X %»: el porcentaje no es fijo
    const variable = /new (smart )?users?|first order|up to|depends/i.test(n2);
    out.push({ t: tienda, c: cod, pct: m && !variable ? Math.round(+m[1].replace(",", ".")) : null, hasta, para,
      txt: m ? "En toda la tienda" : "Descuento con código", nombre: String(c.name || "").slice(0, 120) });
    console.log("Cupón:", tienda, cod, c.discount || "", hasta || "sin fin", "·", c.name);
  }
}

// ---------- Las demás redes: CJ, Awin e Impact (cada una por su lado: si una falla, las otras siguen) ----------
const TIENDA2 = [[/gamersgate/i, "gamersgate"], [/yuplay/i, "yuplay"], [/gamivo/i, "gamivo"], [/todo ?consolas/i, "todoconsolas"], [/cjs/i, "cjs"], [/loaded|cdkeys/i, "loaded"], [/voidu/i, "voidu"], [/xtralife/i, "xtralife"], [/media ?markt/i, "mediamarkt"], [/pcbox/i, "pcbox"], [/k4g/i, "k4g"], [/nuuvem/i, "nuuvem"], [/instant/i, "instantgaming"]];
const meter = (tienda, cod, texto, hasta, inicio) => {
  cod = String(cod || "").trim();
  if (!tienda || !/^[A-Za-z0-9_-]{3,30}$/.test(cod)) return;
  if (hasta && hasta < hoy) return; if (inicio && inicio > hoy) return;
  const k = tienda + "|" + cod.toUpperCase(); if (vistos.has(k)) return; vistos.add(k);
  const m = String(texto || "").match(/(\d+(?:[.,]\d+)?)\s*%/), variable = /new (smart )?users?|neue|first order|up to|bis zu|jusqu|depends|hasta un/i.test(texto || "");
  const para = /in-?game/i.test(texto || "") ? ["skins"] : /subscription|abonnement|gift ?card|geschenkkarte|top-?up|prepaid|tarjeta/i.test(texto || "") ? ["tarjeta"] : /\b(games?|spiele|dlc|software)\b/i.test(texto || "") ? ["juego", "edicion", "dlc", "software"] : ["juego", "edicion", "dlc", "software", "tarjeta", "skins"];
  out.push({ t: tienda, c: cod, pct: m && !variable ? Math.round(+m[1].replace(",", ".")) : null, hasta: hasta || null, para, txt: m && !variable ? "En toda la tienda" : "Descuento con código", nombre: String(texto || "").slice(0, 120) });
  console.log("Cupón:", tienda, cod, hasta || "sin fin", "·", String(texto || "").slice(0, 90));
};
const tiendaDe = (n) => (TIENDA2.find(([re]) => re.test(n || "")) || [])[1];
// CJ: enlaces con código de cupón de los anunciantes a los que estamos unidos
try {
  const T = (process.env.CJ_TOKEN || "").trim();
  if (T) for (let pg = 1; pg <= 5; pg++) {
    const x = await (await fetch(`https://link-search.api.cj.com/v2/link-search?website-id=101929112&advertiser-ids=joined&promotion-type=coupon&records-per-page=100&page-number=${pg}`, { headers: { Authorization: "Bearer " + T } })).text();
    const links = x.match(/<link>[\s\S]*?<\/link>/g) || []; if (!links.length) break;
    for (const l of links) {
      const g = (t) => ((l.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      meter(tiendaDe(g("advertiser-name")), g("coupon-code"), g("link-name") + " " + g("description"), (g("promotion-end-date") || "").slice(0, 10) || null, (g("promotion-start-date") || "").slice(0, 10) || null);
    }
  }
} catch (e) { console.log("CJ:", e.message); }
// Awin: cupones (vouchers) activos de los programas unidos
try {
  const T = (process.env.AWIN_API_TOKEN || "").trim();
  if (T) {
    const r = await fetch(`https://api.awin.com/publisher/3149016/promotions?accessToken=${encodeURIComponent(T)}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: { membership: "joined", type: "voucher", status: "active" }, pagination: { page: 1, pageSize: 200 } }) });
    const d = await r.json();
    for (const v of d.data || []) meter(tiendaDe(v.advertiser?.name), v.voucher?.code, (v.title || "") + " " + (v.description || ""), (v.endDate || "").slice(0, 10) || null, (v.startDate || "").slice(0, 10) || null);
    if (!d.data) console.log("Awin:", JSON.stringify(d).slice(0, 200));
  }
} catch (e) { console.log("Awin:", e.message); }
// Impact (Loaded): anuncios de tipo cupón
try {
  const sid = (process.env.IMPACT_ACCOUNT_SID || "").trim(), tok = (process.env.IMPACT_AUTH_TOKEN || "").trim();
  if (sid && tok) {
    const r = await fetch(`https://api.impact.com/Mediapartners/${sid}/Ads?Type=COUPON&PageSize=200`, { headers: { Authorization: "Basic " + Buffer.from(sid + ":" + tok).toString("base64"), Accept: "application/json" } });
    const d = await r.json();
    for (const a of d.Ads || []) meter(tiendaDe(a.CampaignName), a.CouponCode || a.PromoCode, (a.Name || "") + " " + (a.Description || ""), (a.EndDate || "").slice(0, 10) || null, (a.StartDate || "").slice(0, 10) || null);
    if (!d.Ads) console.log("Impact:", JSON.stringify(d).slice(0, 200));
  }
} catch (e) { console.log("Impact:", e.message); }
writeFileSync("config/cupones-auto.json", JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} cupones`);
