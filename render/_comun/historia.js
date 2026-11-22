// Motor de historias «¿Sabías que…?» de Pillao (1080x1920), sobre kit.js.
// Cada vídeo define JUEGO (datos y precio) y ESCENAS (frase + dibujo). Aquí se calculan los tiempos,
// se añaden las tres escenas finales de precio y cierre, y se dibuja con una caja de piezas propias
// (nada de personajes ni logos de nadie: solo dibujos genéricos hechos aquí).

const fmtE = (v) => v.toFixed(2).replace(".", ",");
// Duración de cada frase según lo que tarda en leerse en voz alta (los precios, más despacio)
function durFrase(f) { const ws = f.split(" "); return Math.max(3.3, 0.7 + ws.reduce((a, w) => a + peso(w), 0) * 0.43); }

function montar() {
  const J = JUEGO, dto = J.pvp > J.precio ? Math.round((1 - J.precio / J.pvp) * 100) : 0;
  const finales = [
    { f: `Hoy lo tienes a *${fmtE(J.precio)}* euros en *${J.tiendaNombre}*, para ${J.plat}.`, p: (lt, k) => escenaPrecio(lt, k) },
    dto >= 10 ? { f: `Costaba *${fmtE(J.pvp)}*: es un *${dto}* por ciento menos.`, p: (lt, k) => escenaDescuento(lt, k, dto) } : null,
    { f: `Compara todas las tiendas en *pillaojuegos.com* y pilla el más barato.`, p: (lt, k) => fondoSuave() + cierre(lt, PALETA.acento) },
  ].filter(Boolean);
  let t = 0.2; window.TRAMOS = [];
  for (const e of [...ESCENAS, ...finales]) { const d = e.d || durFrase(e.f); TRAMOS.push({ ...e, t0: t, t1: t + d }); t += d + 0.1; }
  window.DUR = Math.round((t + 0.5) * 10) / 10;
  window.FRASES = TRAMOS.map((e) => [e.t0, e.t1, e.f]);
  window.escena = (tt) => { const e = TRAMOS.find((x) => tt < x.t1 + 0.1) || TRAMOS[TRAMOS.length - 1]; const lt = Math.max(0, tt - e.t0); return `<div style="position:absolute;inset:0;transform:translate(${sacude(tt)}px,0)">${e.p(lt, cl(lt / (e.t1 - e.t0)))}</div>`; };
  window.SACUDIDAS = window.SACUDIDAS || [];
}
function sacude(t) { let a = 0; for (const c of window.SACUDIDAS || []) { const d = t - c; if (d > 0 && d < .7) a += Math.sin(d * 70) * 12 * (1 - d / .7); } return a; }

