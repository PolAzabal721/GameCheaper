// Avisos de bajada de precio por email + historial de precios de PC (IsThereAnyDeal)
//
// POST   /avisos              {juego, titulo, precio, email}  -> crea un aviso y manda el correo de confirmación
// GET    /avisos/estado?ids=a,b                                -> estado de tus avisos (pendiente, activo, enviado, no existe)
// DELETE /avisos?id=…                                          -> borra un aviso
// GET    /avisos/confirmar?id=…  /avisos/borrar?id=…           -> enlaces de los correos (devuelven una página)
// GET    /historial?titulo=…                                   -> historial de precios de PC según IsThereAnyDeal
// Programado (cron): lee minimos.json de la web y manda los avisos que se han cumplido.
//
// Cada aviso es una clave del KV: "av:<huella del email>:<juego>:<aleatorio>" con sus datos en los metadatos.
// La parte aleatoria hace de contraseña: solo quien tiene el enlace (el navegador que lo creó o el email) puede tocarlo.
// Envío de correos con Brevo: secretos BREVO_API_KEY y AVISOS_REMITENTE (email verificado en Brevo).

const WEB = "https://polazabal721.github.io/GameCheaper/";
const SIN_CONFIRMAR_SEG = 2 * 86400;    // un aviso sin confirmar se borra a los 2 días
const ENVIADO_SEG = 30 * 86400;          // un aviso ya enviado se guarda 30 días (para que la web enseñe «te avisamos»)
const MAX_POR_JUEGO = 5;
const MAX_POR_EMAIL = 50;
const MAX_ALTAS_HORA = 10;               // altas por IP y hora
const MAX_ENVIOS_HORA = 40;              // el plan gratis de Brevo permite 300 correos al día
const ID_RE = /^[a-f0-9]{12}:[a-z0-9-]{1,80}:[a-f0-9]{24}$/;
const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,}$/i;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (d, estado = 200) => new Response(JSON.stringify(d), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const huella = async (email) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email))).slice(0, 12);
const aleatorio = () => hex(crypto.getRandomValues(new Uint8Array(12)));
const limpiar = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function pagina(titulo, texto, estado = 200, boton = `<a class="b" href="${WEB}">Volver a Pillao</a>`) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Pillao</title>
<meta name="robots" content="noindex"><style>body{margin:0;font-family:system-ui,sans-serif;background:#eef0f5;color:#141a2e;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{background:#fff;border-radius:14px;padding:28px;max-width:460px;box-shadow:0 4px 20px rgba(0,0,0,.08)}h1{margin:0 0 8px;font-size:22px}p{color:#5a6280;line-height:1.5}
a.b,button.b{display:inline-block;border:0;font:inherit;cursor:pointer;margin-top:8px;background:#141a2e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}
@media(prefers-color-scheme:dark){body{background:#0e1120;color:#e8ebf6}main{background:#161a2c}p{color:#98a0bf}a.b,button.b{background:#e8ebf6;color:#141a2e}}</style></head>
<body><main><h1>${esc(titulo)}</h1><p>${texto}</p>${boton}</main></body></html>`, { status: estado, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function mandarEmail(env, para, asunto, html) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY.trim(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Pillao", email: env.AVISOS_REMITENTE.trim() }, to: [{ email: para }], subject: asunto, htmlContent: html }),
  });
  if (!r.ok) throw new Error(`Brevo respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

function correo(cuerpo, borrar) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#141a2e;line-height:1.5">
<p style="font-size:22px;font-weight:800;margin:0 0 16px">Pillao</p>${cuerpo}
<p style="color:#5a6280;font-size:13px;margin-top:28px;border-top:1px solid #d9dce8;padding-top:12px">Recibes este correo porque pediste un aviso de precio en Pillao.
${borrar ? `<a href="${borrar}" style="color:#5a6280">Eliminar este aviso</a>.` : ""}</p></div>`;
}
const boton = (href, texto) => `<p><a href="${href}" style="display:inline-block;background:#141a2e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">${texto}</a></p>`;

async function leerAviso(env, id) {
  if (!ID_RE.test(id || "")) return null;
  const { value, metadata } = await env.PILLAO.getWithMetadata("av:" + id);
  return value === null ? null : metadata;
}

async function crear(req, env, origen) {
  if (!env.BREVO_API_KEY || !env.AVISOS_REMITENTE) return json({ error: "Los avisos por email todavía no están activados. Vuelve a probar en unos días." }, 503);
  let d; try { d = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }
  const email = String(d.email || "").trim().toLowerCase(), juego = String(d.juego || ""), titulo = String(d.titulo || "").slice(0, 120);
  const precio = Math.round(Number(d.precio) * 100) / 100;
  if (!EMAIL_RE.test(email)) return json({ error: "Ese email no parece válido." }, 400);
  if (!/^[a-z0-9-]{1,80}$/.test(juego) || !titulo) return json({ error: "Juego no válido." }, 400);
  if (!(precio >= 0.5 && precio <= 1000)) return json({ error: "Pon un precio entre 0,50 € y 1.000 €." }, 400);

  // Límite de altas por IP (para que nadie use Pillao para llenar de correos a otra persona)
  const ip = req.headers.get("CF-Connecting-IP") || "?";
  const hora = Math.floor(Date.now() / 3600000);
  const rl = "rl:" + (await huella(ip + hora));
  const altas = +(await env.PILLAO.get(rl)) || 0;
  if (altas >= MAX_ALTAS_HORA) return json({ error: "Has creado muchos avisos seguidos. Espera un rato y vuelve a probar." }, 429);

  const h = await huella(email);
  const deEsteEmail = await env.PILLAO.list({ prefix: `av:${h}:`, limit: 1000 });
  if (deEsteEmail.keys.length >= MAX_POR_EMAIL) return json({ error: `Ya tienes ${MAX_POR_EMAIL} avisos con este email. Borra alguno para crear otro.` }, 400);
  const deEsteJuego = deEsteEmail.keys.filter((k) => k.name.startsWith(`av:${h}:${juego}:`));
  if (deEsteJuego.length >= MAX_POR_JUEGO) return json({ error: `Como mucho ${MAX_POR_JUEGO} avisos por juego.` }, 400);
  // Si ya confirmó otro aviso con este email, el nuevo queda activo sin volver a confirmar
  const yaConfirmado = deEsteEmail.keys.some((k) => k.metadata?.ok);

  const id = `${h}:${juego}:${aleatorio()}`;
  const meta = { e: email, j: juego, t: titulo, p: precio, ok: yaConfirmado, c: new Date().toISOString().slice(0, 10) };
  await env.PILLAO.put("av:" + id, "1", { metadata: meta, ...(yaConfirmado ? {} : { expirationTtl: SIN_CONFIRMAR_SEG }) });
  await env.PILLAO.put(rl, String(altas + 1), { expirationTtl: 3700 });

  try {
    // Si el email ya está confirmado no mandamos nada ahora: solo escribiremos cuando baje el precio
    if (!yaConfirmado) {
      await mandarEmail(env, email, `Confirma tu aviso de precio de ${titulo}`, correo(
        `<p>Has pedido que te avisemos cuando <b>${esc(titulo)}</b> baje de <b>${eur(precio)}</b>.</p>${boton(`${origen}/avisos/confirmar?id=${id}`, "Confirmar aviso")}
<p style="color:#5a6280;font-size:14px">Si no lo has pedido tú, ignora este correo: el aviso se borra solo en 48 horas.</p>`, null));
    }
  } catch (e) {
    await env.PILLAO.delete("av:" + id);
    // El motivo de Brevo ayuda a ver si falta verificar el remitente o la clave no vale
    const motivo = /sender|remitente/i.test(e.message) ? " (el remitente no está verificado en Brevo)" : /key|unauthori[sz]ed|permission/i.test(e.message) ? " (problema con la clave de Brevo)" : "";
    console.log("Brevo: " + e.message);
    return json({ error: "No hemos podido mandar el correo" + motivo + ". Prueba otra vez más tarde.", detalle: e.message.slice(0, 160) }, 502);
  }
  return json({ id, estado: yaConfirmado ? "activo" : "pendiente" });
}

async function estado(env, ids) {
  const salida = {};
  await Promise.all(ids.slice(0, 50).map(async (id) => {
    const m = await leerAviso(env, id);
    salida[id] = !m ? "no existe" : m.s ? "enviado" : m.ok ? "activo" : "pendiente";
  }));
  return salida;
}

// ---------- Historial de PC (IsThereAnyDeal) ----------
async function historialITAD(titulo, env) {
  if (!env.ITAD_KEY) return { puntos: [] };
  const key = encodeURIComponent(env.ITAD_KEY.trim());
  const l = await (await fetch(`https://api.isthereanydeal.com/games/lookup/v1?key=${key}&title=${encodeURIComponent(titulo)}`)).json();
  if (!l.found || !l.game?.id || limpiar(l.game.title) !== limpiar(titulo)) return { puntos: [] };
  const since = new Date(Date.now() - 3 * 365 * 86400000).toISOString().replace(/\.\d+Z$/, "Z");
  const r = await fetch(`https://api.isthereanydeal.com/games/history/v2?key=${key}&id=${l.game.id}&country=ES&since=${encodeURIComponent(since)}`);
  if (!r.ok) return { puntos: [], error: `ITAD ${r.status}` };
  const eventos = (await r.json()).filter((x) => x.deal?.price?.currency === "EUR").sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  // Precio vigente de cada tienda; un punto por cada día con cambios
  const actual = new Map(), porDia = new Map();
  for (const ev of eventos) {
    actual.set(ev.shop?.id, ev.deal.price.amount);
    const v = [...actual.values()];
    porDia.set(ev.timestamp.slice(0, 10), [Math.min(...v), Math.max(...v), Math.round(v.reduce((s, x) => s + x, 0) / v.length * 100) / 100]);
  }
  const desde = new Date(Date.now() - 3 * 365 * 86400000).toISOString().slice(0, 10);
  return { fuente: "IsThereAnyDeal", puntos: [...porDia].filter(([d]) => d >= desde).map(([d, v]) => [d, ...v]) };
}

export async function rutasAvisos(req, env, ctx, url) {
  const origen = url.origin;
  if (url.pathname === "/avisos" && req.method === "POST") return crear(req, env, origen);
  if (url.pathname === "/avisos" && req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!(await leerAviso(env, id))) return json({ ok: true, estado: "no existe" });
    await env.PILLAO.delete("av:" + id);
    return json({ ok: true });
  }
  if (url.pathname === "/avisos/estado") return json(await estado(env, (url.searchParams.get("ids") || "").split(",").filter(Boolean)));
  const formulario = (texto) => `<form method="post" action="${esc(url.pathname + url.search)}"><button class="b" type="submit">${texto}</button></form>`;
  if (url.pathname === "/avisos/confirmar") {
    const id = url.searchParams.get("id"), m = await leerAviso(env, id);
    if (!m) return pagina("Este aviso ya no existe", "Puede que haya caducado (los avisos sin confirmar se borran a las 48 horas). Crea uno nuevo desde la campana del juego.", 404);
    if (req.method !== "POST" && !m.ok) return pagina("Confirma tu aviso", `Te escribiremos cuando <b>${esc(m.t)}</b> baje de <b>${eur(m.p)}</b>.`, 200, formulario("Confirmar aviso"));
    if (!m.ok) await env.PILLAO.put("av:" + id, "1", { metadata: { ...m, ok: true } });
    return pagina("Aviso activado", `Te escribiremos cuando <b>${esc(m.t)}</b> baje de <b>${eur(m.p)}</b>. Puedes borrarlo cuando quieras desde la campana del juego o desde el enlace de nuestros correos.`);
  }
  if (url.pathname === "/avisos/borrar") {
    const id = url.searchParams.get("id"), m = await leerAviso(env, id);
    if (!m) return pagina("Aviso eliminado", "Este aviso ya estaba eliminado.");
    if (req.method !== "POST") return pagina("¿Eliminar este aviso?", `Dejaremos de vigilar <b>${esc(m.t)}</b> (por debajo de ${eur(m.p)}).`, 200, formulario("Eliminar aviso"));
    await env.PILLAO.delete("av:" + id);
    return pagina("Aviso eliminado", `Ya no te escribiremos sobre <b>${esc(m.t)}</b>.`);
  }
  if (url.pathname === "/historial") {
    const titulo = (url.searchParams.get("titulo") || "").slice(0, 120);
    if (limpiar(titulo).length < 2) return json({ puntos: [] });
    const cacheKey = new Request(`${origen}/historial?v=2&t=${encodeURIComponent(limpiar(titulo))}`);
    const enCache = await caches.default.match(cacheKey);
    if (enCache) return enCache;
    const resp = new Response(JSON.stringify(await historialITAD(titulo, env)), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=43200", ...CORS } });
    ctx.waitUntil(caches.default.put(cacheKey, resp.clone()));
    return resp;
  }
  return null;
}

// ---------- Programado: mandar los avisos que se han cumplido ----------
export async function revisarAvisos(env, origen) {
  if (!env.BREVO_API_KEY || !env.AVISOS_REMITENTE) return;
  const r = await fetch(WEB + "minimos.json?t=" + Date.now(), { cf: { cacheTtl: 0 } });
  if (!r.ok) throw new Error("minimos.json: HTTP " + r.status);
  const { p } = await r.json();
  let enviados = 0, cursor;
  do {
    const l = await env.PILLAO.list({ prefix: "av:", cursor, limit: 1000 });
    for (const k of l.keys) {
      const m = k.metadata;
      if (!m || !m.ok || m.s || !p[m.j]) continue;
      const [ahora, tienda] = p[m.j];
      if (ahora > m.p) continue;
      if (enviados >= MAX_ENVIOS_HORA) return;
      const id = k.name.slice(3);
      try {
        await mandarEmail(env, m.e, `¡${m.t} ha bajado a ${eur(ahora)}!`, correo(
          `<p><b>${esc(m.t)}</b> está a <b>${eur(ahora)}</b> en ${esc(tienda)}. Tu aviso era por debajo de ${eur(m.p)}.</p>
${boton(`${WEB}juego/${m.j}/`, "Ver precios")}<p style="color:#5a6280;font-size:14px">Los precios cambian rápido: compruébalo en la tienda antes de comprar. Este aviso ya no volverá a escribirte; si quieres otro, créalo desde la campana del juego.</p>`,
          `${origen}/avisos/borrar?id=${id}`));
        await env.PILLAO.put(k.name, "1", { metadata: { ...m, s: new Date().toISOString().slice(0, 10), pe: ahora }, expirationTtl: ENVIADO_SEG });
        enviados++;
      } catch (e) { console.log("Aviso " + id + ": " + e.message); }
    }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  console.log(`Avisos enviados: ${enviados}`);
}
