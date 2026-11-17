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
import { completar } from "./completar.mjs";
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
  // Dólares que vale 1 unidad de cada moneda. Primero open.er-api.com (tiene ARS, CLP, COP, PEN…); si falla, el BCE (frankfurter)
  const c = { USD: 1, EUR: 1.08, MXN: 0.055, BRL: 0.18 };
  try {
    const d = await (await fetch("https://open.er-api.com/v6/latest/USD")).json();
    for (const [k, v] of Object.entries(d.rates || {})) if (v > 0) c[k] = 1 / v;
  } catch {
    try {
      const d = await (await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,MXN,BRL")).json();
      for (const [k, v] of Object.entries(d.rates || {})) if (v > 0) c[k] = 1 / v;
    } catch {}
  }
  return c;
}
const ES_PAIS = { Argentina: "Argentina", Mexico: "México", Chile: "Chile", Colombia: "Colombia", Peru: "Perú", Brazil: "Brasil", Uruguay: "Uruguay", Ecuador: "Ecuador", Venezuela: "Venezuela", Bolivia: "Bolivia", Paraguay: "Paraguay", "Costa Rica": "Costa Rica", Panama: "Panamá", Guatemala: "Guatemala", "Dominican Republic": "República Dominicana" };
const mx = (n) => n.toLocaleString("es-MX", { maximumFractionDigits: 0 }) + " MXN";
// Tiendas oficiales por país: PlayStation (idioma de su web), Microsoft (mercado) y Nintendo (país; Argentina no tiene eShop)
const PAISES = [
  { c: "MX", n: "México", ps: "es-mx", xb: "es-MX", eshop: true },
  { c: "AR", n: "Argentina", ps: "es-ar", xb: "es-AR", eshop: false },
  { c: "BR", n: "Brasil", ps: "pt-br", xb: "pt-BR", eshop: true },
  { c: "CL", n: "Chile", ps: "es-cl", xb: "es-CL", eshop: true },
  { c: "CO", n: "Colombia", ps: "es-co", xb: "es-CO", eshop: true },
  { c: "PE", n: "Perú", ps: "es-pe", xb: "es-PE", eshop: true },
];
const cifra = (n, cur) => n.toLocaleString("es-MX", { maximumFractionDigits: n >= 100 ? 0 : 2 }) + " " + cur;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "es-MX,es;q=0.9" };
const OFICIALES_PC = /^(steam|gog|epic|microsoft|ea app|ea store|origin|ubisoft|battle\.net|blizzard|rockstar|bethesda|square enix|nintendo)/i;

