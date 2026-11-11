// Contador propio de visitas y clics (sin cookies, sin terceros, todo en tu Cloudflare).
//
//   GET /v?p=/ruta&r=telegram.org     → suma una visita (lo llama la web al cargar)
//   GET /c?t=tienda&j=juego           → suma un clic en una oferta
//   GET /panel?k=TOKEN&dias=14        → resumen en JSON (necesita el secreto PANEL_TOKEN)
//
// Se guarda solo el recuento por día: ni IP, ni identificadores, ni nada de la persona.
// Los contadores viven en el mismo KV (PILLAO) con prefijo «n:».

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const corto = (s, n) => String(s || "").slice(0, n).replace(/[^\w\-./:áéíóúñ ]/gi, "");
const PIXEL = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);

async function sumar(env, clave, cuanto = 1) {
  const v = +(await env.PILLAO.get(clave)) || 0;
  await env.PILLAO.put(clave, String(v + cuanto), { expirationTtl: 400 * 86400 });
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
    })());
    return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  }
  if (url.pathname === "/panel") {
    // Mensajes distintos para saber qué falla sin enseñar nada
    if (!env.PANEL_TOKEN) return new Response("Falta el secreto PANEL_TOKEN en el Worker.", { status: 503 });
    const dado = url.searchParams.get("k");
    if (!dado) return new Response("Añade ?k=tu-token al final de la dirección.", { status: 401 });
    if (dado.trim() !== String(env.PANEL_TOKEN).trim()) return new Response("Ese token no es el bueno.", { status: 403 });
    const dias = Math.min(90, Math.max(1, +url.searchParams.get("dias") || 14));
    const fechas = [...Array(dias).keys()].map((i) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(Date.now() - i * 86400000))).reverse();
    const visitas = {}, clics = {}, paginas = {}, origen = {}, juegos = {};
    for (const f of fechas) visitas[f] = +(await env.PILLAO.get(`n:v:${f}`)) || 0;
    for (const [prefijo, destino] of [["n:c:", clics], ["n:p:", paginas], ["n:d:", origen], ["n:cj:", juegos]]) {
      let cursor;
      do {
        const l = await env.PILLAO.list({ prefix: prefijo, cursor, limit: 1000 });
        for (const k of l.keys) {
          const resto = k.name.slice(prefijo.length), f = resto.slice(0, 10), que = resto.slice(11);
          if (!fechas.includes(f)) continue;
          destino[que] = (destino[que] || 0) + (+(await env.PILLAO.get(k.name)) || 0);
        }
        cursor = l.list_complete ? null : l.cursor;
      } while (cursor);
    }
    const orden = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 40));
    return new Response(JSON.stringify({
      desde: fechas[0], hasta: fechas[fechas.length - 1],
      visitas, totalVisitas: Object.values(visitas).reduce((a, b) => a + b, 0),
      clicsPorTienda: orden(clics), totalClics: Object.values(clics).reduce((a, b) => a + b, 0),
      paginas: orden(paginas), origen: orden(origen), juegosMasClicados: orden(juegos),
    }, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  return null;
}
