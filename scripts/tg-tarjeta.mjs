// La imagen de cada chollo para Telegram (1280x720): portada, precio, descuento, tienda y la marca de Pillao.
// tarjetaHTML() devuelve una página que Playwright convierte en PNG.
const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function tarjetaHTML({ titulo, plataforma, formato, antes, precio, tienda, logo, arte, minimo, fuentes = "" }) {
  const dto = Math.round((1 - precio / antes) * 100);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fuentes}
*{box-sizing:border-box;margin:0}
html,body{width:1280px;height:720px;overflow:hidden;background:#0b0e1c;color:#eef0fa;font-family:"Figtree",sans-serif}
.fondo{position:absolute;inset:-60px;background:url('${arte}') center/cover;filter:blur(40px) saturate(1.3) brightness(.45)}
.velo{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,14,28,.25),rgba(11,14,28,.85) 62%)}
.todo{position:relative;height:100%;display:grid;grid-template-columns:680px 1fr;gap:48px;align-items:center;padding:0 56px}
.arte{position:relative}
.arte img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:24px;box-shadow:0 30px 70px rgba(0,0,0,.55)}
.cinta{position:absolute;top:-22px;left:-14px;background:#ffd23f;color:#1d1600;font-weight:800;font-size:26px;letter-spacing:.08em;padding:10px 20px;border-radius:12px;transform:rotate(-3deg);box-shadow:0 8px 20px rgba(0,0,0,.35)}
.sello{position:absolute;right:-12px;bottom:-18px;background:#ff4d6d;color:#fff;font-weight:800;font-size:22px;letter-spacing:.06em;padding:10px 16px;border-radius:12px;transform:rotate(4deg);box-shadow:0 8px 20px rgba(0,0,0,.35)}
.datos{display:flex;flex-direction:column;gap:14px}
h1{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:46px;line-height:1.05;letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.plat{display:flex;gap:8px}.plat span{font-size:20px;font-weight:700;padding:4px 12px;border-radius:8px;background:rgba(255,255,255,.12)}
.antes{font-family:"JetBrains Mono",monospace;font-size:34px;color:#a3abc9;text-decoration:line-through;text-decoration-color:#ff4d6d;text-decoration-thickness:4px;margin-top:6px}
.ahora{font-family:"JetBrains Mono",monospace;font-weight:800;font-size:96px;line-height:1;color:#ffd23f;letter-spacing:-.04em}
.fila{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.dto{background:#4fd18b;color:#06301c;font-weight:800;font-size:32px;padding:6px 16px;border-radius:12px}
.ahorro{font-size:24px;font-weight:700;color:#c9cfe6}
.tienda{display:flex;align-items:center;gap:12px;font-size:28px;font-weight:700;margin-top:6px}
.tienda img{width:46px;height:46px;border-radius:12px;background:#fff;padding:4px;object-fit:contain}
.marca{position:absolute;right:40px;bottom:28px;display:flex;align-items:center;gap:8px;font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:30px}
.marca i{font-style:normal;background:#ffd23f;color:#1d1600;font-size:18px;padding:2px 8px 4px;border-radius:6px;transform:rotate(-5deg)}
.marca small{font-family:"Figtree",sans-serif;font-weight:600;font-size:20px;color:#a3abc9;margin-left:6px}
</style></head><body><div class="fondo"></div><div class="velo"></div>
<div class="todo"><div class="arte"><img src="${arte}" alt=""><div class="cinta">🔥 CHOLLO</div>${minimo ? '<div class="sello">MÍNIMO HISTÓRICO</div>' : ""}</div>
<div class="datos"><h1>${esc(titulo)}</h1><div class="plat"><span>${esc(plataforma || "PC")}</span><span>${formato === "fisico" ? "En disco" : "Digital"}</span></div>
<div class="antes">${eur(antes)}</div><div class="ahora">${eur(precio)}</div>
<div class="fila"><span class="dto">−${dto} %</span><span class="ahorro">Ahorras ${eur(antes - precio)}</span></div>
<div class="tienda">${logo ? `<img src="${logo}" alt="">` : ""}<span>en ${esc(tienda)}</span></div></div></div>
<div class="marca">Pillao<i>€</i><small>pillaojuegos.com</small></div></body></html>`;
}
