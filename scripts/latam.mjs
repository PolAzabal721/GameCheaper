// Catálogo de Latinoamérica (pillaojuegos.com/latam/) → precios-latam.json
// Solo claves digitales válidas en LATAM y precios en dólares. Fuentes:
//   - Kinguin (Admitad): feeds/kinguin-latam.json, lo que no está bloqueado en AR, MX, CL, CO ni PE (precio en euros → dólares)
//   - K4G (CJ): feeds/k4g-latam.json, su catálogo en dólares, solo claves «Latam» o globales
// Las fotos y la popularidad se toman del catálogo de España (precios.json) cuando es el mismo juego.
//   - Tiendas de PC (Steam, GOG, Epic, Fanatical, Humble, GMG…): IsThereAnyDeal con país Argentina (precios en dólares)
//   - Microsoft Store (Xbox): sus precios en México (pesos mexicanos → dólares)
//   - PlayStation Store: sus precios en México (pesos mexicanos → dólares)
//   - Loaded: su catálogo en dólares (feeds/loaded-latam.json), solo claves globales o de Latinoamérica
// Pendiente: Nintendo eShop de México (usa otros números de producto que la de España).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = async (r, d) => { try { return JSON.parse(await readFile(join(RAIZ, r), "utf8")); } catch { return d; } };

