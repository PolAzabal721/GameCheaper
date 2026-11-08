// Diagnóstico temporal: ¿se pueden leer precios de Instant Gaming, Eneba y G2A?
const H = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "text/html,application/json;q=0.9,*/*;q=0.8" };
const ver = (t, k, a = 250, b = 450) => { const i = t.indexOf(k); return i < 0 ? "(no)" : JSON.stringify(t.slice(Math.max(0, i - a), i + b)); };
const urls = {
  ig: "https://www.instant-gaming.com/es/busquedas/?query=battlefield%206",
  eneba: "https://www.eneba.com/es/store/all?text=battlefield%206",
  g2a: "https://www.g2a.com/es/search?query=battlefield%206",
};
for (const [n, u] of Object.entries(urls)) {
  try {
    const r = await fetch(u, { headers: H }); const t = await r.text();
    console.log("==", n, r.status, t.length, r.url);
    for (const k of ["Battlefield", "€", "price", "__NEXT_DATA__", "__APOLLO_STATE__", "application/ld+json", "algolia", "data-price", "cheapest"]) console.log("KEY", n, k, (t.split(k).length - 1), (t.split(k).length > 1 && ["Battlefield", "price", "€", "cheapest", "data-price"].includes(k)) ? ver(t, k) : "");
  } catch (e) { console.log("==", n, "ERR", e.message); }
}
