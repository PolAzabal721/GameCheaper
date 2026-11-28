// Catálogo de un país de Europa que usa el mismo modelo que Francia (scripts/francia.mjs): Portugal, Italia o Bélgica.
// Uso: PAIS=pt|it|be node scripts/europa.mjs → precios-<pais>.json. Precios en euros y solo digital.
// De los catálogos de claves se usan las globales y las de Europa (las que son solo de otro país se descartan); GamersGate con su
// feed del país; tiendas de PC por IsThereAnyDeal (país del mercado), Microsoft Store, PlayStation Store y Nintendo eShop del país.
import { completar, guardarPartes } from "./completar.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PAISES = {
  pt: { id: "pt", nombre: "Portugal", iso: "PT", re: /portugal|\bpt\b/i, cjs: "Portugal", loc: "pt-pt", locU: "pt-PT", lang: "pt", gg: "PRT", al: "pt-PT,pt;q=0.9,en;q=0.8" },
  it: { id: "it", nombre: "Italia", iso: "IT", re: /ital(y|ia)|\bit\b/i, cjs: "Italy", loc: "it-it", locU: "it-IT", lang: "it", gg: "ITA", al: "it-IT,it;q=0.9,en;q=0.8" },
  be: { id: "be", nombre: "Bélgica", iso: "BE", re: /belgi|\bbe\b/i, cjs: "Belgium", loc: "fr-be", locU: "fr-BE", lang: "fr", gg: "BEL", al: "fr-BE,fr;q=0.9,nl;q=0.8,en;q=0.7" },
};
const CFG = PAISES[process.env.PAIS || ""];
if (!CFG) { console.error("Falta PAIS=pt|it|be"); process.exit(1); }
const OTROS = /Alemania|Francia|Portugal|Italia|Bélgica/;
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
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)", "Accept-Language": CFG.al };
const OFICIALES_PC = /^(steam|gog|epic|microsoft|ea app|ea store|origin|ubisoft|battle\.net|blizzard|rockstar|bethesda|square enix|nintendo)/i;
// Región de la clave, en palabras de la web: «Global», «EE. UU.» o «Norteamérica»
const zonaDE = (txt) => CFG.re.test(txt || "") ? CFG.nombre : /germany|deutschland|\bde\b|dach/i.test(txt || "") ? "Alemania" : /france|\bfr\b/i.test(txt || "") ? "Francia" : /portugal|\bpt\b/i.test(txt || "") ? "Portugal" : /ital(y|ia)|\bit\b/i.test(txt || "") ? "Italia" : /belgi|\bbe\b/i.test(txt || "") ? "Bélgica" : /europe|\beu\b|emea/i.test(txt || "") ? "Europa" : "Global";


// Catálogo de Francia de cada tienda si existe; si no, el de Alemania (las claves solo de Alemania se descartan al ofertar)
const leerFR = async (fr, de) => { const x = await leer(fr.replace(/-fr\.json$/, `-${CFG.id}.json`), null); return x && x.length ? x : leer(de, []); };

