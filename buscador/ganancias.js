// Ganancias de afiliados para el panel privado (/panel.html, pestaña «Ganancias»).
//   GET  /ganancias?k=TOKEN&desde=AAAA-MM-DD   → comisiones de cada red (se piden en el momento; caché de 30 min) y lo apuntado a mano
//   POST /ganancias/apuntar?k=TOKEN            → {tienda, fecha, eur}: guarda (o borra con eur vacío) una cifra apuntada a mano
// Nada de esto se guarda en el repositorio (es público): las redes se consultan en directo con sus claves, que son secretos del Worker,
// y lo apuntado a mano vive en el KV («g:tienda:fecha», unas pocas escrituras al mes).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS } });
const dia = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);

// Tienda de Pillao según el anunciante que da la red
const TIENDA = [[/k4g/i, "k4g"], [/kinguin/i, "kinguin"], [/g2a/i, "g2a"], [/loaded|cdkeys/i, "loaded"], [/todo ?consolas/i, "todoconsolas"], [/nuuvem/i, "nuuvem"], [/gamivo/i, "gamivo"], [/mediamarkt/i, "mediamarkt"], [/xtralife/i, "xtralife"], [/pc ?box/i, "pcbox"]];
const tiendaDe = (n) => (TIENDA.find(([r]) => r.test(n || "")) || [0, String(n || "otra").toLowerCase().replace(/[^a-z0-9]+/g, "")])[1];

async function eurPorUsd() { try { const d = await (await fetch("https://open.er-api.com/v6/latest/USD", { cf: { cacheTtl: 21600 } })).json(); return d.rates?.EUR || 0.92; } catch { return 0.92; } }

// CJ (K4G): API de comisiones, en dólares → euros
async function cj(env, desde, hasta) {
  if (!env.CJ_TOKEN) return { red: "CJ", estado: "falta" };
  const q = `{ publisherCommissions(forPublishers: ["8127571"], sincePostingDate: "${desde}T00:00:00Z", beforePostingDate: "${hasta}T23:59:59Z") { records { advertiserName postingDate pubCommissionAmountUsd actionStatus } } }`;
  const r = await fetch("https://commissions.api.cj.com/query", { method: "POST", headers: { Authorization: "Bearer " + env.CJ_TOKEN.trim(), "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
  const d = await r.json(); if (d.errors) throw new Error(d.errors[0]?.message || "error");
  const tc = await eurPorUsd();
  return { red: "CJ", estado: "ok", filas: (d.data?.publisherCommissions?.records || []).map((x) => ({ f: x.postingDate.slice(0, 10), tienda: tiendaDe(x.advertiserName), eur: Math.round(+x.pubCommissionAmountUsd * tc * 100) / 100, conf: /closed|locked/i.test(x.actionStatus) })) };
}

// Awin (Todo Consolas): transacciones de los últimos días (la API admite 31 días por consulta)
async function awin(env, desde, hasta) {
  if (!env.AWIN_API_TOKEN) return { red: "Awin", estado: "falta" };
  const filas = [];
  for (let a = new Date(desde + "T00:00:00Z"); dia(a) <= hasta; a = new Date(a.getTime() + 31 * 86400000)) {
    const b = new Date(Math.min(a.getTime() + 31 * 86400000 - 1000, new Date(hasta + "T23:59:59Z").getTime()));
    const u = `https://api.awin.com/publishers/3149016/transactions/?startDate=${a.toISOString().slice(0, 19)}&endDate=${b.toISOString().slice(0, 19)}&timezone=Europe/Paris&dateType=transaction`;
    const r = await fetch(u, { headers: { Authorization: "Bearer " + env.AWIN_API_TOKEN.trim() } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    for (const x of await r.json()) if (x.commissionStatus !== "declined" && x.commissionAmount?.currency === "EUR")
      filas.push({ f: String(x.transactionDate).slice(0, 10), tienda: x.advertiserId === 106903 ? "todoconsolas" : "awin-" + x.advertiserId, eur: +x.commissionAmount.amount, conf: x.commissionStatus === "approved" });
  }
  return { red: "Awin", estado: "ok", filas };
}

const REDES = [cj, awin,
  async () => ({ red: "Admitad", estado: "falta" }),
  async () => ({ red: "Impact", estado: "falta" }),
  async () => ({ red: "Rakuten", estado: "falta" }),
  async () => ({ red: "Tradedoubler", estado: "falta" })];

export async function rutasGanancias(req, env, ctx, url) {
  if (!url.pathname.startsWith("/ganancias")) return null;
  if (!env.PANEL_TOKEN || (url.searchParams.get("k") || "").trim() !== String(env.PANEL_TOKEN).trim()) return json({ error: "token" }, 403);
  if (url.pathname === "/ganancias/apuntar" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const tienda = String(b.tienda || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30), fecha = String(b.fecha || "");
    if (!tienda || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ error: "Falta la tienda o la fecha" }, 400);
    const clave = `g:${tienda}:${fecha}`;
    if (b.eur === "" || b.eur == null) await env.PILLAO.delete(clave);
    else { const eur = Math.round(+String(b.eur).replace(",", ".") * 100) / 100; if (!(eur >= 0)) return json({ error: "Importe no válido" }, 400); await env.PILLAO.put(clave, "", { metadata: { tienda, f: fecha, eur } }); }
    return json({ ok: true });
  }
  const hasta = dia(new Date()), desde = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("desde") || "") ? url.searchParams.get("desde") : dia(new Date(Date.now() - 90 * 86400000));
  // Caché de 30 minutos por consulta (las redes actualizan sus datos pocas veces al día); «?fresco=1» la salta
  const ck = new Request(`https://cache.pillao/ganancias?desde=${desde}&hasta=${hasta}`), cache = caches.default;
  let redes = null;
  if (!url.searchParams.get("fresco")) { const c = await cache.match(ck); if (c) redes = await c.json(); }
  if (!redes) {
    redes = await Promise.all(REDES.map((f) => f(env, desde, hasta).catch((e) => ({ red: f.name || "?", estado: "error", msg: String(e.message).slice(0, 160) }))));
    ctx.waitUntil(cache.put(ck, new Response(JSON.stringify(redes), { headers: { "Cache-Control": "max-age=1800" } })));
  }
  const mano = []; let cursor;
  do { const l = await env.PILLAO.list({ prefix: "g:", cursor, limit: 1000 }); for (const k of l.keys) if (k.metadata) mano.push(k.metadata); cursor = l.list_complete ? null : l.cursor; } while (cursor);
  return json({ desde, hasta, redes, mano, hecho: new Date().toISOString() });
}
