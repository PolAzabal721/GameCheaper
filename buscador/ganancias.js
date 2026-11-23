// Ganancias de afiliados para el panel privado (/panel.html, pestaña «Ganancias»).
//   GET  /ganancias?k=TOKEN&desde=AAAA-MM-DD   → comisiones de cada red (se piden en el momento; caché de 30 min) y lo apuntado a mano
//   POST /ganancias/apuntar?k=TOKEN            → {tienda, fecha, eur}: guarda (o borra con eur vacío) una cifra apuntada a mano
// Nada de esto se guarda en el repositorio (es público): las redes se consultan en directo con sus claves, que son secretos del Worker,
// y lo apuntado a mano vive en el KV («g:tienda:fecha», unas pocas escrituras al mes).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS } });
const dia = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);

// Tienda de Pillao según el anunciante que da la red
const TIENDA = [[/k4g/i, "k4g"], [/kinguin/i, "kinguin"], [/g2a/i, "g2a"], [/loaded|cdkeys/i, "loaded"], [/todo ?consolas/i, "todoconsolas"], [/nuuvem/i, "nuuvem"], [/gamivo/i, "gamivo"], [/ggpick/i, "ggpick"], [/gamersgate/i, "gamersgate"], [/aliexpress/i, "aliexpress"], [/gamesporium/i, "gamesporium"], [/mediamarkt/i, "mediamarkt"], [/xtralife/i, "xtralife"], [/pc ?box/i, "pcbox"]];
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

const fechaDMY = (f) => f.slice(8, 10) + "." + f.slice(5, 7) + "." + f.slice(0, 4);
const num = (x) => +String(x ?? 0).replace(",", ".") || 0;
async function aEur(cantidad, moneda) { if (!moneda || moneda === "EUR") return cantidad;
  try { const d = await (await fetch("https://open.er-api.com/v6/latest/EUR", { cf: { cacheTtl: 21600 } })).json(); return d.rates?.[moneda] ? cantidad / d.rates[moneda] : cantidad; } catch { return cantidad; } }

