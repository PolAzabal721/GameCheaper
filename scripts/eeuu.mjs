// Catálogo de Estados Unidos (pillaojuegos.com/us/) → precios-us.json
// Solo claves digitales que valen en EE. UU. (de EE. UU., Norteamérica o globales) y precios en dólares. Fuentes:
//   - Kinguin (Admitad): feeds/kinguin-us.json, lo que no está bloqueado en EE. UU. (precio en euros → dólares)
//   - K4G (CJ): feeds/k4g-latam.json, su catálogo en dólares, solo claves de EE. UU., Norteamérica o globales
//   - G2A: las claves GLOBAL de su catálogo de México (pesos → dólares)
//   - CJS CD Keys: feeds/cjs-us.json (Global, USA, North America; euros → dólares)
//   - GGPick: claves globales y tarjetas en dólares
//   - Loaded: su catálogo en dólares (feeds/loaded-us.json)
//   - Tiendas de PC (Steam, GOG, Epic, Fanatical, Humble, GMG…): IsThereAnyDeal con país Estados Unidos
//   - Microsoft Store, PlayStation Store y Nintendo eShop de EE. UU.
//   - Instant Gaming (claves Worldwide en dólares), Yuplay (las que se activan en EE. UU.), Driffle y GamersGate (feed de EE. UU.)
// Las fotos, los nombres y la popularidad se toman del catálogo de España (precios.json) cuando es el mismo juego.
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
const KIN_RUIDO = /\s*\b(pc|ps4|ps5|playstation( [45])?|xbox( (one|series( x\|s| x s)?|live))?|nintendo( switch( 2)?)?|switch( 2)?|steam|epic games?( store)?|ea app|origin|uplay|ubisoft connect|gog( com)?|battle ?net|rockstar( games)?( digital download)?|microsoft( store)?|windows( 10| 11)?|global|eu|emea|europe|row|us|usa|north america|uk|na|ar|latam|ru\/cis|cis|tr|in|au|asia|br|pl|de|fr|mx|cd key|key|digital download|code|eshop|psn)\b/gi;
const KIN_TIPO = { GAME: "juego", PREORDER: "juego", DLC: "dlc", SOFTWARE: "software", HOSTING: "software", BUSINESS_STORE: "software", GAME_SERVER: "software", CSGO_SKINS: "skins", RANDOM_KEY: "juego",
  PREPAID: "tarjeta", MOBILE_TOPUP: "tarjeta", MOBILE_TOPUP_GC: "tarjeta", CRYPTO_VOUCHERS: "tarjeta", IFRAME_TOP_UP: "tarjeta", BALANCE: "tarjeta", BALANCE_TOPUP: "tarjeta", DISCOUNT_VOUCHERS: "tarjeta" };
const KIN_PLAT = { "Steam": "PC", "GOG.com": "PC", "EA App": "PC", "Epic Games": "PC", "Ubisoft": "PC", "Battle.net": "PC", "Rockstar Games": "PC", "MS Store (PC)": "PC", "PC": "PC", "NCSoft": "PC", "Official Website": "PC",
  "Xbox One": "Xbox Series", "Xbox Series X|S": "Xbox Series", "PlayStation 4": "PS4", "PlayStation 5": "PS5", "PlayStation": "PS5", "Nintendo Switch": "Switch", "Nintendo Switch 2": "Switch 2", "Nintendo": "Switch" };
const K4G_PLAT = [["nintendo-switch-2", "Switch 2", "Nintendo"], ["nintendo-switch", "Switch", "Nintendo"], ["xbox-one-series-x-s-xbox", "Xbox Series", "Xbox"], ["xbox-series-x-s", "Xbox Series", "Xbox"],
  ["xbox-live", "Xbox Series", "Xbox"], ["xbox-one", "Xbox Series", "Xbox"], ["ubisoft-connect", "PC", "Ubisoft Connect"], ["epic-games", "PC", "Epic Games"], ["battle-net", "PC", "Battle.net"],
  ["rockstar-games", "PC", "Rockstar"], ["microsoft-store", "PC", "Microsoft Store"], ["ea-app", "PC", "EA App"], ["origin", "PC", "EA App"], ["uplay", "PC", "Ubisoft Connect"], ["steam", "PC", "Steam"], ["gog", "PC", "GOG"],
  ["psn", "PS5", "PSN"], ["playstation-network", "PS5", "PSN"]];
