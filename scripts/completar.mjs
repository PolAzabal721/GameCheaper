// precios.json guarda las ofertas sin los valores más comunes para no pasar del límite de 100 MB de GitHub:
// sin «formato» es "digital", sin «estado» es "nuevo", sin «stock» es true y sin «fuente» es la propia tienda.
// Todo lo que lee precios.json pasa por aquí para tenerlos de vuelta.
export function completar(d) {
  for (const j of (d && d.juegos) || []) for (const o of j.ofertas || []) {
    if (o.formato === undefined) o.formato = "digital";
    if (o.estado === undefined) o.estado = "nuevo";
    if (o.stock === undefined) o.stock = true;
    if (!o.fuente) o.fuente = o.tienda;
  }
  return d;
}
export function compactar(o) {
  const r = { ...o };
  if (r.fuente === r.tienda) delete r.fuente;
  if (r.formato === "digital") delete r.formato;
  if (r.estado === "nuevo") delete r.estado;
  if (r.stock === true) delete r.stock;
  return r;
}