// Admitad (Kinguin, G2A, GGPick…): token de cliente y estadísticas de acciones (ventas)
async function admitad(env, desde, hasta) {
  if (!env.ADMITAD_CLIENT_ID || !env.ADMITAD_CLIENT_SECRET) return { red: "Admitad", estado: "falta" };
  const id = env.ADMITAD_CLIENT_ID.trim(), sec = env.ADMITAD_CLIENT_SECRET.trim();
  const t = await (await fetch("https://api.admitad.com/token/", { method: "POST", headers: { Authorization: "Basic " + btoa(id + ":" + sec), "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(id)}&scope=statistics` })).json();
  if (!t.access_token) throw new Error(t.error_description || t.error || "sin token");
  const filas = [];
  for (let off = 0; off < 5000; off += 500) {
    const d = await (await fetch(`https://api.admitad.com/statistics/actions/?date_start=${fechaDMY(desde)}&date_end=${fechaDMY(hasta)}&limit=500&offset=${off}`, { headers: { Authorization: "Bearer " + t.access_token } })).json();
    for (const x of d.results || []) if (x.status !== "declined") filas.push({ f: String(x.action_date).slice(0, 10), tienda: tiendaDe(x.advcampaign_name), eur: Math.round((await aEur(num(x.payment), x.currency)) * 100) / 100, conf: x.status === "approved" });
    if ((d.results || []).length < 500) break;
  }
  return { red: "Admitad", estado: "ok", filas };
}

// Impact (Loaded): acciones de la cuenta de partner
async function impact(env, desde, hasta) {
  if (!env.IMPACT_ACCOUNT_SID || !env.IMPACT_AUTH_TOKEN) return { red: "Impact", estado: "falta" };
  const sid = env.IMPACT_ACCOUNT_SID.trim(), filas = [];
  for (let pag = 1; pag <= 10; pag++) {
    const r = await fetch(`https://api.impact.com/Mediapartners/${sid}/Actions?ActionDateStart=${desde}T00:00:00Z&ActionDateEnd=${hasta}T23:59:59Z&PageSize=1000&Page=${pag}`, { headers: { Authorization: "Basic " + btoa(sid + ":" + env.IMPACT_AUTH_TOKEN.trim()), Accept: "application/json" } });
    if (!r.ok) throw new Error(r.status === 403 ? "acceso denegado (permisos del token)" : "HTTP " + r.status);
    const d = await r.json();
    for (const x of d.Actions || []) if (!/REVERSED/i.test(x.State)) filas.push({ f: String(x.EventDate || x.CreationDate).slice(0, 10), tienda: tiendaDe(x.CampaignName), eur: Math.round((await aEur(num(x.Payout), x.Currency)) * 100) / 100, conf: /APPROVED|LOCKED|CLEARED/i.test(x.State) });
    if (!d["@nextpageuri"]) break;
  }
  return { red: "Impact", estado: "ok", filas };
}

// Tradedoubler (MediaMarkt, xtralife, PCbox): token con usuario de la API y transacciones
async function tradedoubler(env, desde, hasta) {
  if (!env.TRADEDOUBLER_CLIENT_ID || !env.TRADEDOUBLER_SECRET || !env.TRADEDOUBLER_USER || !env.TRADEDOUBLER_PASS) return { red: "Tradedoubler", estado: "falta" };
  const t = await (await fetch("https://connect.tradedoubler.com/uaa/oauth/token", { method: "POST", headers: { Authorization: "Basic " + btoa(env.TRADEDOUBLER_CLIENT_ID.trim() + ":" + env.TRADEDOUBLER_SECRET.trim()), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=password&username=" + encodeURIComponent(env.TRADEDOUBLER_USER.trim()) + "&password=" + encodeURIComponent(env.TRADEDOUBLER_PASS.trim()) })).json();
  if (!t.access_token) throw new Error(t.error_description || t.error || "sin token");
  const filas = [], ymd = (f) => f.replace(/-/g, "");
  for (let off = 0; off < 5000; off += 100) {
    const d = await (await fetch(`https://connect.tradedoubler.com/publisher/report/transactions?fromDate=${ymd(desde)}&toDate=${ymd(hasta)}&limit=100&offset=${off}`, { headers: { Authorization: "Bearer " + t.access_token } })).json();
    for (const x of d.items || []) {
      const est = String(x.status || x.transactionStatus || "").toUpperCase();
      if (/^(D|DENIED|DECLINED)$/.test(est)) continue;
      const f = String(x.timeOfTransaction || x.transactionDate || x.eventDate || x.date || "").slice(0, 10);
      filas.push({ f, tienda: tiendaDe(x.programName || x.program || ""), eur: Math.round((await aEur(num(x.commission ?? x.publisherCommission), d.reportCurrencyCode || "EUR")) * 100) / 100, conf: /^(A|APPROVED)$/.test(est) });
    }
    if ((d.items || []).length < 100) break;
  }
  return { red: "Tradedoubler", estado: "ok", filas };
}

// Rakuten (Nuuvem): OAuth 2.0 (ID y secreto de cliente, con el SID de la web como alcance) y la API de eventos
async function rakuten(env, desde, hasta) {
  if (!env.RAKUTEN_CLIENT_ID || !env.RAKUTEN_CLIENT_SECRET) return { red: "Rakuten", estado: "falta" };
  const t = await (await fetch("https://api.linksynergy.com/token", { method: "POST", headers: { Authorization: "Bearer " + btoa(env.RAKUTEN_CLIENT_ID.trim() + ":" + env.RAKUTEN_CLIENT_SECRET.trim()), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=4779010" })).json();
  if (!t.access_token) throw new Error(t.error_description || t.error || "sin token");
  const filas = [];
  for (let pag = 1; pag <= 10; pag++) {
    const r = await fetch(`https://api.linksynergy.com/events/1.0/transactions?process_date_start=${desde}%2000:00:00&process_date_end=${hasta}%2023:59:59&limit=1000&page=${pag}`, { headers: { Authorization: "Bearer " + t.access_token } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json(); const lista = Array.isArray(d) ? d : d.transactions || [];
    for (const x of lista) {
      const c = num(x.commissions ?? x.commission_amount ?? x.commission), f = String(x.transaction_date || x.process_date || "").slice(0, 10);
      if (!f || !c) continue;
      filas.push({ f, tienda: tiendaDe(x.advertiser_name || x.offer_name || "nuuvem"), eur: Math.round((await aEur(c, x.currency)) * 100) / 100, conf: false });
    }
    if (lista.length < 1000) break;
  }
  return { red: "Rakuten", estado: "ok", filas };
}

const REDES = [cj, awin, admitad, impact, rakuten,
  tradedoubler];

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
  do { const l = await env.PILLAO.list({ prefix: "g:", cursor, limit: 1000 });
    // Los datos van en los metadatos (apuntado desde el panel) o en el valor (apuntado con la acción de GitHub)
    for (const k of l.keys) { const m = k.metadata && k.metadata.tienda ? k.metadata : await env.PILLAO.get(k.name, "json").catch(() => null); if (m && m.tienda) mano.push(m); }
    cursor = l.list_complete ? null : l.cursor; } while (cursor);
  return json({ desde, hasta, redes, mano, hecho: new Date().toISOString() });
}
