// Ficha de un juego: la campana abre aquí mismo el historial de precios y el aviso por email (sin ir al comparador)
(function () {
  var b = document.querySelector("a.campana[data-id]");
  if (!b) return;
  var D = b.dataset, TROZOS = 128, MON = D.moneda || "EUR", API = (D.api || "").replace(/\/$/, "");
  var SIM = { USD: "US$", MXN: "MX$", ARS: "AR$", BRL: "R$", CLP: "CL$", COP: "COL$", PEN: "S/", VES: "Bs.", PYG: "₲" };
  function eur(n) {
    if (MON === "EUR") return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    var d = n >= 100 && MON !== "USD" ? 0 : 2;
    return (SIM[MON] || MON) + " " + n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function trozoDe(id) { var h = 5381; for (var i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0; return h % TROZOS; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ahora = parseFloat(D.ahora) || 0, raiz = D.raiz || "/";
  var fondo, puntos = null, rango = 90;

  function grafico() {
    var cont = fondo.querySelector(".av-graf");
    if (puntos === null) { cont.innerHTML = '<p class="av-nota">Cargando historial…</p>'; return; }
    var ps = puntos;
    if (rango) { var desde = new Date(Date.now() - rango * 864e5).toISOString().slice(0, 10); ps = ps.filter(function (p) { return p[0] >= desde; }); }
    if (ps.length < 2) { cont.innerHTML = '<p class="av-nota">Aún no tenemos historial suficiente de este juego. Crea el aviso y te escribimos cuando baje.</p>'; return; }
    var W = 600, H = 220, pl = 44, pr = 10, pt = 10, pb = 26;
    var t0 = Date.parse(ps[0][0]), t1 = Date.parse(ps[ps.length - 1][0]) || t0 + 1;
    var max = Math.max.apply(null, ps.map(function (p) { return p[3] || p[1]; })), min = Math.min.apply(null, ps.map(function (p) { return p[1]; }));
    var top = Math.ceil(max * 1.1), bot = Math.max(0, Math.floor(min * 0.85));
    if (top === bot) top = bot + 1;
    var x = function (d) { return pl + (Date.parse(d) - t0) / (t1 - t0) * (W - pl - pr); }, y = function (v) { return pt + (top - v) / (top - bot) * (H - pt - pb); };
    function linea(i, cls) { var s = ""; ps.forEach(function (p, k) { var v = p[i]; if (v == null) return; s += (k ? (" H" + x(p[0]).toFixed(1) + " V") : "M" + x(p[0]).toFixed(1) + " ") + y(v).toFixed(1); }); return '<path class="' + cls + '" d="' + s + '"/>'; }
    var ejes = "";
    for (var k = 0; k <= 4; k++) { var v = bot + (top - bot) * k / 4; ejes += '<line class="av-rej" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v) + "</text>"; }
    var fechas = "", n = 4;
    for (k = 0; k <= n; k++) { var t = new Date(t0 + (t1 - t0) * k / n); fechas += '<text x="' + (pl + (W - pl - pr) * k / n).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (k === 0 ? "start" : k === n ? "end" : "middle") + '">' + t.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + "</text>"; }
    var minH = Math.min.apply(null, ps.map(function (p) { return p[1]; }));
    cont.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Historial de precios">' + ejes + fechas + linea(3, "av-max") + linea(2, "av-med") + linea(1, "av-min") + "</svg>" +
      '<div class="av-ley"><span class="l-min">Más barato</span><span class="l-med">Precio medio</span><span class="l-max">Más caro</span></div>' +
      '<p class="av-nota">Mínimo en este periodo: <b>' + eur(minH) + "</b></p>";
  }

  function abrir(e) {
    e.preventDefault();
    if (!fondo) {
      fondo = document.createElement("div");
      fondo.className = "av-fondo";
      fondo.innerHTML = '<div class="av-caja" role="dialog" aria-modal="true" aria-labelledby="av-tit">' +
        '<button type="button" class="av-x" aria-label="Cerrar">×</button>' +
        '<h2 id="av-tit">' + esc(D.titulo || "") + "</h2><p class=\"av-sub\">Historial de precios y aviso por email</p>" +
        '<div class="av-datos"><div><small>Ahora</small><b>' + eur(ahora) + "</b></div>" + (D.min ? "<div><small>Mínimo histórico</small><b>" + eur(parseFloat(D.min)) + "</b></div>" : "") + "</div>" +
        (D.hist ? '<div class="av-rangos"><button type="button" data-r="30">1 mes</button><button type="button" data-r="90" aria-pressed="true">3 meses</button><button type="button" data-r="365">1 año</button><button type="button" data-r="0">Todo</button></div><div class="av-graf"></div>' : "") +
        '<form class="av-form" novalidate><h3>Avísame si baja de</h3><div class="av-fila"><label>Precio<input name="precio" inputmode="decimal" placeholder="' + (ahora ? eur(Math.max(0.5, Math.floor(ahora * 0.8 * 100) / 100)).replace(/[^\d.,]/g, "") : "") + '" required></label>' +
        '<label>Tu email<input name="email" type="email" autocomplete="email" placeholder="tu@email.com" required></label></div>' +
        '<label class="av-ok"><input type="checkbox" name="acepto"> Acepto que Pillao guarde mi email para avisarme de este precio. Puedo borrarlo cuando quiera. <a href="' + raiz + 'legal.html#privacidad">Privacidad</a></label>' +
        '<button type="submit" class="av-env">Crear aviso</button><p class="av-msg" role="status"></p></form></div>';
      document.body.appendChild(fondo);
      fondo.addEventListener("click", function (ev) {
        if (ev.target === fondo || ev.target.closest(".av-x")) cerrar();
        var r = ev.target.closest("[data-r]");
        if (r) { rango = +r.dataset.r; [].forEach.call(fondo.querySelectorAll("[data-r]"), function (x) { x.setAttribute("aria-pressed", x === r); }); grafico(); }
      });
      fondo.querySelector("form").addEventListener("submit", enviar);
      if (D.hist) {
        grafico();
        fetch(raiz + "data/historial/" + String(trozoDe(D.id)).padStart(3, "0") + ".json").then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; }).then(function (h) { puntos = (h && h[D.id]) || []; grafico(); });
      }
    }
    fondo.hidden = false; document.body.style.overflow = "hidden";
    fondo.querySelector(".av-x").focus();
    document.addEventListener("keydown", tecla);
  }
  function cerrar() { fondo.hidden = true; document.body.style.overflow = ""; document.removeEventListener("keydown", tecla); b.focus(); }
  function tecla(e) { if (e.key === "Escape") cerrar(); }
  function enviar(e) {
    e.preventDefault();
    var f = e.target, msg = f.querySelector(".av-msg"), boton = f.querySelector(".av-env");
    var precio = parseFloat(String(f.precio.value).replace(/[^\d.,]/g, "").replace(",", ".")), email = f.email.value.trim();
    var di = function (t, ok) { msg.textContent = t; msg.className = "av-msg " + (ok ? "ok" : "mal"); };
    if (!(precio >= 0.5)) { di("Escribe el precio al que quieres que te avisemos.", false); f.precio.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { di("Escribe un email válido.", false); f.email.focus(); return; }
    if (!f.acepto.checked) { di("Marca la casilla para que podamos guardar tu email.", false); return; }
    if (!API) { di("Los avisos no están disponibles ahora mismo.", false); return; }
    boton.disabled = true; di("Creando aviso…", true);
    fetch(API + "/avisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ juego: D.id, titulo: D.titulo, precio: precio, email: email }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        boton.disabled = false;
        if (!d.id) { di(d.error || "No se ha podido crear el aviso.", false); return; }
        f.precio.value = "";
        di(d.estado === "pendiente" ? "¡Hecho! Te hemos mandado un correo a " + email + ": pulsa el botón para confirmar el aviso (mira también en spam)."
          : "¡Hecho! Te escribiremos cuando baje de " + eur(precio) + ".", true);
        b.classList.add("con");
      })
      .catch(function () { boton.disabled = false; di("No hemos podido conectar. Comprueba tu conexión y vuelve a probar.", false); });
  }
  b.addEventListener("click", abrir);
})();