// ---------- escenas finales ----------
function fondoSuave() { return `<div style="position:absolute;left:0;right:0;top:1500px;bottom:0;background:${PALETA.suelo || "rgba(0,0,0,.35)"}"></div>`; }
function caja(x, y, w, rot = 0) {
  const h = w * 1.25, J = JUEGO;
  const banda = { PC: ["#1b2838", "PC"], PS5: ["#0b3fd0", "PS5"], "Xbox Series": ["#107c10", "XBOX"], Switch: ["#e60012", "SWITCH"] }[J.plat] || ["#333", J.plat];
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg);border-radius:12px;overflow:hidden;box-shadow:0 0 0 6px ${PALETA.acento},0 30px 60px rgba(0,0,0,.5);background:${J.cajaFondo || PALETA.cielo}">
   <div style="position:absolute;left:0;right:0;top:0;height:${h * .09}px;background:${banda[0]};color:#fff;font:900 ${w * .08}px 'Inter Display';display:flex;align-items:center;padding-left:${w * .05}px">${banda[1]}</div>
   ${J.cajaDibujo ? `<div style="position:absolute;left:0;top:${h * .1}px;width:${w}px;height:${h * .62}px;overflow:hidden">${J.cajaDibujo(w, h * .62)}</div>` : ""}
   <div style="position:absolute;left:${w * .06}px;right:${w * .06}px;bottom:${h * .07}px;text-align:center;color:#fff;font:900 ${w * (J.titCaja || .11)}px 'Inter Display';letter-spacing:-.03em;line-height:.95;text-shadow:0 4px 12px rgba(0,0,0,.7)">${J.tituloCaja || J.titulo}</div></div>`;
}
function escenaPrecio(lt, k) {
  const J = JUEGO;
  return fondoSuave() + caja(120, 640, 380, -4) +
    `<div style="position:absolute;left:560px;top:760px;font:800 30px 'DejaVu Sans Mono';color:rgba(255,255,255,.8)">HOY · ${J.tiendaNombre.toUpperCase()}</div>
     <div style="position:absolute;left:550px;top:800px;font:900 ${J.precio >= 10 ? 150 : 170}px 'Inter Display';color:${PALETA.acento};letter-spacing:-.05em;text-shadow:0 0 40px ${PALETA.acento}88">${contador(lt, .6, 2.2, J.pvp, J.precio).replace(" €", "€")}</div>
     <div style="position:absolute;left:560px;top:1000px;font:800 36px 'Inter';color:#fff;opacity:${sg(lt, 1.6, 2)}">${J.plat}${J.clave ? " · " + J.clave : ""}</div>`;
}
function escenaDescuento(lt, k, dto) {
  const J = JUEGO;
  return fondoSuave() + caja(330, 560, 420, -3) +
    `<div style="position:absolute;left:0;right:0;top:1180px;text-align:center;font:900 90px 'Inter Display';color:#fff;letter-spacing:-.03em">${fmtE(J.pvp)}€<div style="position:absolute;left:50%;width:420px;margin-left:-210px;top:52%;height:10px;background:#ff4f4f;transform:scaleX(${eo(sg(lt, .4, .8))});transform-origin:0 50%"></div></div>` +
    sello(`-${dto} %`, 120, 1320, sg(lt, 1, 1.4), PALETA.acento);
}

// ---------- piezas de dibujo (genéricas y propias) ----------
const P = {};
P.suelo = (col = "#1a1424", y = 1500) => `<div style="position:absolute;left:0;right:0;top:${y}px;bottom:0;background:${col}"></div>`;
P.carretera = (off = 0, col = "#2b2b33", linea = "#f2c94c") => `<div style="position:absolute;left:0;right:0;top:1480px;height:200px;background:${col}"></div>
  <div style="position:absolute;left:${-((off * 300) % 260)}px;width:1400px;top:1575px;height:12px;background:repeating-linear-gradient(90deg,${linea} 0 130px,transparent 130px 260px)"></div>`;
P.colinas = (col = "#2c1f3d", y = 1200, off = 0) => `<svg style="position:absolute;left:0;top:${y}px" width="1080" height="320" viewBox="0 0 1080 320"><path d="M${-off % 540} 320 ${[...Array(6)].map((_, i) => `Q ${-off % 540 + i * 270 + 135} ${40 + (i % 2) * 70} ${-off % 540 + (i + 1) * 270} 260`).join(" ")} L 1620 320 Z" fill="${col}"/></svg>`;
P.montana = (x, y, w, h, col = "#3a3f5c", nieve = "#f4f6ff") => `<svg style="position:absolute;left:${x - w / 2}px;top:${y - h}px;overflow:visible" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M0 ${h} L${w * .5} 0 L${w} ${h} Z" fill="${col}"/><path d="M${w * .5} 0 L${w * .62} ${h * .26} L${w * .55} ${h * .22} L${w * .5} ${h * .3} L${w * .43} ${h * .22} L${w * .38} ${h * .26} Z" fill="${nieve}"/></svg>`;
P.estrellas = (n = 80) => estrellas(n, 1200);
P.sol = (x, y, r = 110, c = "#ffe08a") => `<div style="position:absolute;left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${c};box-shadow:0 0 90px 30px ${c}66"></div>`;
P.luna = (x, y) => luna(x, y, 1.4);
P.texto = (txt, x, y, k = 1, tam = 64, col = "#fff") => `<div style="position:absolute;left:${x}px;top:${y + (1 - eo(k)) * 30}px;opacity:${cl(k * 2)};font:900 ${tam}px 'Inter Display';color:${col};letter-spacing:-.03em;text-shadow:0 6px 18px rgba(0,0,0,.5)">${txt}</div>`;
P.etiqueta = (txt, x, y, k = 1, fondo = "#fff", col = "#111") => `<div style="position:absolute;left:${x}px;top:${y}px;transform:scale(${eb(cl(k))});transform-origin:0 50%;opacity:${cl(k * 3)}">${etiq(txt, .5, fondo, col)}</div>`;
P.cartel = (txt, x, y, col = "#2a7d3c", tam = 46) => `<div style="position:absolute;left:${x}px;top:${y}px"><div style="padding:14px 24px;background:${col};color:#fff;border:5px solid #fff;border-radius:12px;font:800 ${tam}px 'Inter';white-space:nowrap">${txt}</div><div style="margin-left:40%;width:12px;height:160px;background:#888"></div></div>`;
P.bocadillo = (txt, x, y, k, w = 0) => k <= 0 ? "" : `<div style="position:absolute;left:${x}px;top:${y}px;${w ? `width:${w}px;` : ""}padding:20px 30px;background:#fff;color:#14121c;border-radius:30px;font:800 46px 'Inter';transform:scale(${eb(cl(k))});transform-origin:0 100%;box-shadow:0 14px 30px rgba(0,0,0,.3)">${txt}<i style="position:absolute;left:34px;bottom:-26px;border:16px solid transparent;border-top:20px solid #fff"></i></div>`;
P.flash = (lt, t0, col = "#fff") => lt > t0 && lt < t0 + .12 ? `<div style="position:absolute;inset:0;background:${col};opacity:.55"></div>` : "";
P.particulas = (lt, n, x, y, col = "#ffd36a", v = 600) => { let h = ""; for (let i = 0; i < n; i++) { const a = rnd(i) * Math.PI * 2, s = v * (.4 + rnd(i + 9) * .6), px = x + Math.cos(a) * s * lt, py = y + Math.sin(a) * s * lt + 500 * lt * lt; if (lt <= 0 || lt > 1.6) break; h += `<div style="position:absolute;left:${px}px;top:${py}px;width:16px;height:16px;border-radius:4px;background:${col};opacity:${1 - lt / 1.6};transform:rotate(${lt * 400 + i * 30}deg)"></div>`; } return h; };
P.persona = (x, y, s, cara, piel, ropa, pelo, peinado, extra = "") => `<div style="position:absolute;left:${x - 200 * s}px;top:${y - 400 * s}px;width:${400 * s}px;height:${400 * s}px">${persona(cara, piel, ropa, pelo, peinado, extra)}</div>`;
// Camión de lado (cabina a la derecha) con remolque
P.camion = (x, y, s = 1, col = "#d9433a", rem = "#e9e4da", luces = false, txt = "") => `<svg style="position:absolute;left:${x}px;top:${y - 250 * s}px;overflow:visible" width="${760 * s}" height="${260 * s}" viewBox="0 0 760 260">
  <rect x="0" y="20" width="520" height="170" rx="8" fill="${rem}"/><rect x="0" y="180" width="520" height="16" fill="#555"/>
  ${txt ? `<text x="260" y="122" text-anchor="middle" font-family="Inter Display" font-weight="900" font-size="54" fill="${col}">${txt}</text>` : ""}
  <path d="M540 196 V70 q0 -30 30 -30 h90 q40 0 60 50 l30 70 v36 Z" fill="${col}"/><path d="M640 60 h28 q24 0 38 34 l14 36 h-80 Z" fill="#9fd3ff" opacity=".9"/>
  <rect x="520" y="150" width="40" height="40" fill="#444"/>
  ${[70, 150, 440, 600, 690].map((c) => `<circle cx="${c}" cy="204" r="34" fill="#1d1d22"/><circle cx="${c}" cy="204" r="14" fill="#888"/>`).join("")}
  ${luces ? `<path d="M750 150 l300 -40 v120 Z" fill="#fff6c8" opacity=".35"/><circle cx="748" cy="158" r="10" fill="#fff6c8"/>` : ""}</svg>`;