async function main() {
  const es = completar(await leer("precios.json", { juegos: [] }));
  const porLlaveES = new Map(); for (const j of es.juegos) { const k = llave(j.titulo); if (!porLlaveES.has(k)) porLlaveES.set(k, j); }
  const tasas = await cambios();
  const tiendasD = new Map();
  const tienda = (id, nombre, tipo) => { if (!tiendasD.has(id)) tiendasD.set(id, { id, nombre, tipo, formatos: ["digital"] }); };
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
    const otro = (o.condicion || "").match(OTROS); if (otro && otro[0] !== CFG.nombre) return;   // claves solo de otro país: no valen aquí
    if (o.url) o = { ...o, url: o.url.replace(/\/(de-de|fr-fr|es-es)\//i, `/${CFG.loc}/`) };
    const zona = (c) => ((c || "").match(new RegExp("Global|Europa|" + CFG.nombre)) || [""])[0];
    const igual = j.ofertas.find((x) => x.tienda === o.tienda && x.plataforma === o.plataforma && zona(x.condicion) === zona(o.condicion));
    if (igual && igual.precio <= o.precio) return;
    if (igual) j.ofertas.splice(j.ofertas.indexOf(igual), 1);
    j.ofertas.push(o); j.plataformas.add(o.plataforma);
  };
  const cuenta = {}, suma = (k) => { cuenta[k] = (cuenta[k] || 0) + 1; };
  const RAPIDO = process.env.EUROPA_RAPIDO === "1";
  const FIN = Date.now() + +(process.env.EUROPA_MIN || 35) * 60000;
  let FIN_SEC = FIN;
  const seccion = (min) => { FIN_SEC = Math.min(FIN, Date.now() + min * 60000); };
  const queda = () => Date.now() < FIN_SEC;

  // Kinguin (en euros): lo que no está bloqueado en Alemania
  for (const f of await leerFR("feeds/kinguin-fr.json", "feeds/kinguin-de.json")) {
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
    ofertar(j, { tienda: "kinguin", plataforma, formato: "digital", estado: "nuevo", stock: true, precio: f.pr, regular: f.op > f.pr ? f.op : undefined,
      condicion: (tipo === "tarjeta" ? "Código digital" : `Clave ${f.p || ""}`) + " · " + (/region free/i.test(region) || !region ? "Global" : zonaDE(region) === "Global" ? region : zonaDE(region)), url: f.u });
    suma("kinguin");
  }
  // K4G (catálogo en euros): claves de Alemania, Europa o globales
  for (const f of await leer("feeds/k4g.json", [])) {
    const slug = (f.l.match(/k4g\.com\/product\/([a-z0-9-]+)-[A-F0-9]{8}$/) || [])[1];
    if (!slug || !/-cd-key$/.test(slug) || /\b(account|gift|top-up)\b/.test(slug)) continue;
    let p = null;
    for (const [tok, plat, drm] of K4G_PLAT) {
      const m = slug.match(new RegExp(`-${tok}-(germany|europe|eu|global|worldwide)(?:-|$)`));
      if (m) { p = { plat, drm, region: m[1] }; break; }
    }
    if (!p) continue;
    const nombre = html2txt(f.n).replace(K4G_RUIDO, "").replace(/\s+(EU|Europe|Germany|DE|Global)\b/g, "").trim();
    const j = juego(nombre); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("k4g", "K4G", "marketplace");
    ofertar(j, { tienda: "k4g", plataforma: p.plat, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: `Clave ${p.drm} · ${/global|worldwide/.test(p.region) ? "Global" : p.region === "germany" ? "Alemania" : "Europa"}`, url: f.cu || f.l });
    suma("k4g");
  }
  // G2A: su catálogo de Alemania (en euros): GLOBAL, EUROPE, EU y GERMANY
  for (const f of await leer("feeds/g2a-de.json", [])) {
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("g2a", "G2A", "marketplace");
    ofertar(j, { tienda: "g2a", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: `Clave ${f.d || f.pl} · ` + (f.reg === "GLOBAL" ? "Global" : /GERMANY|DACH/.test(f.reg) ? "Alemania" : "Europa"), url: f.u });
    suma("g2a");
  }
  // CJS CD Keys: Global, Europe y Germany (en euros)
  for (const f of await leerFR("feeds/cjs-fr.json", "feeds/cjs-de.json")) {
    let nombre = html2txt(f.n).replace(/[™®©]/g, "");
    if (f.t !== "tarjeta" && f.t !== "software") nombre = nombre.replace(/\s*\+\s*pre-?order bonus( dlc)?\b/gi, " ").replace(/\s*[-(]?\s*\bpre-?order\b\s*\)?/gi, " ").replace(/\s*\/\s*/g, " ").replace(KIN_RUIDO, " ").replace(/\s+-\s*$/, "");
    nombre = nombre.replace(/\s+/g, " ").trim(); if (nombre.length < 2) continue;
    const j = juego(nombre, f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("cjs", "CJS CD Keys", "revendedor");
    ofertar(j, { tienda: "cjs", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p,
      condicion: (f.t === "tarjeta" ? "Código digital" : `Clave ${f.d || f.pl}`) + " · " + (f.reg === "Global" ? "Global" : f.reg === "Europe" ? "Europa" : f.reg === CFG.cjs ? CFG.nombre : "Alemania") + (/pre-?order bonus/i.test(f.n) ? " · Con DLC de reserva" : ""), url: f.u });
    suma("cjs");
  }
  // GGPick: claves globales y tarjetas globales, en euros o de Alemania (sus precios van en dólares → euros)
  for (const f of await leer("feeds/ggpick.json", [])) {
    if (f.t === "tarjeta" && !/^(GLOBAL|EUR|DE|EU)$/.test(f.reg)) continue;
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("ggpick", "GGPick", "revendedor");
    ofertar(j, { tienda: "ggpick", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: Math.round(f.p / tasas.EUR * 100) / 100,
      condicion: f.t === "tarjeta" ? f.d + (f.reg === "DE" ? " · Alemania" : "") : `Clave ${f.d} · Global`, url: f.u });
    suma("ggpick");
  }
  // Loaded (catálogo en euros)
  for (const f of await leerFR("feeds/loaded-fr.json", "feeds/loaded-de.json")) {
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("loaded", "Loaded", "revendedor");
    ofertar(j, { tienda: "loaded", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: (f.t === "tarjeta" ? "Código digital" : `Clave ${f.d || f.pl}`) + " · " + (/worldwide|global/i.test(f.reg) || !f.reg ? "Global" : zonaDE(f.reg)), url: f.u });
    suma("loaded");
  }
  // Godlike (Admitad): servidores de juegos en alquiler mensual, precios en dólares
  try {
    const gl = JSON.parse(await readFile(new URL("../config/godlike.json", import.meta.url), "utf8"));
    for (const x of gl.servidores || []) {
      const j = juego(x.titulo, "software"); if (!j) continue;
      j.tipo = "software"; tienda("godlike", "Godlike", "oficial");
      ofertar(j, { tienda: "godlike", plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: Math.round(x.usd / tasas.EUR * 100) / 100, condicion: "Alquiler mensual", url: gl.enlace + "?ulp=" + encodeURIComponent(x.url) });
      suma("godlike");
    }
  } catch (e) { console.warn("Godlike: " + e.message); }
  // Gamesporium (Admitad): claves en euros con nuestro enlace
  let gspN = 0;
  for (const f of await leer("feeds/gamesporium.json", [])) {
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("gamesporium", "Gamesporium", "revendedor");
    ofertar(j, { tienda: "gamesporium", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined, condicion: `Clave ${f.d || f.pl}`, url: f.u });
    suma("gamesporium"); gspN++;
  }
  // Gamivo (CJ): mercado de claves con nuestro enlace
  for (const f of await leer("feeds/gamivo.json", [])) {
    if (!["global", "eu", CFG.id].includes(f.reg)) continue;
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img && f.t !== "tarjeta") j.img = f.img;
    tienda("gamivo", "Gamivo", "marketplace");
    ofertar(j, { tienda: "gamivo", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: (f.t === "tarjeta" ? "Código digital" : `Clave ${f.d || f.pl}`) + " · " + (f.reg === CFG.id ? CFG.nombre : f.reg === "eu" ? "Europa" : f.reg === "de" || f.reg === "fr" ? "Alemania" : "Global"), url: f.u });
    suma("gamivo");
  }
  // Voidu (Daisycon): tienda oficial de claves, en euros y con nuestro enlace
  let voiduN = 0;
  for (const f of await leer("feeds/voidu.json", [])) {
    if (!/^(|eu|europe|global|ww|worldwide|world|de|germany|dach)$/i.test(f.reg || "")) continue;
    const j = juego(html2txt(f.n), f.t || undefined); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("voidu", "Voidu", "oficial");
    ofertar(j, { tienda: "voidu", plataforma: f.pl, formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined,
      condicion: `Clave ${f.d || f.pl} · ${/^(de|germany|dach)$/i.test(f.reg) ? "Alemania" : /^(eu|europe)$/i.test(f.reg) ? "Europa" : "Global"}`, url: f.u });
    suma("voidu"); voiduN++;
  }
  // GamersGate: su feed de Francia (en euros, con nuestro enlace de CJ)
  for (const f of await leer(`feeds/gamersgate-${CFG.id}.json`, [])) {
    const j = juego(html2txt(f.n), f.t === "dlc" ? "dlc" : undefined); if (!j) continue;
    if (!j.img && f.img) j.img = f.img;
    tienda("gamersgate", "GamersGate", "oficial");
    ofertar(j, { tienda: "gamersgate", plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: f.p, regular: f.r > f.p ? f.r : undefined, condicion: `Clave ${f.d || "PC"}`, url: f.u });
    suma("gamersgate");
  }
  // De España: Instant Gaming y Driffle con claves globales o europeas (mismo precio en euros en toda la UE)
  for (const e of es.juegos) for (const o of e.ofertas) {
    if (!["instantgaming", "driffle"].includes(o.tienda) || !/worldwide|global|europ/i.test(o.condicion || "")) continue;
    const j = juego(e.titulo, e.tipo); if (!j) continue;
    tienda(o.tienda, o.tienda === "driffle" ? "Driffle" : "Instant Gaming", o.tienda === "driffle" ? "marketplace" : "revendedor");
    ofertar(j, { ...o, condicion: (o.condicion || "").replace(/Worldwide/i, "Global") });
    suma(o.tienda);
  }

  const populares = es.juegos.filter((j) => j.tipo !== "tarjeta").sort((a, b) => (a.pop || 99999) - (b.pop || 99999));
  seccion(8);
  // Tiendas de PC por IsThereAnyDeal, país Alemania (en euros)
  const key = (process.env.ITAD_KEY || "").trim();
  if (key) try {
    const pc = populares.filter((j) => (j.plataformas || []).includes("PC")).slice(0, +(process.env.ALEMANIA_ITAD || 5000));
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
        const lista = await (await fetch(`https://api.isthereanydeal.com/games/prices/v3?key=${encodeURIComponent(key)}&country=${CFG.iso}`, { method: "POST", headers: json, body: JSON.stringify(claves.slice(i, i + 200)) })).json();
        for (const g of lista) {
          const e = ids[g.id]; if (!e) continue;
          for (const x of g.deals || []) {
            if (!(x.price?.amount > 0) || x.price.currency !== "EUR") continue;
            const nombre = x.shop?.name || String(x.shop?.id), id0 = /^steam$/i.test(nombre) ? "steam" : "itad-" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
            if (id0 === "itad-gamersgate" || (id0 === "itad-voidu" && voiduN) || (id0 === "itad-gamesporium" && gspN)) continue;   // ya viene de su feed, con nuestro enlace
            const id = { "itad-microsoftstore": "xbox" }[id0] || id0;
            const oficial = OFICIALES_PC.test(nombre);
            const j = juego(e.titulo, e.tipo); if (!j) continue;
            tienda(id, nombre, oficial ? "oficial" : "revendedor");
            ofertar(j, { tienda: id, plataforma: "PC", formato: "digital", estado: "nuevo", stock: true, precio: x.price.amount,
              regular: x.regular?.amount > x.price.amount ? x.regular.amount : undefined, condicion: oficial ? undefined : "Clave PC · Global", url: x.url || undefined });
            suma(id === "steam" ? "steam" : "pc (itad)");
          }
        }
      } catch (e) { console.warn(`${CFG.nombre} ITAD: ${e.message}`); }
      await esperar(300);
    }
  } catch (e) { console.warn(CFG.nombre + " ITAD: " + e.message); }

  seccion(5);
  // Microsoft Store (Xbox y PC) de Alemania
  try {
    const xb = new Map();
    for (const e of populares) for (const o of e.ofertas) if (o.tienda === "xbox" && /\/p\/([A-Z0-9]{12})/.test(o.url || "")) { const id = o.url.match(/\/p\/([A-Z0-9]{12})/)[1]; if (!xb.has(id)) xb.set(id, { e, plats: new Set() }); xb.get(id).plats.add(o.plataforma); }
    const lista = [...xb.keys()].slice(0, RAPIDO ? 40 : +(process.env.ALEMANIA_XBOX || 4000));
    for (let i = 0; i < lista.length; i += 20) { if (!queda()) break;
      try {
        const d = await (await fetch(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${lista.slice(i, i + 20).join(",")}&market=${CFG.iso}&languages=${CFG.loc}`)).json();
        for (const p of d.Products || []) {
          const x = xb.get(p.ProductId); if (!x) continue;
          let mejor = null;
          for (const sk of p.DisplaySkuAvailabilities || []) for (const a of sk.Availabilities || []) {
            const pr = a.OrderManagementData?.Price;
            if (!pr || !(pr.ListPrice > 0) || pr.CurrencyCode !== "EUR" || !(a.Actions || []).includes("Purchase")) continue;
            if (!mejor || pr.ListPrice < mejor.ListPrice) mejor = pr;
          }
          if (!mejor) continue;
          const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
          tienda("xbox", "Microsoft Store", "oficial");
          for (const plat of x.plats) ofertar(j, { tienda: "xbox", plataforma: plat, formato: "digital", estado: "nuevo", stock: true, precio: mejor.ListPrice,
            regular: mejor.MSRP > mejor.ListPrice ? mejor.MSRP : undefined, url: `https://www.xbox.com/${CFG.locU}/games/store/p/${p.ProductId}` });
          suma("xbox");
        }
      } catch (e) { if (i === 0) console.warn(`${CFG.nombre} Xbox: ${e.message}`); }
      await esperar(250);
    }
  } catch (e) { console.warn(CFG.nombre + " Xbox: " + e.message); }

  seccion(9);
  // PlayStation Store de Alemania: la misma ficha (concept o producto) que en España
  try {
    const ps = await leer("data/playstation.json", { juegos: {} });
    const conPs = populares.filter((e) => ps.juegos[e.id]?.ids?.length).slice(0, RAPIDO ? 5 : +(process.env.ALEMANIA_PS || 500));
    for (const e of conPs) { if (!queda()) break;
      for (const id of [...ps.juegos[e.id].ids].sort((x, y) => /^\d+$/.test(x) - /^\d+$/.test(y))) {
        try {
          const url = `https://store.playstation.com/${CFG.loc}/${/^\d+$/.test(id) ? "concept" : "product"}/${id}`;
          const r = await fetch(url, { headers: CABECERAS }); if (!r.ok) continue;
          const m = (await r.text()).match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/); if (!m) continue;
          const ld = JSON.parse(m[1]), of = [].concat(ld.offers || [])[0];
          if (!of || !(of.price > 0) || of.priceCurrency !== "EUR") continue;
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
  } catch (e) { console.warn(CFG.nombre + " PlayStation: " + e.message); }

  // Nintendo eShop de Alemania: el mismo número de producto (nsuid) que en España (Europa comparte catálogo)
  try {
    const sw = [];
    for (const e of populares) for (const o of e.ofertas) if (o.tienda === "eshop" && o.ns) sw.push({ e, o });
    for (let i = 0; i < sw.length; i += 50) {
      try {
        const lote = sw.slice(i, i + 50);
        const d = await (await fetch(`https://api.ec.nintendo.com/v1/price?country=${CFG.iso}&lang=${CFG.lang}&ids=${lote.map((x) => x.o.ns).join(",")}`)).json();
        for (const p of d.prices || []) {
          if (p.sales_status !== "onsale" || p.regular_price?.currency !== "EUR") continue;
          const x = lote.find((y) => y.o.ns === String(p.title_id)); if (!x) continue;
          const reg = +p.regular_price.raw_value, pr = +(p.discount_price?.raw_value ?? reg);
          const j = juego(x.e.titulo, x.e.tipo); if (!j) continue;
          tienda("eshop", "Nintendo eShop", "oficial");
          ofertar(j, { tienda: "eshop", plataforma: x.o.plataforma, formato: "digital", estado: "nuevo", stock: true, precio: pr, regular: reg > pr ? reg : undefined, url: (x.o.url || "").replace("/es-es/", `/${CFG.loc}/`) });
          suma("eshop");
        }
      } catch (e) { if (i === 0) console.warn(`${CFG.nombre} eShop: ${e.message}`); }
      await esperar(300);
    }
  } catch (e) { console.warn(CFG.nombre + " eShop: " + e.message); }

  for (const t of es.tiendas || []) if (tiendasD.has(t.id)) tiendasD.set(t.id, { ...t, busqueda: undefined });
  const tiendas = [...tiendasD.values()];
  // Para no pasar de 100 MB: fuera las ofertas de una plataforma que cuestan más del doble que la más barata de esa plataforma
  for (const j of juegos.values()) {
    const min = {}; for (const o of j.ofertas) min[o.plataforma] = Math.min(min[o.plataforma] ?? Infinity, o.precio);
    j.ofertas = j.ofertas.filter((o) => o.precio <= min[o.plataforma] * 2 + 0.5);
  }
  const lista = [...juegos.values()].filter((j) => j.ofertas.length).sort((a, b) => a.pop - b.pop)
    .map((j) => ({ ...j, plataformas: [...j.plataformas], minimo: Math.min(...j.ofertas.map((o) => o.precio)),
      // Lo que la web ya supone por defecto no se guarda (digital, nuevo y en stock): el archivo no puede pasar de 100 MB
      ofertas: j.ofertas.map(({ formato, estado, stock, ...o }) => ({ ...o, ...(formato && formato !== "digital" ? { formato } : {}), ...(estado && estado !== "nuevo" ? { estado } : {}), ...(stock === false ? { stock } : {}) })) }));
  const salida = { region: CFG.id, moneda: "EUR", actualizado: new Date().toISOString(), tiendas, juegos: lista };
  guardarPartes(`precios-${CFG.id}.json`, salida);
  console.log(`${CFG.nombre}: ${lista.length} productos, ${lista.reduce((n, j) => n + j.ofertas.length, 0)} ofertas · ${JSON.stringify(cuenta)}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
