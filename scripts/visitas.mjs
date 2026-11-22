// Recoge las visitas y clics que el Worker deja en el KV («b:…», un volcado cada 20 s como mucho) y los suma en data/visitas.json.
// La primera vez también pasa los recuentos antiguos del KV («n:…»). Solo lee del KV: nunca escribe ni borra (los volcados caducan solos).
import { readFile, writeFile } from "node:fs/promises";
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: CUENTA } = process.env;
const API = `https://api.cloudflare.com/client/v4/accounts/${CUENTA}/storage/kv/namespaces`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const pedir = async (u, op) => { const r = await fetch(u, { headers: H, ...op }); const d = await r.json(); if (!d.success) throw new Error(JSON.stringify(d.errors)); return d; };

const id = (await pedir(`${API}?per_page=100`)).result.find((n) => n.title === "pillao-anadidos")?.id;
if (!id) throw new Error("No encuentro el KV pillao-anadidos");
const listar = async (prefijo) => { const out = []; let cursor = "";
  do { const d = await pedir(`${API}/${id}/keys?prefix=${prefijo}&limit=1000${cursor ? "&cursor=" + cursor : ""}`); out.push(...d.result); cursor = d.result_info?.cursor || ""; } while (cursor);
  return out; };

let v; try { v = JSON.parse(await readFile("data/visitas.json", "utf8")); } catch { v = null; }
if (!v) {
  v = { n: {}, leidas: [] };
  for (const k of await listar("n:")) if (k.metadata?.v) v.n[k.name] = +k.metadata.v;
  console.log(`Recuentos antiguos del KV: ${Object.keys(v.n).length} claves`);
}
const leidas = new Set(v.leidas);
const vivas = (await listar("b:")).map((k) => k.name);
const nuevas = vivas.filter((k) => !leidas.has(k));
let sumadas = 0;
for (let i = 0; i < nuevas.length; i += 100) {
  const trozo = nuevas.slice(i, i + 100);
  const d = await pedir(`${API}/${id}/bulk/get`, { method: "POST", body: JSON.stringify({ keys: trozo, type: "json" }) });
  for (const nombre of trozo) {
    const b = d.result?.values?.[nombre];
    if (!b) continue;
    for (const [k, n] of Object.entries(b)) v.n[k] = (v.n[k] || 0) + n;
    leidas.add(nombre); sumadas++;
  }
}
// Solo hace falta recordar los volcados que aún existen en el KV (caducan a los 4 días)
const siguen = new Set(vivas);
v.leidas = [...leidas].filter((k) => siguen.has(k)).sort();
v.actualizado = new Date().toISOString();
v.n = Object.fromEntries(Object.entries(v.n).sort((a, b) => a[0].localeCompare(b[0])));
await writeFile("data/visitas.json", JSON.stringify(v) + "\n");
console.log(`Visitas: ${sumadas} volcados nuevos sumados · ${Object.keys(v.n).length} claves · visitas de hoy: ${v.n["n:v:" + new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date())] || 0}`);