P.coche = (x, y, s = 1, col = "#2ad4c8", tipo = "", luz = false) => `<svg style="position:absolute;left:${x}px;top:${y - 150 * s}px;overflow:visible" width="${420 * s}" height="${150 * s}" viewBox="0 0 420 150">
  <path d="M20 100 q10 -40 70 -46 l60 -40 h120 l60 40 q70 6 80 46 v24 h-390 Z" fill="${col}"/><path d="M160 22 h100 l46 34 h-190 Z" fill="#14092b" opacity=".7"/>
  ${tipo === "policia" ? `<rect x="185" y="0" width="60" height="16" rx="6" fill="${luz ? "#3a7bff" : "#ff3a4a"}"/><rect x="40" y="80" width="340" height="18" fill="#fff"/>` : ""}
  <circle cx="100" cy="124" r="26" fill="#14092b"/><circle cx="320" cy="124" r="26" fill="#14092b"/><circle cx="398" cy="96" r="8" fill="#ffe17a"/></svg>`;
P.velocidad = (lt, col = "rgba(255,255,255,.5)") => { let h = ""; for (let i = 0; i < 14; i++) { const y = 700 + rnd(i) * 900, x = 1080 - ((lt * 1800 + rnd(i + 3) * 1200) % 1500); h += `<div style="position:absolute;left:${x}px;top:${y}px;width:${120 + rnd(i) * 200}px;height:6px;border-radius:3px;background:${col}"></div>`; } return h; };
P.edificios = (col = "#1d1533", ventanas = "#ffd36a", seed = 1, alto = 1) => { let h = ""; let x = -20; let i = 0; while (x < 1100) { const w = 110 + rnd(seed + i) * 120, hh = (260 + rnd(seed + i * 3) * 520) * alto; h += `<div style="position:absolute;left:${x}px;top:${1500 - hh}px;width:${w}px;height:${hh}px;background:${col}">`; for (let r = 0; r < hh / 60 - 1; r++) for (let c = 0; c < Math.floor(w / 40); c++) if (rnd(seed + i * 7 + r * 13 + c) > .55) h += `<i style="position:absolute;left:${12 + c * 40}px;top:${20 + r * 60}px;width:20px;height:28px;background:${ventanas};opacity:.85"></i>`; h += "</div>"; x += w + 14; i++; } return h; };
P.dragon = (x, y, s = 1, col = "#3b2a4f", fuego = 0, ala = 0) => `<svg style="position:absolute;left:${x - 300 * s}px;top:${y - 220 * s}px;overflow:visible" width="${600 * s}" height="${440 * s}" viewBox="0 0 600 440">
  <path d="M240 200 q-60 ${-150 - ala * 60} -230 ${-170 - ala * 40} q90 70 110 150 q40 -30 120 20 Z" fill="${col}" opacity=".9"/>
  <path d="M120 260 q160 -110 330 -40 q60 26 110 -10 q-30 70 -110 70 q-170 60 -330 -20 Z" fill="${col}"/>
  <path d="M120 260 q-80 30 -120 110 q60 -40 130 -60 Z" fill="${col}"/>
  <path d="M300 210 q60 ${-150 - ala * 60} 240 ${-150 - ala * 40} q-80 60 -100 140 Z" fill="${col}"/>
  <path d="M540 220 l30 -26 l-6 24 Z" fill="#f4e7c8"/><circle cx="520" cy="226" r="7" fill="#ffd36a"/>
  ${fuego > 0 ? `<path d="M575 236 q${120 * fuego} -10 ${260 * fuego} 60 q${-120 * fuego} 0 ${-260 * fuego} -30 Z" fill="#ff8a2a" opacity=".9"/><path d="M575 236 q${90 * fuego} 0 ${180 * fuego} 40 q${-90 * fuego} -6 ${-180 * fuego} -20 Z" fill="#ffe17a"/>` : ""}</svg>`;
P.dino = (x, y, s = 1, col = "#4f8a3c", boca = 0) => `<svg style="position:absolute;left:${x - 260 * s}px;top:${y - 330 * s}px;overflow:visible" width="${520 * s}" height="${340 * s}" viewBox="0 0 520 340">
  <path d="M40 200 q-30 -10 -40 10 q60 10 120 30 Z" fill="${col}"/><ellipse cx="220" cy="200" rx="140" ry="80" fill="${col}"/>
  <path d="M320 170 q40 -100 110 -110 q60 0 70 40 q4 ${30 + boca * 20} -60 ${40 + boca * 10} q-60 40 -90 60 Z" fill="${col}"/>
  <path d="M440 ${110 + boca * 30} q40 0 60 ${-6 + boca * 30}" stroke="#2a4a22" stroke-width="6" fill="none"/><circle cx="455" cy="88" r="8" fill="#14121c"/>
  <rect x="150" y="250" width="34" height="80" rx="10" fill="${col}"/><rect x="250" y="250" width="34" height="80" rx="10" fill="${col}"/>
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M${130 + i * 40} ${132 - Math.sin(i) * 6} l18 -34 l18 34 Z" fill="#2a4a22"/>`).join("")}</svg>`;
P.castillo = (x, y, s = 1, col = "#6b6f80", bandera = "#d9433a") => `<svg style="position:absolute;left:${x}px;top:${y - 420 * s}px" width="${520 * s}" height="${420 * s}" viewBox="0 0 520 420">
  <rect x="60" y="160" width="400" height="260" fill="${col}"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${60 + i * 52}" y="136" width="30" height="30" fill="${col}"/>`).join("")}
  <rect x="0" y="90" width="110" height="330" fill="${col}" opacity=".92"/><rect x="410" y="90" width="110" height="330" fill="${col}" opacity=".92"/>
  <path d="M0 90 l55 -70 l55 70 Z M410 90 l55 -70 l55 70 Z" fill="#3b2a4f"/><rect x="200" y="290" width="120" height="130" rx="60" fill="#2b1d16"/>
  <rect x="462" y="0" width="5" height="40" fill="#333"/><path d="M467 2 h50 l-12 14 l12 14 h-50 Z" fill="${bandera}"/></svg>`;
P.soldado = (x, y, s = 1, col = "#3a6fd8", arma = "lanza") => `<svg style="position:absolute;left:${x - 60 * s}px;top:${y - 220 * s}px;overflow:visible" width="${120 * s}" height="${220 * s}" viewBox="0 0 120 220">
  <circle cx="60" cy="40" r="26" fill="#f0c39a"/><path d="M34 34 q26 -34 52 0 Z" fill="#888"/><rect x="30" y="66" width="60" height="90" rx="14" fill="${col}"/>
  <rect x="36" y="156" width="18" height="60" fill="#3b2a1f"/><rect x="66" y="156" width="18" height="60" fill="#3b2a1f"/>
  ${arma === "lanza" ? `<rect x="96" y="0" width="6" height="200" fill="#8a6a3a"/><path d="M92 0 l7 -24 l7 24 Z" fill="#ccc"/>` : `<rect x="88" y="90" width="50" height="10" fill="#555"/>`}</svg>`;
P.planeta = (x, y, r, c1, c2, anillo = false) => `<div style="position:absolute;left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${c1},${c2} 70%);box-shadow:0 0 60px ${c1}55"></div>${anillo ? `<div style="position:absolute;left:${x - r * 1.7}px;top:${y - r * .35}px;width:${r * 3.4}px;height:${r * .7}px;border-radius:50%;border:${r * .08}px solid ${c1}aa;transform:rotate(-14deg)"></div>` : ""}`;
P.astronauta = (x, y, s = 1, col = "#f2f2f7", visor = "#ffb347", rot = 0) => `<svg style="position:absolute;left:${x - 110 * s}px;top:${y - 260 * s}px;overflow:visible;transform:rotate(${rot}deg)" width="${220 * s}" height="${260 * s}" viewBox="0 0 220 260">
  <rect x="40" y="90" width="140" height="120" rx="40" fill="${col}"/><rect x="20" y="100" width="40" height="90" rx="18" fill="#d8d8e4"/>
  <circle cx="110" cy="70" r="60" fill="${col}"/><rect x="64" y="46" width="92" height="56" rx="26" fill="${visor}"/><rect x="74" y="54" width="30" height="12" rx="6" fill="#fff" opacity=".6"/>
  <rect x="62" y="200" width="36" height="56" rx="14" fill="${col}"/><rect x="122" y="200" width="36" height="56" rx="14" fill="${col}"/></svg>`;
P.nave = (x, y, s = 1, col = "#c9cfe0", fuego = 1) => `<svg style="position:absolute;left:${x - 180 * s}px;top:${y - 90 * s}px;overflow:visible" width="${360 * s}" height="${180 * s}" viewBox="0 0 360 180">
  <path d="M10 90 q${-40 - fuego * 60} -20 ${-80 - fuego * 120} 0 q${40 + fuego * 60} 20 ${80 + fuego * 120} 0 Z" fill="#ff8a2a" opacity="${fuego}"/>
  <path d="M10 60 h220 q100 0 130 30 q-30 30 -130 30 h-220 Z" fill="${col}"/><path d="M250 70 q60 4 80 20 h-80 Z" fill="#6ad1ff"/>
  <path d="M60 60 l60 -50 h40 l-20 50 Z M60 120 l60 50 h40 l-20 -50 Z" fill="#8a93ad"/></svg>`;
P.palmera = (x, h, ang = 0) => `<svg style="position:absolute;left:${x - 160}px;top:${1520 - h - 140}px;overflow:visible" width="320" height="${h + 140}" viewBox="0 0 320 ${h + 140}">
  <path d="M160 ${h + 140} q-30 ${-h / 2} 10 ${-h}" stroke="#4a2e1f" stroke-width="26" fill="none" stroke-linecap="round"/>
  <g transform="translate(170 140) rotate(${ang})">${[-150, -110, -60, -20, 20, 60].map((a, i) => `<path d="M0 0 q${Math.cos(a * Math.PI / 180) * 90} ${Math.sin(a * Math.PI / 180) * 90 - 40} ${Math.cos(a * Math.PI / 180) * 160} ${Math.sin(a * Math.PI / 180) * 160 + 30}" stroke="${i % 2 ? "#1f8f5a" : "#2fb36e"}" stroke-width="22" fill="none" stroke-linecap="round"/>`).join("")}</g></svg>`;
P.mar = (lt, y = 1380, col = "#1f7fb8") => `<div style="position:absolute;left:0;right:0;top:${y}px;height:${1520 - y}px;background:${col}"></div><svg style="position:absolute;left:${-((lt * 80) % 120)}px;top:${y - 14}px" width="1300" height="30"><path d="M0 15 ${[...Array(12)].map((_, i) => `q30 -15 60 0 q30 15 60 0`).join(" ")}" stroke="#bfe8ff" stroke-width="6" fill="none"/></svg>`;
P.arena = (y = 1500, col = "#f2cf8a") => `<div style="position:absolute;left:0;right:0;top:${y}px;bottom:0;background:linear-gradient(180deg,${col},#d9a95e)"></div>`;
P.cactus = (x, h = 260, col = "#3f8f4a") => `<svg style="position:absolute;left:${x - 80}px;top:${1500 - h}px" width="160" height="${h}" viewBox="0 0 160 ${h}"><rect x="58" y="0" width="44" height="${h}" rx="22" fill="${col}"/><path d="M58 ${h * .45} h-30 v-70 a14 14 0 0 1 28 0 v40" fill="${col}"/><path d="M102 ${h * .35} h30 v-60 a14 14 0 0 0 -28 0 v30" fill="${col}"/></svg>`;
P.sombrero = (x, y, s = 1, col = "#6b4423") => `<svg style="position:absolute;left:${x - 110 * s}px;top:${y - 70 * s}px" width="${220 * s}" height="${80 * s}" viewBox="0 0 220 80"><ellipse cx="110" cy="62" rx="108" ry="16" fill="${col}"/><path d="M50 62 q0 -60 60 -60 q60 0 60 60 Z" fill="${col}"/><rect x="52" y="44" width="116" height="10" fill="#2b1a0e"/></svg>`;
P.caballo = (x, y, s = 1, col = "#7a4a2a", paso = 0) => `<svg style="position:absolute;left:${x - 230 * s}px;top:${y - 300 * s}px;overflow:visible" width="${460 * s}" height="${300 * s}" viewBox="0 0 460 300">
  <ellipse cx="220" cy="150" rx="150" ry="62" fill="${col}"/><path d="M340 130 q40 -90 90 -100 q30 0 26 24 l-30 30 q-20 40 -60 80 Z" fill="${col}"/><path d="M350 60 q-20 40 -40 70" stroke="#2b1a0e" stroke-width="18"/>
  <path d="M70 130 q-60 20 -60 90" stroke="#2b1a0e" stroke-width="16" fill="none"/><circle cx="420" cy="50" r="6" fill="#111"/>
  ${[110, 160, 280, 330].map((c, i) => `<rect x="${c}" y="190" width="22" height="100" rx="8" fill="${col}" transform="rotate(${Math.sin(paso + i * 1.6) * 16} ${c + 11} 196)"/>`).join("")}</svg>`;
P.cartas = (x, y, k, colores = ["#e94a63", "#3a7bd5", "#f2c94c"]) => colores.map((c, i) => `<div style="position:absolute;left:${x + i * 150 * eo(k)}px;top:${y - i * 10}px;width:200px;height:280px;border-radius:18px;background:#fbf6ea;border:8px solid ${c};transform:rotate(${(i - 1) * 12 * eo(k)}deg);box-shadow:0 20px 40px rgba(0,0,0,.4)">
  <div style="position:absolute;left:14px;top:10px;font:900 44px 'Inter Display';color:${c}">${[7, 9, "A"][i]}</div><div style="position:absolute;left:50%;top:50%;width:90px;height:90px;margin:-45px;border-radius:50%;background:${c}"></div></div>`).join("");
P.pistola = (x, y, s = 1, col = "#f2c94c", rot = 0) => `<svg style="position:absolute;left:${x}px;top:${y}px;overflow:visible;transform:rotate(${rot}deg)" width="${300 * s}" height="${130 * s}" viewBox="0 0 300 130"><rect x="0" y="20" width="230" height="44" rx="10" fill="${col}"/><rect x="230" y="30" width="70" height="20" rx="6" fill="#555"/><path d="M40 64 h50 l-20 64 h-46 Z" fill="#3b2a1f"/><rect x="110" y="64" width="40" height="40" rx="8" fill="#555"/><rect x="20" y="8" width="90" height="14" rx="6" fill="#ff5a4f"/></svg>`;
P.monolito = (x, y, num, k = 1, col = "#2b2433") => `<div style="position:absolute;left:${x}px;top:${y}px;width:300px;height:700px;background:linear-gradient(180deg,#3a3245,${col});border-radius:20px 20px 0 0;box-shadow:0 0 80px rgba(0,0,0,.5)"><div style="position:absolute;left:0;right:0;top:160px;text-align:center;font:900 220px 'Inter Display';color:#e8d6b0;opacity:${k};text-shadow:0 0 40px #e8d6b0">${num}</div></div>`;
P.mochila = (x, y, n, oscila = 0, col = "#c9b58a") => { let h = ""; for (let i = 0; i < n; i++) h += `<div style="position:absolute;left:${x - 80 + Math.sin(i * .8 + oscila) * i * 3}px;top:${y - (i + 1) * 70}px;width:160px;height:66px;border-radius:8px;background:${i % 2 ? col : "#a89466"};border:4px solid #6b5a3a"></div>`; return h; };
P.nube = (x, y, s = 1, col = "rgba(255,255,255,.85)") => `<svg style="position:absolute;left:${x}px;top:${y}px" width="${260 * s}" height="${110 * s}" viewBox="0 0 260 110"><path d="M30 100 a40 40 0 0 1 20 -70 a55 55 0 0 1 100 -10 a45 45 0 0 1 80 40 a30 30 0 0 1 -10 40 Z" fill="${col}"/></svg>`;
P.lluvia = (lt, col = "rgba(180,200,255,.5)") => { let h = ""; for (let i = 0; i < 60; i++) { const x = rnd(i) * 1080, y = ((lt * 1400 + rnd(i + 4) * 1800) % 1800); h += `<div style="position:absolute;left:${x}px;top:${y}px;width:4px;height:60px;background:${col};transform:rotate(12deg)"></div>`; } return h; };
P.maquina = (x, y, k, col = "#ff5a4f") => `<div style="position:absolute;left:${x}px;top:${y}px;width:380px;height:620px;border-radius:24px;background:${col};box-shadow:0 0 50px ${col}88"><div style="position:absolute;left:30px;right:30px;top:40px;height:300px;background:#14121c;border-radius:14px;border:6px solid #fff"></div><div style="position:absolute;left:40px;right:40px;top:380px;text-align:center;font:900 52px 'Inter Display';color:#fff">ARMAS</div><div style="position:absolute;left:110px;top:470px;width:160px;height:90px;border-radius:12px;background:#14121c"></div></div>`;
P.arbol = (x, h = 300, col = "#2f7a4a") => `<svg style="position:absolute;left:${x - 110}px;top:${1500 - h}px" width="220" height="${h}" viewBox="0 0 220 ${h}"><rect x="96" y="${h * .5}" width="28" height="${h * .5}" fill="#5a3a22"/><circle cx="110" cy="${h * .35}" r="${h * .3}" fill="${col}"/><circle cx="60" cy="${h * .48}" r="${h * .2}" fill="${col}"/><circle cx="160" cy="${h * .48}" r="${h * .2}" fill="${col}"/></svg>`;
P.casita = (x, y, s = 1, col = "#f2c4a6", tejado = "#c94a4a") => `<svg style="position:absolute;left:${x}px;top:${y - 260 * s}px" width="${300 * s}" height="${260 * s}" viewBox="0 0 300 260"><rect x="30" y="110" width="240" height="150" fill="${col}"/><path d="M10 120 L150 10 L290 120 Z" fill="${tejado}"/><rect x="125" y="170" width="50" height="90" rx="6" fill="#6b4423"/><rect x="60" y="150" width="44" height="44" fill="#9fd3ff"/><rect x="196" y="150" width="44" height="44" fill="#9fd3ff"/></svg>`;
P.flor = (x, y, k = 1, col = "#ff7ab6") => `<svg style="position:absolute;left:${x - 30}px;top:${y - 90 * k}px" width="60" height="${90 * k + 10}" viewBox="0 0 60 ${90 * k + 10}"><rect x="27" y="30" width="6" height="${90 * k}" fill="#2f9a5a"/>${k > .5 ? [0, 72, 144, 216, 288].map((a) => `<circle cx="${30 + Math.cos(a * Math.PI / 180) * 14}" cy="${26 + Math.sin(a * Math.PI / 180) * 14}" r="11" fill="${col}"/>`).join("") + `<circle cx="30" cy="26" r="9" fill="#ffe17a"/>` : ""}</svg>`;
P.sombra = (x, y, w = 300) => `<div style="position:absolute;left:${x - w / 2}px;top:${y - 18}px;width:${w}px;height:36px;border-radius:50%;background:rgba(0,0,0,.3)"></div>`;
P.escudo = (x, y, col = "#c9b25a") => `<svg style="position:absolute;left:${x}px;top:${y}px" width="120" height="140" viewBox="0 0 120 140"><path d="M60 0 l60 20 v50 q0 50 -60 70 q-60 -20 -60 -70 v-50 Z" fill="${col}"/><path d="M60 20 l40 14 v34 q0 34 -40 48 q-40 -14 -40 -48 v-34 Z" fill="#8a6a2a"/></svg>`;
P.muro = (x, y, w = 360, h = 160, col = "#6b6f80") => `<div style="position:absolute;left:${x}px;top:${y - h}px;width:${w}px;height:${h}px;background:repeating-linear-gradient(0deg,${col} 0 48px,#4b4f60 48px 52px);border-radius:6px"></div>`;