const limpiar = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SOBRANTE = /\b(nintendo switch 2 edition|nintendo switch 2|nintendo switch|switch 2|ps4 (y|and) ps5|ps5|ps4|edicion estandar|standard edition|edicion standard)\b/g;
const llave = (t) => limpiar(String(t).replace(/['’`´]/g, "")).replace(SOBRANTE, " ").replace(/\s+/g, " ").trim().replace(/\b([a-z0-9]+) s\b/g, "$1s").replace(/([a-z])(\d)/g, "$1 $2");
const html2txt = (s) => String(s).replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const KIN_RUIDO = /\s*\b(pc|ps4|ps5|playstation( [45])?|xbox( (one|series( x\|s| x s)?|live))?|nintendo( switch( 2)?)?|switch( 2)?|steam|epic games?( store)?|ea app|origin|uplay|ubisoft connect|gog( com)?|battle ?net|rockstar( games)?( digital download)?|microsoft( store)?|windows( 10| 11)?|global|eu|emea|europe|row|us|uk|na|ar|latam|ru\/cis|cis|tr|in|au|asia|br|pl|de|fr|mx|cd key|key|digital download|code|eshop|psn)\b/gi;
const KIN_TIPO = { GAME: "juego", PREORDER: "juego", DLC: "dlc", SOFTWARE: "software", HOSTING: "software", BUSINESS_STORE: "software", GAME_SERVER: "software", CSGO_SKINS: "skins", RANDOM_KEY: "juego",
  PREPAID: "tarjeta", MOBILE_TOPUP: "tarjeta", MOBILE_TOPUP_GC: "tarjeta", CRYPTO_VOUCHERS: "tarjeta", IFRAME_TOP_UP: "tarjeta", BALANCE: "tarjeta", BALANCE_TOPUP: "tarjeta", DISCOUNT_VOUCHERS: "tarjeta" };
const KIN_PLAT = { "Steam": "PC", "GOG.com": "PC", "EA App": "PC", "Epic Games": "PC", "Ubisoft": "PC", "Battle.net": "PC", "Rockstar Games": "PC", "MS Store (PC)": "PC", "PC": "PC", "NCSoft": "PC", "Official Website": "PC",
  "Xbox One": "Xbox Series", "Xbox Series X|S": "Xbox Series", "PlayStation 4": "PS4", "PlayStation 5": "PS5", "PlayStation": "PS5", "Nintendo Switch": "Switch", "Nintendo Switch 2": "Switch 2", "Nintendo": "Switch" };
const K4G_PLAT = [["nintendo-switch-2", "Switch 2", "Nintendo"], ["nintendo-switch", "Switch", "Nintendo"], ["xbox-one-series-x-s-xbox", "Xbox Series", "Xbox"], ["xbox-series-x-s", "Xbox Series", "Xbox"],
  ["xbox-live", "Xbox Series", "Xbox"], ["xbox-one", "Xbox Series", "Xbox"], ["ubisoft-connect", "PC", "Ubisoft Connect"], ["epic-games", "PC", "Epic Games"], ["battle-net", "PC", "Battle.net"],
  ["rockstar-games", "PC", "Rockstar"], ["microsoft-store", "PC", "Microsoft Store"], ["ea-app", "PC", "EA App"], ["origin", "PC", "EA App"], ["uplay", "PC", "Ubisoft Connect"], ["steam", "PC", "Steam"], ["gog", "PC", "GOG"]];
const K4G_RUIDO = /\s+(?:(?:RU\/CIS|CIS|Latam|LATAM|EU|Europe|EMEA|Global|Worldwide|US|ROW)\s+)?(?:Steam|Xbox(?: One)?(?: \/ Series X\|S)?(?: Series X\|S)?|Xbox Live|Nintendo Switch(?: 2)?|EA App|Origin|Uplay|Ubisoft Connect|GOG(?:\.com)?|Epic Games|Battle\.net|Rockstar(?: Games)?|Microsoft Store|Windows(?: 10| 11)?)?\s*(?:CD\s*)?Key$/i;

// Cambios del día del Banco Central Europeo: cuántos dólares vale 1 € y 1 peso mexicano
async function cambios() {
  const c = { EUR: 1.08, MXN: 0.055 };
  try {
    const d = await (await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,MXN")).json();
    if (d.rates?.EUR > 0.5 && d.rates.EUR < 2) c.EUR = 1 / d.rates.EUR;
    if (d.rates?.MXN > 5 && d.rates.MXN < 40) c.MXN = 1 / d.rates.MXN;
  } catch {}
  return c;
}
const ES_PAIS = { Argentina: "Argentina", Mexico: "México", Chile: "Chile", Colombia: "Colombia", Peru: "Perú", Brazil: "Brasil", Uruguay: "Uruguay", Ecuador: "Ecuador", Venezuela: "Venezuela", Bolivia: "Bolivia", Paraguay: "Paraguay", "Costa Rica": "Costa Rica", Panama: "Panamá", Guatemala: "Guatemala", "Dominican Republic": "República Dominicana" };
const mx = (n) => n.toLocaleString("es-MX", { maximumFractionDigits: 0 }) + " MXN";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-MX,es;q=0.9" };
const OFICIALES_PC = /^(steam|gog|epic|microsoft|ea app|ea store|origin|ubisoft|battle\.net|blizzard|rockstar|bethesda|square enix|nintendo)/i;

async function main() {
  const es = await leer("precios.json", { juegos: [] });
  const porLlaveES = new Map(); for (const j of es.juegos) { const k = llave(j.titulo); if (!porLlaveES.has(k)) porLlaveES.set(k, j); }
  const tasas = await cambios(), cambio = tasas.EUR;
  const tiendasL = new Map();
  const tienda = (id, nombre, tipo) => { if (!tiendasL.has(id)) tiendasL.set(id, { id, nombre, tipo, formatos: ["digital"] }); };
  const juegos = new Map();
  const juego = (nombre, tipo) => {
    const k = llave(nombre); if (!k || k.length < 2) return null;
    let j = juegos.get(k);
    if (!j) {
      const e = porLlaveES.get(k);
      j = { id: e ? e.id : k.replace(/ /g, "-").slice(0, 80), titulo: e ? e.titulo : nombre, tipo: e ? e.tipo : tipo || "juego", pop: e ? e.pop : 99999,
        img: e ? e.img : undefined, cov: e ? e.cov : undefined, lanzamiento: e ? e.lanzamiento : undefined, plataformas: new Set(), ofertas: [] };
      juegos.set(k, j);
    }
    return j;
  };
  const ofertar = (j, o) => {
    const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma);
    if (igual && igual.precio <= o.precio) return;
    if (igual) j.ofertas.splice(j.ofertas.indexOf(igual), 1);
    j.ofertas.push(o); j.plataformas.add(o.plataforma);
  };
  const usd = (n) => Math.round(n * cambio * 100) / 100;
  const cuenta = {};

  // Kinguin
  for (const f of await leer("feeds/kinguin-latam.json", [])) {
    const tipo = KIN_TIPO[f.c]; if (!tipo) continue;
    const plataforma = tipo === "tarjeta" ? "Tarjeta regalo" : tipo === "software" || tipo === "skins" ? "PC" : KIN_PLAT[f.p];
    if (!plataforma || !(f.pr > 0)) continue;
    let nombre = html2txt(f.n).replace(/[™®©]/g, "");
    nombre = tipo === "juego" || tipo === "dlc" ? nombre.replace(/\s*\/\s*/g, " ").replace(KIN_RUIDO, " ").replace(/\s+-\s*$/, "").replace(/\s+/g, " ").trim() : nombre.replace(/\s+/g, " ").trim();
    const j = juego(nombre, tipo); if (!j) continue;
    if (!j.img && f.i && tipo !== "tarjeta") j.img = f.i;
    const region = (f.r || "").replace(f.p || "", "").replace(/\s+/g, " ").trim();
    tienda("kinguin", "Kinguin", "revendedor");
    ofertar(j, { tienda: "kinguin", plataforma, formato: "digital", estado: "nuevo", stock: true, precio: usd(f.pr), regular: f.op > f.pr ? usd(f.op) : undefined,
      condicion: (tipo === "tarjeta" ? "Código digital" : `Clave ${f.p || ""}`) + " · " + (f.solo ? "Solo " + ES_PAIS[f.solo] : /region free/i.test(region) || !region ? "Region free" : region), url: f.u });
    cuenta.kinguin = (cuenta.kinguin || 0) + 1;
  }
  // K4G
  for (const f of await leer("feeds/k4g-latam.json", [])) {
    const slug = (f.l.match(/k4g\.com\/product\/([a-z0-9-]+)-[A-F0-9]{8}$/) || [])[1];
    if (!slug || !/-cd-key$/.test(slug) || /\b(account|gift|top-up)\b/.test(slug)) continue;
    let p = null;
    for (const [tok, plat, drm] of K4G_PLAT) {
      const m = slug.match(new RegExp(`-${tok}-(latam|latin-america|global|worldwide|argentina|mexico|brazil|chile|colombia|peru)(?:-|$)`));
      if (m) { p = { plat, drm, region: m[1] }; break; }
    }
    if (!p) continue;
    const nombre = html2txt(f.n).replace(K4G_RUIDO, "").replace(/\s+(Latam|LATAM|Global)\b/g, "").trim();
    const j = juego(nombre); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("k4g", "K4G", "marketplace");
    ofertar(j, { tienda: "k4g", plataforma: p.plat, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: `Clave ${p.drm} · ${/latam|latin/.test(p.region) ? "Latam" : /global|worldwide/.test(p.region) ? "Global" : "Solo " + ({ argentina: "Argentina", mexico: "México", brazil: "Brasil", chile: "Chile", colombia: "Colombia", peru: "Perú" })[p.region]}`, url: f.cu || f.l });
    cuenta.k4g = (cuenta.k4g || 0) + 1;
  }

  // Loaded en dólares
  for (const f of await leer("feeds/loaded-latam.json", [])) {
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("loaded", "Loaded", "revendedor");
    ofertar(j, { tienda: "loaded", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: (f.t === "tarjeta" ? "Código digital" : `Clave ${f.d || f.pl}`) + " · " + (/worldwide/i.test(f.reg) ? "Global" : "Latam"), url: f.u });
    cuenta.loaded = (cuenta.loaded || 0) + 1;
  }

  const populares = es.juegos.filter((j) => j.tipo !== "tarjeta").sort((a, b) => (a.pop || 99999) - (b.pop || 99999));
  // Tiendas de PC por IsThereAnyDeal (país Argentina: precios en dólares)
  const key = (process.env.ITAD_KEY || "").trim();
  if (key) try {
    const pc = populares.filter((j) => (j.plataformas || []).includes("PC")).slice(0, +(process.env.LATAM_ITAD || 4000));
    const ids = {}, json = { "Content-Type": "application/json" };
    for (let i = 0; i < pc.length; i += 200) {
      const trozo = pc.slice(i, i + 200);
      const mapa = await (await fetch(`https://api.isthereanydeal.com/lookup/id/title/v1?key=${encodeURIComponent(key)}`, { method: "POST", headers: json, body: JSON.stringify(trozo.map((j) => j.titulo)) })).json();
      for (const j of trozo) if (mapa[j.titulo]) ids[mapa[j.titulo]] = j;
      await esperar(300);
    }
    const claves = Object.keys(ids);
    for (let i = 0; i < claves.length; i += 200) {
      const lista = await (await fetch(`https://api.isthereanydeal.com/games/prices/v3?key=${encodeURIComponent(key)}&country=AR`, { method: "POST", headers: json, body: JSON.stringify(claves.slice(i, i + 200)) })).json();
      for (const g of lista) {
        const e = ids[g.id]; if (!e) continue;
        for (const x of g.deals || []) {
          if (x.price?.currency !== "USD" || !(x.price.amount > 0)) continue;
          const nombre = x.shop?.name || String(x.shop?.id), id = /^steam$/i.test(nombre) ? "steam" : "itad-" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
          const j = juego(e.titulo, e.tipo); if (!j) continue;
          tienda(id, nombre, OFICIALES_PC.test(nombre) ? "oficial" : "revendedor");
          ofertar(j, { tienda: id, plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: x.price.amount, regular: x.regular?.amount > x.price.amount ? x.regular.amount : undefined, url: x.url || undefined });
          cuenta[id === "steam" ? "steam" : "pc (itad)"] = (cuenta[id === "steam" ? "steam" : "pc (itad)"] || 0) + 1;
        }
      }
      await esperar(300);
    }
  } catch (e) { console.warn("LATAM ITAD: " + e.message); }

  // Microsoft Store (Xbox y PC) en México
  try {
    const xb = new Map();
    for (const e of populares) for (const o of e.ofertas) if (o.tienda === "xbox" && /\/p\/([A-Z0-9]{12})/.test(o.url || "")) { const id = o.url.match(/\/p\/([A-Z0-9]{12})/)[1]; if (!xb.has(id)) xb.set(id, { e, plats: new Set() }); xb.get(id).plats.add(o.plataforma); }
    const lista = [...xb.keys()].slice(0, +(process.env.LATAM_XBOX || 3000));
    for (let i = 0; i < lista.length; i += 20) {
      const d = await (await fetch(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${lista.slice(i, i + 20).join(",")}&market=MX&languages=es-mx`)).json();
      for (const p of d.Products || []) {
        const x = xb.get(p.ProductId); if (!x) continue;
        let mejor = null;
        for (const s of p.DisplaySkuAvailabilities || []) for (const a of s.Availabilities || []) {
          const pr = a.OrderManagementData?.Price;
          if (!pr || pr.CurrencyCode !== "MXN" || !(pr.ListPrice > 0) || !(a.Actions || []).includes("Purchase")) continue;
          if (!mejor || pr.ListPrice < mejor.ListPrice) mejor = pr;
        }
        if (!mejor) continue;
        const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
        tienda("xbox", "Microsoft Store", "oficial");
        for (const plat of x.plats) ofertar(j, { tienda: "xbox", plataforma: plat, formato: "digital", estado: "nuevo", stock: true, precio: Math.round(mejor.ListPrice * tasas.MXN * 100) / 100,
          regular: mejor.MSRP > mejor.ListPrice ? Math.round(mejor.MSRP * tasas.MXN * 100) / 100 : undefined, condicion: `Solo México · ${mx(mejor.ListPrice)} ≈ en dólares`, url: `https://www.xbox.com/es-MX/games/store/p/${p.ProductId}` });
        cuenta.xbox = (cuenta.xbox || 0) + 1;
      }
      await esperar(250);
    }
  } catch (e) { console.warn("LATAM Xbox: " + e.message); }

  // PlayStation Store de México: la misma ficha (concept) que en España, con el precio de México
  try {
    const ps = await leer("data/playstation.json", { juegos: {} });
    const lista = populares.filter((e) => ps.juegos[e.id]?.ids?.length).slice(0, +(process.env.LATAM_PS || 400));
    for (const e of lista) {
      for (const id of [...ps.juegos[e.id].ids].sort((x, y) => /^\d+$/.test(x) - /^\d+$/.test(y))) {
        try {
          const url = `https://store.playstation.com/es-mx/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
          const r = await fetch(url, { headers: CABECERAS }); if (!r.ok) continue;
          const m = (await r.text()).match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/); if (!m) continue;
          const ld = JSON.parse(m[1]), of = [].concat(ld.offers || [])[0];
          if (!of || !(of.price > 0) || !/^(MXN|USD)$/.test(of.priceCurrency)) continue;
          if (llave(ld.name || "") !== llave(e.titulo) && !llave(ld.name || "").startsWith(llave(e.titulo) + " ")) continue;
          if (/\b(ultimate|deluxe|gold|premium|definitive|complete|collector|bundle|upgrade)\b/i.test(ld.name) && !/\b(ultimate|deluxe|gold|premium|definitive|complete|collector|bundle|upgrade)\b/i.test(e.titulo)) continue;
          const j = juego(e.titulo, e.tipo); if (!j) break;
          tienda("psstore", "PlayStation Store", "oficial");
          const usd = of.priceCurrency === "USD" ? of.price : Math.round(of.price * tasas.MXN * 100) / 100;
          ofertar(j, { tienda: "psstore", plataforma: (e.plataformas || []).includes("PS5") ? "PS5" : "PS4", formato: "digital", estado: "nuevo", stock: true, precio: usd,
            condicion: "Solo México" + (of.priceCurrency === "MXN" ? ` · ${mx(of.price)} ≈ en dólares` : ""), url });
          cuenta.psstore = (cuenta.psstore || 0) + 1;
          break;
        } catch {}
        await esperar(500);
      }
      await esperar(500);
    }
  } catch (e) { console.warn("LATAM PlayStation: " + e.message); }

  for (const t of es.tiendas || []) if (tiendasL.has(t.id)) tiendasL.set(t.id, { ...t, busqueda: undefined });
  const tiendas = [...tiendasL.values()];
  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map((j) => ({ ...j, plataformas: [...j.plataformas], minimo: Math.min(...j.ofertas.map((o) => o.precio)) }));
  const salida = { region: "latam", moneda: "USD", cambio, actualizado: new Date().toISOString(), tiendas, juegos: lista };
  await writeFile(join(RAIZ, "precios-latam.json"), JSON.stringify(salida) + "\n");
  console.log(`LATAM: ${lista.length} productos, ${lista.reduce((n, j) => n + j.ofertas.length, 0)} ofertas · ${JSON.stringify(cuenta)} · 1 € = ${cambio.toFixed(3)} US$ · 1 MXN = ${tasas.MXN.toFixed(4)} US$`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
