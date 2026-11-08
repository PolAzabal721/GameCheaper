// Diagnóstico temporal: rutas de la API de IsThereAnyDeal (sin clave)
for (const [m, p] of [["GET", "/games/lookup/v1?title=celeste"], ["POST", "/lookup/id/title/v1"], ["POST", "/games/prices/v3?country=ES"], ["POST", "/games/prices/v2?country=ES"], ["GET", "/games/inventadaxx/v1"]]) {
  const r = await fetch("https://api.isthereanydeal.com" + p, { method: m, headers: { "Content-Type": "application/json" }, body: m === "POST" ? "[\"celeste\"]" : undefined });
  console.log("RUTA", m, p, r.status, (await r.text()).slice(0, 160).replace(/\s+/g, " "));
}
