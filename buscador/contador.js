// Contador propio de visitas y clics (sin cookies, sin terceros, todo en tu Cloudflare).
//
//   GET /v?p=/ruta&r=telegram.org     → suma una visita (lo llama la web al cargar)
//   GET /c?t=tienda&j=juego           → suma un clic en una oferta
//   GET /panel?k=TOKEN&dias=14        → resumen en JSON (necesita el secreto PANEL_TOKEN), con el desglose por día
//                                        (hasta 400 días) para que pillaojuegos.com/panel.html filtre por fechas
//
// Se guarda solo el recuento por día: ni IP, ni identificadores, ni nada de la persona.
// Los contadores viven en el mismo KV (PILLAO) con prefijo «n:».

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const corto = (s, n) => String(s || "").slice(0, n).replace(/[^\w\-./:áéíóúñ ]/gi, "");
const PIXEL = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);

// El recuento va también en los metadatos de la clave: así el panel lo lee al listar, sin una lectura por clave
async function sumar(env, clave, cuanto = 1) {
  const v = +(await env.PILLAO.get(clave)) || 0;
  await env.PILLAO.put(clave, String(v + cuanto), { expirationTtl: 400 * 86400, metadata: { v: v + cuanto } });
}

export async function rutasContador(req, env, ctx, url) {
  const dia = hoy();
  if (url.pathname === "/v") {
    const ruta = corto(url.searchParams.get("p") || "/", 60);
    const de = corto(url.searchParams.get("r") || "", 40).toLowerCase();
    ctx.waitUntil((async () => {
      await sumar(env, `n:v:${dia}`);
      await sumar(env, `n:p:${dia}:${ruta}`);
      if (de) await sumar(env, `n:d:${dia}:${de}`);
    })());
    // Devuelve una imagen de 1 píxel: así funciona hasta sin JavaScript
    return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  }
  if (url.pathname === "/c") {
    const tienda = corto(url.searchParams.get("t"), 30), juego = corto(url.searchParams.get("j"), 80);
    if (tienda) ctx.waitUntil((async () => {
      await sumar(env, `n:c:${dia}:${tienda}`);
      if (juego) await sumar(env, `n:cj:${dia}:${juego}`);
      if (juego) await sumar(env, `n:ctj:${dia}:${tienda}|${juego}`);
    })());
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
    const leer = async (prefijo, conQue) => {
      const out = {};
      let cursor;
      do {
        const l = await env.PILLAO.list({ prefix: prefijo, cursor, limit: 1000 });
        for (const k of l.keys) {
          const resto = k.name.slice(prefijo.length), f = resto.slice(0, 10);
          if (f < desde) continue;
          const n = k.metadata && k.metadata.v != null ? +k.metadata.v : +(await env.PILLAO.get(k.name)) || 0;
          if (conQue) { const que = resto.slice(11); (out[f] || (out[f] = {}))[que] = n; } else out[f] = n;
        }
        cursor = l.list_complete ? null : l.cursor;
      } while (cursor);
      return out;
    };
    const v = await leer("n:v:", false);
    for (const f of fechas) visitas[f] = v[f] || 0;
    const [clicsDia, paginasDia, origenDia, juegosDia, tiendaJuegoDia] = await Promise.all([leer("n:c:", true), leer("n:p:", true), leer("n:d:", true), leer("n:cj:", true), leer("n:ctj:", true)]);
    const sumarTodo = (dia) => { const o = {}; for (const f in dia) for (const k in dia[f]) o[k] = (o[k] || 0) + dia[f][k]; return o; };
    const orden = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 40));
    const clics = sumarTodo(clicsDia);
    return new Response(JSON.stringify({
      desde, hasta: fechas[fechas.length - 1],
      visitas, totalVisitas: Object.values(visitas).reduce((a, b) => a + b, 0),
      clicsPorTienda: orden(clics), totalClics: Object.values(clics).reduce((a, b) => a + b, 0),
      paginas: orden(sumarTodo(paginasDia)), origen: orden(sumarTodo(origenDia)), juegosMasClicados: orden(sumarTodo(juegosDia)),
      dias: { clics: clicsDia, paginas: paginasDia, origen: origenDia, juegos: juegosDia, tiendaJuego: tiendaJuegoDia },
    }), { headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
  }
  return null;
}
