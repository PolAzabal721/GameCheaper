// Contador propio de visitas y clics (sin cookies, sin terceros, todo en tu Cloudflare).
//
//   GET /v?p=/ruta&r=telegram.org     → suma una visita (lo llama la web al cargar)
//   GET /c?t=tienda&j=juego           → suma un clic en una oferta
//   GET /panel?k=TOKEN&dias=14        → resumen en JSON (necesita el secreto PANEL_TOKEN), con el desglose por día
//                                        (hasta 400 días) para que pillaojuegos.com/panel.html filtre por fechas
//
// Se guarda solo el recuento por día: ni IP, ni identificadores, ni nada de la persona.
// Los contadores viven en una base D1 (DB, tabla n: clave → recuento): el plan gratis de D1 aguanta 100.000 escrituras
// al día, y el de KV solo 1.000 (lo superábamos y Cloudflare bloqueaba el KV, avisos de precio incluidos).
// Lo que se contó antes en el KV (claves «n:…») se pasa solo a D1 la primera vez que se abre el panel.

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const corto = (s, n) => String(s || "").slice(0, n).replace(/[^\w\-./:áéíóúñ ]/gi, "");
const PIXEL = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);

// País (dos letras) que da Cloudflare: solo el país, nada de la persona
const paisDe = (req) => { const c = String(req.cf?.country || "").toUpperCase(); return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : ""; };

// El recuento va también en los metadatos de la clave: así el panel lo lee al listar, sin una lectura por clave
// Pasa una sola vez los recuentos antiguos del KV («n:…») a D1; solo lee el KV (sin escribir en él)
async function migrar(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS hecho (que TEXT PRIMARY KEY)").run();
  if (await env.DB.prepare("SELECT que FROM hecho WHERE que = 'kv'").first()) return;
  const datos = []; let cursor;
  do {
    const l = await env.PILLAO.list({ prefix: "n:", cursor, limit: 1000 });
    for (const k of l.keys) { const n = k.metadata && k.metadata.v != null ? +k.metadata.v : 0; if (n) datos.push([k.name, n]); }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  const st = env.DB.prepare("INSERT INTO n (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = v + ?2");
  for (let i = 0; i < datos.length; i += 80) await env.DB.batch(datos.slice(i, i + 80).map(([k, n]) => st.bind(k, n)));
  await env.DB.prepare("INSERT INTO hecho (que) VALUES ('kv')").run();
}
let tablaLista = false;
async function tabla(env) { if (tablaLista) return; await env.DB.prepare("CREATE TABLE IF NOT EXISTS n (k TEXT PRIMARY KEY, v INTEGER NOT NULL)").run(); tablaLista = true; }
// Suma 1 a varias claves de una vez (una sola llamada a D1)
async function sumarVarias(env, claves) {
  claves = claves.filter(Boolean); if (!claves.length) return;
  if (!env.DB) return; // sin base no se cuenta (nunca se escribe en el KV: tiene un límite diario muy bajo)
  await tabla(env);
  const st = env.DB.prepare("INSERT INTO n (k, v) VALUES (?1, 1) ON CONFLICT(k) DO UPDATE SET v = v + 1");
  await env.DB.batch(claves.map((k) => st.bind(k)));
}

export async function rutasContador(req, env, ctx, url) {
  const dia = hoy();
  if (url.pathname === "/v") {
    const ruta = corto(url.searchParams.get("p") || "/", 60);
    const de = corto(url.searchParams.get("r") || "", 40).toLowerCase();
    const pais = paisDe(req);
    ctx.waitUntil(sumarVarias(env, [`n:v:${dia}`, `n:p:${dia}:${ruta}`, de && `n:d:${dia}:${de}`, pais && `n:vp:${dia}:${pais}`]).catch(() => {}));
    // Devuelve una imagen de 1 píxel: así funciona hasta sin JavaScript
    return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  }
  if (url.pathname === "/c") {
    const tienda = corto(url.searchParams.get("t"), 30), juego = corto(url.searchParams.get("j"), 80), pais = paisDe(req);
    if (tienda) ctx.waitUntil(sumarVarias(env, [`n:c:${dia}:${tienda}`, juego && `n:cj:${dia}:${juego}`, juego && `n:ctj:${dia}:${tienda}|${juego}`,
      pais && `n:cp:${dia}:${pais}|${tienda}`, pais && juego && `n:cpj:${dia}:${pais}|${juego}`]).catch(() => {}));
    return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  }
  if (url.pathname === "/panel") {
    // Mensajes distintos para saber qué falla sin enseñar nada
    if (!env.PANEL_TOKEN) return new Response("Falta el secreto PANEL_TOKEN en el Worker.", { status: 503 });
    const dado = url.searchParams.get("k");
    if (!dado) return new Response("Añade ?k=tu-token al final de la dirección.", { status: 401, headers: { "Access-Control-Allow-Origin": "*" } });
    if (dado.trim() !== String(env.PANEL_TOKEN).trim()) return new Response("Ese token no es el bueno.", { status: 403, headers: { "Access-Control-Allow-Origin": "*" } });
    const dias = Math.min(400, Math.max(1, +url.searchParams.get("dias") || 14));
    const fechas = [...Array(dias).keys()].map((i) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(Date.now() - i * 86400000))).reverse();
    const desde = fechas[0];
    const visitas = {};
    // Visitas de cada día (con metadatos, una sola lista)
    // Todo de una sola consulta a D1
    if (!env.DB) return new Response("Falta la base D1 del contador.", { status: 503, headers: { "Access-Control-Allow-Origin": "*" } });
    await tabla(env);
    await migrar(env);
    const filas = (await env.DB.prepare("SELECT k, v FROM n WHERE k LIKE 'n:%'").all()).results || [];
    const leer = async (prefijo, conQue) => {
      const out = {};
      for (const { k, v: n } of filas) {
        if (!k.startsWith(prefijo)) continue;
        const resto = k.slice(prefijo.length), f = resto.slice(0, 10);
        if (f < desde) continue;
        if (conQue) { const que = resto.slice(11); (out[f] || (out[f] = {}))[que] = n; } else out[f] = n;
      }
      return out;
    };
    const v = await leer("n:v:", false);
    for (const f of fechas) visitas[f] = v[f] || 0;
    const [clicsDia, paginasDia, origenDia, juegosDia, tiendaJuegoDia, visitasPais, clicsPais, juegosPais] = await Promise.all([leer("n:c:", true), leer("n:p:", true), leer("n:d:", true), leer("n:cj:", true), leer("n:ctj:", true), leer("n:vp:", true), leer("n:cp:", true), leer("n:cpj:", true)]);
    const sumarTodo = (dia) => { const o = {}; for (const f in dia) for (const k in dia[f]) o[k] = (o[k] || 0) + dia[f][k]; return o; };
    const orden = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 40));
    const clics = sumarTodo(clicsDia);
    return new Response(JSON.stringify({
      desde, hasta: fechas[fechas.length - 1],
      visitas, totalVisitas: Object.values(visitas).reduce((a, b) => a + b, 0),
      clicsPorTienda: orden(clics), totalClics: Object.values(clics).reduce((a, b) => a + b, 0),
      paginas: orden(sumarTodo(paginasDia)), origen: orden(sumarTodo(origenDia)), juegosMasClicados: orden(sumarTodo(juegosDia)),
      dias: { clics: clicsDia, paginas: paginasDia, origen: origenDia, juegos: juegosDia, tiendaJuego: tiendaJuegoDia, visitasPais, clicsPais, juegosPais },
    }), { headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
  }
  return null;
}
