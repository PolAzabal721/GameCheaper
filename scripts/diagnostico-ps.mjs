// Diagnóstico temporal: qué trae la ficha de un juego en PS Store
for (const c of ["10003923", "10009568"]) {
  const r = await fetch(`https://store.playstation.com/es-es/concept/${c}`, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" } });
  const h = await r.text();
  console.log("CONCEPT", c, "HTTP", r.status, "bytes", h.length);
  let n = 0;
  for (const m of h.matchAll(/basePrice|discountedPrice|"price"|finalPrice|priceOrText/g)) { if (n++ > 3) break; console.log("KEY", m[0], JSON.stringify(h.slice(Math.max(0, m.index - 350), m.index + 300))); }
  for (const m of h.matchAll(/<script([^>]*)>/g)) if (/json/.test(m[1])) console.log("SCRIPT", m[1].slice(0, 100));
}
