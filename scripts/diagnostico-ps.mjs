// Diagnóstico temporal: qué devuelve la búsqueda de PS Store
const r = await fetch("https://store.playstation.com/es-es/search/Battlefield%206", { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" } });
const h = await r.text();
console.log("HTTP", r.status, "bytes", h.length);
for (const m of h.matchAll(/<script([^>]*)>/g)) if (/json|NEXT|id=/.test(m[1])) console.log("SCRIPT", m[1].slice(0, 120));
for (const k of ["basePrice", "discountedPrice", "__NEXT_DATA__", "apolloState", "Battlefield", "\"price\"", "priceRange", "displayPrice"]) {
  const i = h.indexOf(k); console.log("KEY", k, i, i >= 0 ? JSON.stringify(h.slice(Math.max(0, i - 200), i + 250)) : "");
}