async function main() {
  const es = completar(await leer("precios.json", { juegos: [] }));
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
    // Una clave de un solo país no tapa la que vale en toda Latinoamérica: cada una va por separado
    const solo = (c) => ((c || "").match(/Solo [^·]+/) || [""])[0].trim();
    const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && solo(x.condicion) === solo(o.condicion));
    if (igual && igual.precio <= o.precio) return;
    if (igual) j.ofertas.splice(j.ofertas.indexOf(igual), 1);
    j.ofertas.push(o); j.plataformas.add(o.plataforma);
  };
  const usd = (n) => Math.round(n * cambio * 100) / 100;
  // Precio de la tienda de un país → dólares y la condición «Solo Argentina · 15.000 ARS ≈ en dólares»
  const local = (pais, cur, n) => {
    if (cur === "USD") return { precio: Math.round(n * 100) / 100, cond: "Solo " + pais.n };
    if (!tasas[cur]) return null;
    return { precio: Math.round(n * tasas[cur] * 100) / 100, cond: `Solo ${pais.n} · ${cifra(n, cur)} ≈ en dólares` };
  };
  const cuenta = {};
  const RAPIDO = process.env.LATAM_RAPIDO === "1";

  // Kinguin
  for (const f of await leer("feeds/kinguin-latam.json", [])) {
    const tipo = KIN_TIPO[f.c]; if (!tipo) continue;
    const plataforma = tipo === "tarjeta" ? "Tarjeta regalo" : tipo === "software" || tipo === "skins" ? "PC" : KIN_PLAT[f.p];
    if (!plataforma || !(f.pr > 0)) continue;
    let nombre = html2txt(f.n).replace(/[™®©]/g, "");
    if (tipo === "juego" || tipo === "dlc") nombre = nombre.replace(/\s*\+\s*pre-?order bonus( dlc)?\b/gi, " ").replace(/\s*[-(]?\s*\bpre-?order\b\s*\)?/gi, " ");
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
  // Tiendas de PC por IsThereAnyDeal. Argentina: todas sus tiendas, en dólares (es el precio de la región Latam en dólares de Steam y compañía).
  // México, Brasil, Chile, Colombia y Perú: las tiendas oficiales (Steam, Epic, GOG…), que cobran en la moneda de cada país.
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
    for (const pais of [PAISES[1], PAISES[0], ...PAISES.slice(2)]) {
      const general = pais.c === "AR";
      for (let i = 0; i < claves.length; i += 200) {
        try {
          const lista = await (await fetch(`https://api.isthereanydeal.com/games/prices/v3?key=${encodeURIComponent(key)}&country=${pais.c}`, { method: "POST", headers: json, body: JSON.stringify(claves.slice(i, i + 200)) })).json();
          for (const g of lista) {
            const e = ids[g.id]; if (!e) continue;
            for (const x of g.deals || []) {
              if (!(x.price?.amount > 0)) continue;
              const nombre = x.shop?.name || String(x.shop?.id), id = /^steam$/i.test(nombre) ? "steam" : "itad-" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
              const oficial = OFICIALES_PC.test(nombre);
              if (!general && !oficial) continue;
              let precio, regular, condicion;
              if (general && x.price.currency === "USD") {
                precio = x.price.amount; regular = x.regular?.amount > precio ? x.regular.amount : undefined;
                condicion = oficial ? "Precio de Argentina y Latam en dólares" : undefined;
              } else {
                const l = local(pais, x.price.currency, x.price.amount); if (!l) continue;
                precio = l.precio; condicion = l.cond;
                if (x.regular?.amount > x.price.amount) regular = local(pais, x.regular.currency || x.price.currency, x.regular.amount)?.precio;
              }
              const j = juego(e.titulo, e.tipo); if (!j) continue;
              tienda(id, nombre, oficial ? "oficial" : "revendedor");
              ofertar(j, { tienda: id, plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio, regular, condicion, url: x.url || undefined });
              const kc = (id === "steam" ? "steam" : "pc (itad)") + " " + pais.c; cuenta[kc] = (cuenta[kc] || 0) + 1;
            }
          }
        } catch (e) { console.warn(`LATAM ITAD ${pais.c}: ${e.message}`); }
        await esperar(300);
      }
    }
  } catch (e) { console.warn("LATAM ITAD: " + e.message); }

  // Microsoft Store (Xbox y PC) en cada país: mismo producto que en España, con el precio de ese mercado
  try {
    const xb = new Map();
    for (const e of populares) for (const o of e.ofertas) if (o.tienda === "xbox" && /\/p\/([A-Z0-9]{12})/.test(o.url || "")) { const id = o.url.match(/\/p\/([A-Z0-9]{12})/)[1]; if (!xb.has(id)) xb.set(id, { e, plats: new Set() }); xb.get(id).plats.add(o.plataforma); }
    const lista = [...xb.keys()].slice(0, RAPIDO ? 40 : +(process.env.LATAM_XBOX || 3000));
    for (const pais of PAISES) {
      for (let i = 0; i < lista.length; i += 20) {
        try {
          const d = await (await fetch(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${lista.slice(i, i + 20).join(",")}&market=${pais.c}&languages=${pais.xb.toLowerCase()}`)).json();
          for (const p of d.Products || []) {
            const x = xb.get(p.ProductId); if (!x) continue;
            let mejor = null;
            for (const sk of p.DisplaySkuAvailabilities || []) for (const a of sk.Availabilities || []) {
              const pr = a.OrderManagementData?.Price;
              if (!pr || !(pr.ListPrice > 0) || !(a.Actions || []).includes("Purchase")) continue;
              if (!mejor || pr.ListPrice < mejor.ListPrice) mejor = pr;
            }
            if (!mejor) continue;
            const l = local(pais, mejor.CurrencyCode, mejor.ListPrice); if (!l) continue;
            const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
            tienda("xbox", "Microsoft Store", "oficial");
            for (const plat of x.plats) ofertar(j, { tienda: "xbox", plataforma: plat, formato: "digital", estado: "nuevo", stock: true, precio: l.precio,
              regular: mejor.MSRP > mejor.ListPrice ? local(pais, mejor.CurrencyCode, mejor.MSRP)?.precio : undefined, condicion: l.cond, url: `https://www.xbox.com/${pais.xb}/games/store/p/${p.ProductId}` });
            cuenta["xbox " + pais.c] = (cuenta["xbox " + pais.c] || 0) + 1;
          }
        } catch (e) { if (i === 0) console.warn(`LATAM Xbox ${pais.c}: ${e.message}`); }
        await esperar(250);
      }
    }
  } catch (e) { console.warn("LATAM Xbox: " + e.message); }

  // PlayStation Store de cada país: la misma ficha (concept o producto) que en España, con el precio de ese país
  try {
    const ps = await leer("data/playstation.json", { juegos: {} });
    const conPs = populares.filter((e) => ps.juegos[e.id]?.ids?.length);
    for (const pais of PAISES) {
      const lista = conPs.slice(0, RAPIDO ? 5 : pais.c === "MX" ? +(process.env.LATAM_PS || 400) : +(process.env.LATAM_PS_OTROS || 200));
      for (const e of lista) {
        for (const id of [...ps.juegos[e.id].ids].sort((x, y) => /^\d+$/.test(x) - /^\d+$/.test(y))) {
          try {
            const url = `https://store.playstation.com/${pais.ps}/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
            const r = await fetch(url, { headers: CABECERAS }); if (!r.ok) continue;
            const m = (await r.text()).match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/); if (!m) continue;
            const ld = JSON.parse(m[1]), of = [].concat(ld.offers || [])[0];
            if (!of || !(of.price > 0)) continue;
            if (llave(ld.name || "") !== llave(e.titulo) && !llave(ld.name || "").startsWith(llave(e.titulo) + " ")) continue;
            if (/\b(ultimate|deluxe|gold|premium|definitive|complete|collector|bundle|upgrade)\b/i.test(ld.name) && !/\b(ultimate|deluxe|gold|premium|definitive|complete|collector|bundle|upgrade)\b/i.test(e.titulo)) continue;
            const l = local(pais, of.priceCurrency, +of.price); if (!l) break;
            const j = juego(e.titulo, e.tipo); if (!j) break;
            tienda("psstore", "PlayStation Store", "oficial");
            ofertar(j, { tienda: "psstore", plataforma: (e.plataformas || []).includes("PS5") ? "PS5" : "PS4", formato: "digital", estado: "nuevo", stock: true, precio: l.precio, condicion: l.cond, url });
            cuenta["psstore " + pais.c] = (cuenta["psstore " + pais.c] || 0) + 1;
            break;
          } catch {}
          await esperar(500);
        }
        await esperar(500);
      }
    }
  } catch (e) { console.warn("LATAM PlayStation: " + e.message); }

  // ---------- Fuentes leídas por nosotros (como en España): Instant Gaming, Yuplay, Driffle, Nintendo eShop México y GamersGate ----------
  const cacheL = await leer("data/latam-cache.json", {});
  const guardarCache = () => writeFile(join(RAIZ, "data", "latam-cache.json"), JSON.stringify(cacheL));
  const PAISES_LATAM = { argentina: "Argentina", mexico: "México", brasil: "Brasil", brazil: "Brasil", chile: "Chile", colombia: "Colombia", peru: "Perú" };
  const ofertasES = (id) => { const r = []; for (const e of es.juegos) for (const o of e.ofertas) if (o.tienda === id) r.push({ e, o }); return r; };
  const porPop = (a, b) => (a.e.pop || 99999) - (b.e.pop || 99999);

  // Instant Gaming: sus claves Worldwide valen en LATAM; la ficha, con la moneda en dólares (galleta currency=USD), da el precio en dólares
  try {
    const lista = ofertasES("instantgaming").filter((x) => /worldwide|global/i.test(x.o.condicion || "")).sort(porPop);
    const vistos = new Set(), cola = [];
    for (const x of lista) { const u = (x.o.url || "").split("?")[0]; if (u && !vistos.has(u)) { vistos.add(u); cola.push({ ...x, u }); } }
    let n = 0;
    for (const x of cola.slice(0, RAPIDO ? 20 : +(process.env.LATAM_IG || 500))) {
      try {
        const r = await fetch(x.u, { headers: { ...CABECERAS, Cookie: "currency=USD" } }); if (!r.ok) continue;
        const h = await r.text();
        if (!/itemprop="priceCurrency" content="USD"/.test(h)) continue;
        const m = h.match(/itemprop="price" content="([\d.]+)"/); if (!m || !(+m[1] > 0)) continue;
        const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
        tienda("instantgaming", "Instant Gaming", "revendedor");
        ofertar(j, { tienda: "instantgaming", plataforma: x.o.plataforma, formato: "digital", estado: "nuevo", stock: /schema\.org\/InStock/.test(h), precio: +m[1],
          condicion: (x.o.condicion || "Clave · Worldwide").replace(/Worldwide|Global/i, "Global"), url: x.o.url });
        n++;
      } catch {}
      await esperar(700);
    }
    cuenta.instantgaming = n;
  } catch (e) { console.warn("LATAM Instant Gaming: " + e.message); }

  // Yuplay: su listado sale en dólares; en cada ficha dicen en qué países se activa (se guarda 30 días)
  try {
    const jar = new Map(), cookie = () => [...jar].map(([k, v]) => k + "=" + v).join("; ");
    const ir = async (u, json) => { const r = await fetch("https://www.yuplay.com" + u, { headers: { ...CABECERAS, Cookie: cookie(), ...(json ? { Accept: "application/json" } : {}) }, redirect: "manual" });
      for (const c of r.headers.getSetCookie?.() || []) { const kv = c.split(";")[0], i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } return r; };
    await ir("/"); await ir("/api/currency/usd/");
    const precios = new Map();
    for (let pag = 1, total = 1; pag <= total && pag <= (RAPIDO ? 2 : 800); pag++) {
      const r = await ir(`/api/products/?page=${pag}`, true); if (!r.ok) break;
      const d = await r.json(); total = d.extensions?.pagination?.num_pages || 1;
      for (const p of d.products || []) if (p.currency_code === "USD") precios.set(p.link, { precio: +p.price, normal: +p.base_price });
      await esperar(150);
    }
    const paises = (cacheL.yuplay ||= {});
    let n = 0, fichas = 0;
    for (const x of ofertasES("yuplay").sort(porPop)) {
      const link = (x.o.url || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      const pr = precios.get(link); if (!pr || !(pr.precio > 0)) continue;
      let c = paises[link];
      if (!c || Date.now() - Date.parse(c.f) > 30 * 86400000) {
        if (fichas >= (RAPIDO ? 10 : +(process.env.LATAM_YUPLAY || 400))) continue;
        try { const h = await (await ir(link)).text(); const m = h.match(/data-tooltip_content="Can be activated in ([^"]+)"/); c = paises[link] = { f: new Date().toISOString(), p: m ? ["Argentina", "Mexico", "Brazil", "Chile", "Colombia", "Peru"].filter((k) => m[1].includes(k)) : [] }; } catch { continue; }
        fichas++; await esperar(400);
      }
      if (!c.p.length) continue;
      const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
      const todos = c.p.length >= 5, nombres = c.p.map((k) => ({ Mexico: "México", Brazil: "Brasil", Peru: "Perú" })[k] || k);
      tienda("yuplay", "Yuplay", "revendedor");
      ofertar(j, { tienda: "yuplay", plataforma: x.o.plataforma, formato: "digital", estado: "nuevo", stock: true, precio: pr.precio, regular: pr.normal > pr.precio ? pr.normal : undefined,
        condicion: (x.o.condicion || "Clave").split(" · ")[0] + " · " + (todos ? "Latam" : "Solo " + nombres.join(", ")), url: x.o.url });
      n++;
    }
    cuenta.yuplay = n;
  } catch (e) { console.warn("LATAM Yuplay: " + e.message); }

  // Driffle: las claves globales que ya tenemos de España, más las de Latam y de un país (Argentina, México…) de su mapa; precio con ?currency=USD
  try {
    const dr = (cacheL.driffle ||= { leidos: {}, productos: {} });
    const indice = [...(await (await fetch("https://driffle.com/sitemap.xml", { headers: CABECERAS })).text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).filter((u) => /products-sitemap-\d+\.xml$/.test(u));
    const ronda = indice.sort((a, b) => (dr.leidos[a] || "").localeCompare(dr.leidos[b] || "")).slice(0, RAPIDO ? 2 : +(process.env.LATAM_DRIFFLE_MAPAS || 40));
    for (const sm of ronda) {
      try {
        for (const [, u] of (await (await fetch(sm, { headers: CABECERAS })).text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
          const m = u.match(/driffle\.com\/([a-z0-9-]+)-(latam|argentina|mexico|brazil|chile|colombia|peru)-(pc|xbox-series-xs|xbox-one|nintendo-switch)(?:-([a-z-]+?))?-(digital-key|cd-key|key|digital-code)-p\d+$/);
          if (!m || /account|gift-card|top-up/.test(m[1])) continue;
          const plat = m[3] === "pc" ? "PC" : m[3] === "nintendo-switch" ? "Switch" : "Xbox Series";
          dr.productos[u] = { k: llave(m[1].replace(/-/g, " ").replace(/\bstandard edition\b/, "")), plat, region: m[2] };
        }
        dr.leidos[sm] = new Date().toISOString();
      } catch {}
      await esperar(800);
    }
    const esDr = await leer("data/mercados.json", {});
    const cola = [];
    const enES = new Map(); for (const e of populares) { const k = llave(e.titulo); if (!enES.has(k)) enES.set(k, e); }
    for (const p of Object.values(esDr.driffle?.productos || {})) if (p.region === "global") { const e = enES.get(p.llave); if (e) cola.push({ e, url: p.url, plat: p.plat, region: "global" }); }
    for (const [url, p] of Object.entries(dr.productos)) { const e = enES.get(p.k); if (e) cola.push({ e, url, plat: p.plat, region: p.region }); }
    cola.sort(porPop);
    let n = 0;
    for (const x of cola.slice(0, RAPIDO ? 15 : +(process.env.LATAM_DRIFFLE || 500))) {
      try {
        const h = await (await fetch(x.url + "?currency=USD", { headers: CABECERAS })).text();
        const m = h.match(/"price"\s*:\s*"?([0-9.]+)"?\s*,\s*"priceCurrency"\s*:\s*"USD"/) || h.match(/"priceCurrency"\s*:\s*"USD"\s*,\s*"price"\s*:\s*"?([0-9.]+)/);
        if (!m || !(+m[1] > 0)) continue;
        const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
        tienda("driffle", "Driffle", "marketplace");
        ofertar(j, { tienda: "driffle", plataforma: x.plat, formato: "digital", estado: "nuevo", stock: !/OutOfStock/.test(h.slice(0, 200000)), precio: +m[1],
          condicion: `Clave ${x.plat === "PC" ? "PC" : x.plat === "Switch" ? "Nintendo" : "Xbox"} · ${x.region === "global" ? "Global" : x.region === "latam" ? "Latam" : "Solo " + PAISES_LATAM[x.region]}`, url: x.url });
        n++;
      } catch {}
      await esperar(900);
    }
    cuenta.driffle = n;
  } catch (e) { console.warn("LATAM Driffle: " + e.message); }

  // Nintendo eShop (México, Brasil, Chile, Colombia y Perú): las fichas de la tienda de América (su mapa de EE. UU.), el número de producto (nsuid) de la ficha
  // de México (se guarda) y el precio en pesos de su API de precios, pasado a dólares
  try {
    const ns = (cacheL.eshop ||= {});
    const urls = [...(await (await fetch("https://www.nintendo.com/us/store/sitemap.xml", { headers: CABECERAS })).text()).matchAll(/<loc>\s*([^<\s]+\/store\/products\/([a-z0-9-]+)\/)\s*<\/loc>/g)];
    const sw = new Map(); for (const e of populares) if ((e.plataformas || []).some((p) => p.startsWith("Switch"))) { const k = llave(e.titulo); if (!sw.has(k)) sw.set(k, e); }
    const cand = [];
    for (const [, , slug] of urls) {
      const plat = /-switch-2$/.test(slug) ? "Switch 2" : /-switch$/.test(slug) ? "Switch" : null; if (!plat) continue;
      const e = sw.get(llave(slug.replace(/-(nintendo-switch-2-edition-)?switch(-2)?$/, "").replace(/-/g, " "))); if (e) cand.push({ e, slug, plat });
    }
    cand.sort(porPop);
    let fichas = 0;
    for (const c of cand) {
      if (ns[c.slug] !== undefined || fichas >= (RAPIDO ? 10 : +(process.env.LATAM_ESHOP || 400))) continue;
      try { const h = await (await fetch(`https://www.nintendo.com/es-mx/store/products/${c.slug}/`, { headers: CABECERAS })).text(); const m = h.match(/"product":\{"name":"[^"]*","sku":"[^"]*","nsuid":"(\d+)"/); ns[c.slug] = m ? m[1] : null; } catch {}
      fichas++; await esperar(600);
    }
    const conId = cand.filter((c) => ns[c.slug]);
    let n = 0;
    for (const pais of PAISES.filter((x) => x.eshop)) {
      for (let i = 0; i < conId.length; i += 50) {
        try {
          const lote = conId.slice(i, i + 50);
          const d = await (await fetch(`https://api.ec.nintendo.com/v1/price?country=${pais.c}&lang=es&ids=${lote.map((c) => ns[c.slug]).join(",")}`)).json();
          for (const p of d.prices || []) {
            if (p.sales_status !== "onsale" || !p.regular_price?.currency) continue;
            const c = lote.find((x) => ns[x.slug] === String(p.title_id)); if (!c) continue;
            const cur = p.regular_price.currency, reg = +p.regular_price.raw_value, pr = +(p.discount_price?.raw_value ?? reg);
            const l = local(pais, cur, pr); if (!l) continue;
            if (/switch-2-edition/.test(c.slug) && l.precio < 25) continue;   // el pack de mejora, no el juego
            const j = juego(c.e.titulo, c.e.tipo); if (!j) continue;
            tienda("eshop", "Nintendo eShop", "oficial");
            ofertar(j, { tienda: "eshop", plataforma: c.plat, formato: "digital", estado: "nuevo", stock: true, precio: l.precio,
              regular: reg > pr ? local(pais, cur, reg)?.precio : undefined, condicion: l.cond, url: `https://www.nintendo.com/${pais.ps === "pt-br" ? "pt-br" : pais.ps}/store/products/${c.slug}/` });
            n++; cuenta["eshop " + pais.c] = (cuenta["eshop " + pais.c] || 0) + 1;
          }
        } catch (e) { if (i === 0) console.warn(`LATAM eShop ${pais.c}: ${e.message}`); }
        await esperar(300);
      }
    }

  } catch (e) { console.warn("LATAM eShop: " + e.message); }

  // GamersGate: su feed de América (EE. UU., en dólares); lo baja el flujo de GitHub
  for (const [archivo, brasil] of [["feeds/gamersgate-usa.json", false]]) {
    for (const f of await leer(archivo, [])) {
      const j = juego(html2txt(f.n), f.t === "dlc" ? "dlc" : undefined); if (!j) continue;
      if (!j.img && f.img) j.img = f.img;
      tienda("gamersgate", "GamersGate", "oficial");
      const conv = (n) => brasil ? Math.round(n * tasas.BRL * 100) / 100 : n;
      ofertar(j, { tienda: "gamersgate", plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: conv(f.p), regular: f.r > f.p ? conv(f.r) : undefined,
        condicion: `Clave ${f.d || "PC"}` + (brasil ? ` · Solo Brasil · R$ ${f.p.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ≈ en dólares` : ""), url: f.u });
      cuenta.gamersgate = (cuenta.gamersgate || 0) + 1;
    }
  }
  await guardarCache();
  // Precios de un país absurdamente bajos (tiendas que no han actualizado el precio a la inflación, p. ej. Microsoft en Argentina):
  // fuera los «Solo <país>» por debajo del 30 % de lo que cuesta lo mismo en la misma tienda en los demás países
  let raros = 0;
  for (const j of juegos.values()) {
    const grupos = {};
    for (const o of j.ofertas) (grupos[o.tienda + "|" + o.plataforma] ||= []).push(o);
    for (const g of Object.values(grupos)) {
      if (g.length < 3) continue;
      const v = g.map((o) => o.precio).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)];
      for (const o of g) if (/^Solo /.test(o.condicion || "") && o.precio < med * 0.3) { j.ofertas.splice(j.ofertas.indexOf(o), 1); raros++; }
    }
  }
  if (raros) console.log(`LATAM: ${raros} precios de un país descartados por demasiado bajos`);
  // El mismo precio en dólares en varios países (p. ej. Steam en México, Chile, Colombia y Perú): una sola oferta «Solo México, Chile, Colombia y Perú»
  for (const j of juegos.values()) {
    const grupos = new Map();
    for (const o of j.ofertas) {
      const m = (o.condicion || "").match(/^Solo ([^·]+)$/); if (!m) continue;
      const k = o.tienda + "|" + o.plataforma + "|" + o.precio; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push({ o, pais: m[1].trim() });
    }
    for (const g of grupos.values()) {
      if (g.length < 2) continue;
      const ps = g.map((x) => x.pais);
      g[0].o.condicion = "Solo " + ps.slice(0, -1).join(", ") + " y " + ps[ps.length - 1];
      for (const x of g.slice(1)) j.ofertas.splice(j.ofertas.indexOf(x.o), 1);
    }
  }
  for (const t of es.tiendas || []) if (tiendasL.has(t.id)) tiendasL.set(t.id, { ...t, busqueda: undefined });
  const tiendas = [...tiendasL.values()];
  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map((j) => ({ ...j, plataformas: [...j.plataformas], minimo: Math.min(...j.ofertas.map((o) => o.precio)) }));
  const salida = { region: "latam", moneda: "USD", cambio, actualizado: new Date().toISOString(), tiendas, juegos: lista };
  await writeFile(join(RAIZ, "precios-latam.json"), JSON.stringify(salida) + "\n");
  console.log(`LATAM: ${lista.length} productos, ${lista.reduce((n, j) => n + j.ofertas.length, 0)} ofertas · ${JSON.stringify(cuenta)} · 1 € = ${cambio.toFixed(3)} US$ · 1 MXN = ${tasas.MXN.toFixed(4)} US$ · 1000 ARS = ${((tasas.ARS || 0) * 1000).toFixed(2)} US$`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
