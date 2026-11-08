// Diagnóstico temporal: ¿existen las rutas de la API de IsThereAnyDeal? (sin clave deberían pedir clave, no dar 404)
const B = "https://api.isthereanydeal.com";
const pruebas = [["GET", "/games/lookup/v1?title=hades"], ["GET", "/games/search/v1?title=hades"], ["POST", "/games/prices/v3?country=ES"], ["POST", "/games/prices/v2?country=ES"], ["GET", "/service/shops/v1?country=ES"], ["GET", "/games/inventada/v9"]];
for (const [m, p] of pruebas) {
  const r = await fetch(B + p, { method: m, headers: { "Content-Type": "application/json" }, body: m === "POST" ? "[]" : undefined });
  const t = await r.text();
  console.log("ITAD", m, p, r.status, t.slice(0, 250).replace(/\s+/g, " "));
}