const K4G_RUIDO = /\s+(?:(?:RU\/CIS|CIS|Latam|LATAM|EU|Europe|EMEA|Global|Worldwide|US|USA|North America|NA|ROW)\s+)?(?:Steam|Xbox(?: One)?(?: \/ Series X\|S)?(?: Series X\|S)?|Xbox Live|Nintendo Switch(?: 2)?|EA App|Origin|Uplay|Ubisoft Connect|GOG(?:\.com)?|Epic Games|Battle\.net|Rockstar(?: Games)?|Microsoft Store|Windows(?: 10| 11)?|PSN|PlayStation Network)?\s*(?:CD\s*)?Key$/i;

async function cambios() {
  // Dólares que vale 1 unidad de cada moneda. Primero open.er-api.com; si falla, el BCE (frankfurter)
  const c = { USD: 1, EUR: 1.08, MXN: 0.055 };
  try {
    const d = await (await fetch("https://open.er-api.com/v6/latest/USD")).json();
    for (const [k, v] of Object.entries(d.rates || {})) if (v > 0) c[k] = 1 / v;
  } catch {
    try {
      const d = await (await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,MXN")).json();
      for (const [k, v] of Object.entries(d.rates || {})) if (v > 0) c[k] = 1 / v;
    } catch {}
  }
  return c;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": "en-US,en;q=0.9" };
const OFICIALES_PC = /^(steam|gog|epic|microsoft|ea app|ea store|origin|ubisoft|battle\.net|blizzard|rockstar|bethesda|square enix|nintendo)/i;
// Región de la clave, en palabras de la web: «Global», «EE. UU.» o «Norteamérica»
const zonaUS = (txt) => /north ?america|\bna\b|americas|canada/i.test(txt || "") ? "Norteamérica" : /\b(us|usa|united states)\b/i.test(txt || "") ? "EE. UU." : "Global";

async function main() {
  const es = completar(await leer("precios.json", { juegos: [] }));
  const porLlaveES = new Map(); for (const j of es.juegos) { const k = llave(j.titulo); if (!porLlaveES.has(k)) porLlaveES.set(k, j); }
  const tasas = await cambios(), cambio = tasas.EUR;
  const tiendasU = new Map();
  const tienda = (id, nombre, tipo) => { if (!tiendasU.has(id)) tiendasU.set(id, { id, nombre, tipo, formatos: ["digital"] }); };
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
    // Una por tienda, plataforma y región de la clave (la global y la de EE. UU. van por separado)
    const zona = (c) => ((c || "").match(/Global|EE\. UU\.|Norteamérica/) || [""])[0];
    const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && zona(x.condicion) === zona(o.condicion));
    if (igual && igual.precio <= o.precio) return;
    if (igual) j.ofertas.splice(j.ofertas.indexOf(igual), 1);
    j.ofertas.push(o); j.plataformas.add(o.plataforma);
  };
  const usd = (n) => Math.round(n * cambio * 100) / 100;
  const cuenta = {}, suma = (k) => { cuenta[k] = (cuenta[k] || 0) + 1; };
  const RAPIDO = process.env.EEUU_RAPIDO === "1";
  const FIN = Date.now() + +(process.env.EEUU_MIN || 40) * 60000;
  let FIN_SEC = FIN;
  const seccion = (min) => { FIN_SEC = Math.min(FIN, Date.now() + min * 60000); };
  const queda = () => Date.now() < FIN_SEC;

  // Kinguin
  for (const f of await leer("feeds/kinguin-us.json", [])) {
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
      condicion: (tipo === "tarjeta" ? "Código digital" : `Clave ${f.p || ""}`) + " · " + (/region free/i.test(region) || !region ? "Global" : /\b(us|usa|united states|north america|na)\b/i.test(region) ? zonaUS(region) : region), url: f.u });
    suma("kinguin");
  }
  // K4G (catálogo en dólares)
  for (const f of await leer("feeds/k4g-latam.json", [])) {
    const slug = (f.l.match(/k4g\.com\/product\/([a-z0-9-]+)-[A-F0-9]{8}$/) || [])[1];
    if (!slug || !/-cd-key$/.test(slug) || /\b(account|gift|top-up)\b/.test(slug)) continue;
    let p = null;
    for (const [tok, plat, drm] of K4G_PLAT) {
      const m = slug.match(new RegExp(`-${tok}-(us|usa|united-states|north-america|na|global|worldwide)(?:-|$)`));
      if (m) { p = { plat, drm, region: m[1] }; break; }
    }
    if (!p) continue;
    const nombre = html2txt(f.n).replace(K4G_RUIDO, "").replace(/\s+(US|USA|NA|North America|Global)\b/g, "").trim();
    const j = juego(nombre); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("k4g", "K4G", "marketplace");
    ofertar(j, { tienda: "k4g", plataforma: p.plat, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: `Clave ${p.drm} · ${/global|worldwide/.test(p.region) ? "Global" : /north|^na$/.test(p.region) ? "Norteamérica" : "EE. UU."}`, url: f.cu || f.l });
    suma("k4g");
  }
  // G2A: solo las claves GLOBAL de su catálogo de México (en pesos, pasado a dólares)
  for (const f of await leer("feeds/g2a-latam.json", [])) {
    if (f.reg !== "GLOBAL") continue;
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("g2a", "G2A", "marketplace");
    const pr = Math.round(f.p * tasas.MXN * 100) / 100, re = f.r > f.p ? Math.round(f.r * tasas.MXN * 100) / 100 : undefined;
    ofertar(j, { tienda: "g2a", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: pr, regular: re, condicion: `Clave ${f.d || f.pl} · Global`, url: f.u });
    suma("g2a");
  }
  // CJS CD Keys: Global, USA y North America, en euros → dólares
  for (const f of await leer("feeds/cjs-us.json", [])) {
    let nombre = html2txt(f.n).replace(/[™®©]/g, "");
    if (f.t !== "tarjeta" && f.t !== "software") nombre = nombre.replace(/\s*\+\s*pre-?order bonus( dlc)?\b/gi, " ").replace(/\s*[-(]?\s*\bpre-?order\b\s*\)?/gi, " ").replace(/\s*\/\s*/g, " ").replace(KIN_RUIDO, " ").replace(/\s+-\s*$/, "");
    nombre = nombre.replace(/\s+/g, " ").trim(); if (nombre.length < 2) continue;
    const j = juego(nombre, f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("cjs", "CJS CD Keys", "revendedor");
    ofertar(j, { tienda: "cjs", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: usd(f.p),
      condicion: (f.t === "tarjeta" ? "Código digital" : `Clave ${f.d || f.pl}`) + " · " + zonaUS(f.reg === "Global" ? "" : f.reg) + (/pre-?order bonus/i.test(f.n) ? " · Con DLC de reserva" : ""), url: f.u });
    suma("cjs");
  }
  // GGPick: ya en dólares; claves globales y tarjetas globales o en dólares
  for (const f of await leer("feeds/ggpick.json", [])) {
    if (f.t === "tarjeta" && !/^(GLOBAL|USD|US)$/.test(f.reg)) continue;
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("ggpick", "GGPick", "revendedor");
    ofertar(j, { tienda: "ggpick", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p,
      condicion: f.t === "tarjeta" ? f.d + (f.reg === "GLOBAL" ? "" : " · EE. UU.") : `Clave ${f.d} · Global`, url: f.u });
    suma("ggpick");
  }
  // Loaded en dólares
  for (const f of await leer("feeds/loaded-us.json", [])) {
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("loaded", "Loaded", "revendedor");
    ofertar(j, { tienda: "loaded", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: (f.t === "tarjeta" ? "Código digital" : `Clave ${f.d || f.pl}`) + " · " + (/worldwide|global/i.test(f.reg) || !f.reg ? "Global" : zonaUS(f.reg)), url: f.u });
    suma("loaded");
  }
  // GamersGate: su feed de EE. UU. (en dólares)
  for (const f of await leer("feeds/gamersgate-usa.json", [])) {
    const j = juego(html2txt(f.n), f.t === "dlc" ? "dlc" : undefined); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("gamersgate", "GamersGate", "oficial");
    ofertar(j, { tienda: "gamersgate", plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined, condicion: `Clave ${f.d || "PC"}`, url: f.u });
    suma("gamersgate");
  }

  const populares = es.juegos.filter((j) => j.tipo !== "tarjeta").sort((a, b) => (a.pop || 99999) - (b.pop || 99999));
  seccion(7);
  // Tiendas de PC por IsThereAnyDeal, país Estados Unidos: todas sus tiendas, en dólares
  const key = (process.env.ITAD_KEY || "").trim();
  if (key) try {
    const pc = populares.filter((j) => (j.plataformas || []).includes("PC")).slice(0, +(process.env.EEUU_ITAD || 5000));
    const ids = {}, json = { "Content-Type": "application/json" };
    for (let i = 0; i < pc.length; i += 200) { if (!queda()) break;
      const trozo = pc.slice(i, i + 200);
      const mapa = await (await fetch(`https://api.isthereanydeal.com/lookup/id/title/v1?key=${encodeURIComponent(key)}`, { method: "POST", headers: json, body: JSON.stringify(trozo.map((j) => j.titulo)) })).json();
      for (const j of trozo) if (mapa[j.titulo]) ids[mapa[j.titulo]] = j;
      await esperar(300);
    }
    const claves = Object.keys(ids);
    for (let i = 0; i < claves.length; i += 200) { if (!queda()) break;
      try {
        const lista = await (await fetch(`https://api.isthereanydeal.com/games/prices/v3?key=${encodeURIComponent(key)}&country=US`, { method: "POST", headers: json, body: JSON.stringify(claves.slice(i, i + 200)) })).json();
        for (const g of lista) {
          const e = ids[g.id]; if (!e) continue;
          for (const x of g.deals || []) {
            if (!(x.price?.amount > 0) || x.price.currency !== "USD") continue;
            const nombre = x.shop?.name || String(x.shop?.id), id0 = /^steam$/i.test(nombre) ? "steam" : "itad-" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
            const id = { "itad-microsoftstore": "xbox", "itad-gamersgate": "gamersgate" }[id0] || id0;
            const oficial = OFICIALES_PC.test(nombre);
            const j = juego(e.titulo, e.tipo); if (!j) continue;
            tienda(id, nombre, oficial ? "oficial" : "revendedor");
            ofertar(j, { tienda: id, plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: x.price.amount,
              regular: x.regular?.amount > x.price.amount ? x.regular.amount : undefined, condicion: oficial ? undefined : "Clave PC · Global", url: x.url || undefined });
            suma(id === "steam" ? "steam" : "pc (itad)");
          }
        }
      } catch (e) { console.warn(`EE. UU. ITAD: ${e.message}`); }
      await esperar(300);
    }
  } catch (e) { console.warn("EE. UU. ITAD: " + e.message); }

  seccion(5);
  // Microsoft Store (Xbox y PC) de EE. UU.: el mismo producto que en España, con el precio de allí
  try {
    const xb = new Map();
    for (const e of populares) for (const o of e.ofertas) if (o.tienda === "xbox" && /\/p\/([A-Z0-9]{12})/.test(o.url || "")) { const id = o.url.match(/\/p\/([A-Z0-9]{12})/)[1]; if (!xb.has(id)) xb.set(id, { e, plats: new Set() }); xb.get(id).plats.add(o.plataforma); }
    const lista = [...xb.keys()].slice(0, RAPIDO ? 40 : +(process.env.EEUU_XBOX || 4000));
    for (let i = 0; i < lista.length; i += 20) { if (!queda()) break;
      try {
        const d = await (await fetch(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${lista.slice(i, i + 20).join(",")}&market=US&languages=en-us`)).json();
        for (const p of d.Products || []) {
          const x = xb.get(p.ProductId); if (!x) continue;
          let mejor = null;
          for (const sk of p.DisplaySkuAvailabilities || []) for (const a of sk.Availabilities || []) {
            const pr = a.OrderManagementData?.Price;
            if (!pr || !(pr.ListPrice > 0) || pr.CurrencyCode !== "USD" || !(a.Actions || []).includes("Purchase")) continue;
            if (!mejor || pr.ListPrice < mejor.ListPrice) mejor = pr;
          }
          if (!mejor) continue;
          const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
          tienda("xbox", "Microsoft Store", "oficial");
          for (const plat of x.plats) ofertar(j, { tienda: "xbox", plataforma: plat, formato: "digital", estado: "nuevo", stock: true, precio: mejor.ListPrice,
            regular: mejor.MSRP > mejor.ListPrice ? mejor.MSRP : undefined, url: `https://www.xbox.com/en-US/games/store/p/${p.ProductId}` });
          suma("xbox");
        }
      } catch (e) { if (i === 0) console.warn(`EE. UU. Xbox: ${e.message}`); }
      await esperar(250);
    }
  } catch (e) { console.warn("EE. UU. Xbox: " + e.message); }

  seccion(9);
  // PlayStation Store de EE. UU.: la misma ficha (concept o producto) que en España
  try {
    const ps = await leer("data/playstation.json", { juegos: {} });
    const conPs = populares.filter((e) => ps.juegos[e.id]?.ids?.length).slice(0, RAPIDO ? 5 : +(process.env.EEUU_PS || 500));
    for (const e of conPs) { if (!queda()) break;
      for (const id of [...ps.juegos[e.id].ids].sort((x, y) => /^\d+$/.test(x) - /^\d+$/.test(y))) {
        try {
          const url = `https://store.playstation.com/en-us/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
          const r = await fetch(url, { headers: CABECERAS }); if (!r.ok) continue;
          const m = (await r.text()).match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/); if (!m) continue;
          const ld = JSON.parse(m[1]), of = [].concat(ld.offers || [])[0];
          if (!of || !(of.price > 0) || of.priceCurrency !== "USD") continue;
          if (llave(ld.name || "") !== llave(e.titulo) && !llave(ld.name || "").startsWith(llave(e.titulo) + " ")) continue;
          if (/\b(ultimate|deluxe|gold|premium|definitive|complete|collector|bundle|upgrade)\b/i.test(ld.name) && !/\b(ultimate|deluxe|gold|premium|definitive|complete|collector|bundle|upgrade)\b/i.test(e.titulo)) continue;
          const j = juego(e.titulo, e.tipo); if (!j) break;
          tienda("psstore", "PlayStation Store", "oficial");
          ofertar(j, { tienda: "psstore", plataforma: (e.plataformas || []).includes("PS5") ? "PS5" : "PS4", formato: "digital", estado: "nuevo", stock: true, precio: +of.price, url });
          suma("psstore");
          break;
        } catch {}
        await esperar(500);
      }
      await esperar(500);
    }
  } catch (e) { console.warn("EE. UU. PlayStation: " + e.message); }

  const cacheU = await leer("data/eeuu-cache.json", {});
  const guardarCache = () => writeFile(join(RAIZ, "data", "eeuu-cache.json"), JSON.stringify(cacheU));
  const ofertasES = (id) => { const r = []; for (const e of es.juegos) for (const o of e.ofertas) if (o.tienda === id) r.push({ e, o }); return r; };
  const porPop = (a, b) => (a.e.pop || 99999) - (b.e.pop || 99999);

  seccion(5);
  // Instant Gaming: sus claves Worldwide valen en EE. UU.; la ficha con la galleta currency=USD da el precio en dólares
  try {
    const lista = ofertasES("instantgaming").filter((x) => /worldwide|global/i.test(x.o.condicion || "")).sort(porPop);
    const vistos = new Set(), cola = [];
    for (const x of lista) { const u = (x.o.url || "").split("?")[0]; if (u && !vistos.has(u)) { vistos.add(u); cola.push({ ...x, u }); } }
    let n = 0;
    for (const x of cola.slice(0, RAPIDO ? 20 : +(process.env.EEUU_IG || 400))) { if (!queda()) break;
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
  } catch (e) { console.warn("EE. UU. Instant Gaming: " + e.message); }

  seccion(5);
  // Yuplay: listado en dólares; en cada ficha dicen en qué países se activa (se guarda 30 días)
  try {
    const jar = new Map(), cookie = () => [...jar].map(([k, v]) => k + "=" + v).join("; ");
    const ir = async (u, json) => { const r = await fetch("https://www.yuplay.com" + u, { headers: { ...CABECERAS, Cookie: cookie(), ...(json ? { Accept: "application/json" } : {}) }, redirect: "manual" });
      for (const c of r.headers.getSetCookie?.() || []) { const kv = c.split(";")[0], i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } return r; };
    await ir("/"); await ir("/api/currency/usd/");
    const precios = new Map();
    for (let pag = 1, total = 1; pag <= total && pag <= (RAPIDO ? 2 : 800); pag++) { if (!queda()) break;
      const r = await ir(`/api/products/?page=${pag}`, true); if (!r.ok) break;
      const d = await r.json(); total = d.extensions?.pagination?.num_pages || 1;
      for (const p of d.products || []) if (p.currency_code === "USD") precios.set(p.link, { precio: +p.price, normal: +p.base_price });
      await esperar(150);
    }
    const paises = (cacheU.yuplay ||= {});
    let n = 0, fichas = 0;
    for (const x of ofertasES("yuplay").sort(porPop)) { if (!queda()) break;
      const link = (x.o.url || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      const pr = precios.get(link); if (!pr || !(pr.precio > 0)) continue;
      let c = paises[link];
      if (!c || Date.now() - Date.parse(c.f) > 30 * 86400000) {
        if (fichas >= (RAPIDO ? 10 : +(process.env.EEUU_YUPLAY || 400))) continue;
        try { const h = await (await ir(link)).text(); const m = h.match(/data-tooltip_content="Can be activated in ([^"]+)"/); c = paises[link] = { f: new Date().toISOString(), us: !!(m && /United States|USA/.test(m[1])) }; } catch { continue; }
        fichas++; await esperar(400);
      }
      if (!c.us) continue;
      const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
      tienda("yuplay", "Yuplay", "revendedor");
      ofertar(j, { tienda: "yuplay", plataforma: x.o.plataforma, formato: "digital", estado: "nuevo", stock: true, precio: pr.precio, regular: pr.normal > pr.precio ? pr.normal : undefined,
        condicion: (x.o.condicion || "Clave").split(" · ")[0] + " · EE. UU.", url: x.o.url });
      n++;
    }
    cuenta.yuplay = n;
  } catch (e) { console.warn("EE. UU. Yuplay: " + e.message); }

  seccion(6);
  // Driffle: las claves globales que ya tenemos de España, más las de EE. UU. y Norteamérica de su mapa; precio con ?currency=USD
  try {
    const dr = (cacheU.driffle ||= { leidos: {}, productos: {} });
    const indice = [...(await (await fetch("https://driffle.com/sitemap.xml", { headers: CABECERAS })).text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).filter((u) => /products-sitemap-\d+\.xml$/.test(u));
    const ronda = indice.sort((a, b) => (dr.leidos[a] || "").localeCompare(dr.leidos[b] || "")).slice(0, RAPIDO ? 2 : +(process.env.EEUU_DRIFFLE_MAPAS || 40));
    for (const sm of ronda) { if (!queda()) break;
      try {
        for (const [, u] of (await (await fetch(sm, { headers: CABECERAS })).text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
          const m = u.match(/driffle\.com\/([a-z0-9-]+)-(united-states|usa|us|north-america|na)-(pc|xbox-series-xs|xbox-one|nintendo-switch|psn|playstation-5|playstation-4)(?:-([a-z-]+?))?-(digital-key|cd-key|key|digital-code)-p\d+$/);
          if (!m || /account|gift-card|top-up/.test(m[1])) continue;
          const plat = m[3] === "pc" ? "PC" : m[3] === "nintendo-switch" ? "Switch" : /psn|playstation-5/.test(m[3]) ? "PS5" : m[3] === "playstation-4" ? "PS4" : "Xbox Series";
          dr.productos[u] = { k: llave(m[1].replace(/-/g, " ").replace(/\bstandard edition\b/, "")), plat, region: /north|^na$/.test(m[2]) ? "Norteamérica" : "EE. UU." };
        }
        dr.leidos[sm] = new Date().toISOString();
      } catch {}
      await esperar(800);
    }
    const esDr = await leer("data/mercados.json", {});
    const cola = [];
    const enES = new Map(); for (const e of populares) { const k = llave(e.titulo); if (!enES.has(k)) enES.set(k, e); }
    for (const p of Object.values(esDr.driffle?.productos || {})) if (p.region === "global") { const e = enES.get(p.llave); if (e) cola.push({ e, url: p.url, plat: p.plat, region: "Global" }); }
    for (const [url, p] of Object.entries(dr.productos)) { const e = enES.get(p.k); if (e) cola.push({ e, url, plat: p.plat, region: p.region }); }
    cola.sort(porPop);
    let n = 0;
    for (const x of cola.slice(0, RAPIDO ? 15 : +(process.env.EEUU_DRIFFLE || 400))) { if (!queda()) break;
      try {
        const h = await (await fetch(x.url + "?currency=USD", { headers: CABECERAS })).text();
        const m = h.match(/"price"\s*:\s*"?([0-9.]+)"?\s*,\s*"priceCurrency"\s*:\s*"USD"/) || h.match(/"priceCurrency"\s*:\s*"USD"\s*,\s*"price"\s*:\s*"?([0-9.]+)/);
        if (!m || !(+m[1] > 0)) continue;
        const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
        tienda("driffle", "Driffle", "marketplace");
        ofertar(j, { tienda: "driffle", plataforma: x.plat, formato: "digital", estado: "nuevo", stock: !/OutOfStock/.test(h.slice(0, 200000)), precio: +m[1],
          condicion: `Clave ${x.plat === "PC" ? "PC" : x.plat.startsWith("Switch") ? "Nintendo" : x.plat.startsWith("PS") ? "PSN" : "Xbox"} · ${x.region}`, url: x.url });
        n++;
      } catch {}
      await esperar(900);
    }
    cuenta.driffle = n;
  } catch (e) { console.warn("EE. UU. Driffle: " + e.message); }

  seccion(6);
  // Nintendo eShop de EE. UU.: fichas de su mapa, el número de producto (nsuid) de la ficha (se guarda) y el precio de su API de precios
  try {
    const ns = (cacheU.eshop ||= {});
    const urls = [...(await (await fetch("https://www.nintendo.com/us/store/sitemap.xml", { headers: CABECERAS })).text()).matchAll(/<loc>\s*([^<\s]+\/store\/products\/([a-z0-9-]+)\/)\s*<\/loc>/g)];
    const sw = new Map(); for (const e of populares) if ((e.plataformas || []).some((p) => p.startsWith("Switch"))) { const k = llave(e.titulo); if (!sw.has(k)) sw.set(k, e); }
    const cand = [];
    for (const [, , slug] of urls) {
      const plat = /-switch-2$/.test(slug) ? "Switch 2" : /-switch$/.test(slug) ? "Switch" : null; if (!plat) continue;
      const e = sw.get(llave(slug.replace(/-(nintendo-switch-2-edition-)?switch(-2)?$/, "").replace(/-/g, " "))); if (e) cand.push({ e, slug, plat });
    }
    cand.sort(porPop);
    let fichas = 0;
    for (const c of cand) { if (!queda()) break;
      if (ns[c.slug] !== undefined || fichas >= (RAPIDO ? 10 : +(process.env.EEUU_ESHOP || 400))) continue;
      try { const h = await (await fetch(`https://www.nintendo.com/us/store/products/${c.slug}/`, { headers: CABECERAS })).text(); const m = h.match(/"product":\{"name":"[^"]*","sku":"[^"]*","nsuid":"(\d+)"/) || h.match(/"nsuid":"(\d{14})"/); ns[c.slug] = m ? m[1] : null; } catch {}
      fichas++; await esperar(600);
    }
    const conId = cand.filter((c) => ns[c.slug]);
    for (let i = 0; i < conId.length; i += 50) { if (!queda()) break;
      try {
        const lote = conId.slice(i, i + 50);
        const d = await (await fetch(`https://api.ec.nintendo.com/v1/price?country=US&lang=en&ids=${lote.map((c) => ns[c.slug]).join(",")}`)).json();
        for (const p of d.prices || []) {
          if (p.sales_status !== "onsale" || p.regular_price?.currency !== "USD") continue;
          const c = lote.find((x) => ns[x.slug] === String(p.title_id)); if (!c) continue;
          const reg = +p.regular_price.raw_value, pr = +(p.discount_price?.raw_value ?? reg);
          if (/switch-2-edition/.test(c.slug) && pr < 25) continue;   // el pack de mejora, no el juego
          const j = juego(c.e.titulo, c.e.tipo); if (!j) continue;
          tienda("eshop", "Nintendo eShop", "oficial");
          ofertar(j, { tienda: "eshop", plataforma: c.plat, formato: "digital", estado: "nuevo", stock: true, precio: pr, regular: reg > pr ? reg : undefined, url: `https://www.nintendo.com/us/store/products/${c.slug}/` });
          suma("eshop");
        }
      } catch (e) { if (i === 0) console.warn(`EE. UU. eShop: ${e.message}`); }
      await esperar(300);
    }
  } catch (e) { console.warn("EE. UU. eShop: " + e.message); }
  await guardarCache();

  for (const t of es.tiendas || []) if (tiendasU.has(t.id)) tiendasU.set(t.id, { ...t, busqueda: undefined });
  const tiendas = [...tiendasU.values()];
  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map((j) => ({ ...j, plataformas: [...j.plataformas], minimo: Math.min(...j.ofertas.map((o) => o.precio)) }));
  const salida = { region: "us", moneda: "USD", cambio, actualizado: new Date().toISOString(), tiendas, juegos: lista };
  await writeFile(join(RAIZ, "precios-us.json"), JSON.stringify(salida) + "\n");
  console.log(`EE. UU.: ${lista.length} productos, ${lista.reduce((n, j) => n + j.ofertas.length, 0)} ofertas · ${JSON.stringify(cuenta)} · 1 € = ${cambio.toFixed(3)} US$`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
