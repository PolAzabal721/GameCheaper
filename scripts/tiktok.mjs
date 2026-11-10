// Subida de los vídeos del día a TikTok (Content Posting API, buzón de borradores).
//
// Tres modos:
//   node scripts/tiktok.mjs url                 → enseña el enlace con el que autorizas tu cuenta
//   node scripts/tiktok.mjs canjear <codigo>    → cambia ese código por el permiso de larga duración y lo guarda cifrado
//   node scripts/tiktok.mjs subir [n]           → sube los n últimos vídeos a tus borradores de TikTok
//
// El permiso se guarda en data/tiktok.enc, cifrado con la clave secreta de la app (TIKTOK_CLIENT_SECRET),
// así que el fichero del repositorio no sirve de nada sin ese secreto, que solo está en GitHub.
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

const ENV = process.env;
const CLAVE = (ENV.TIKTOK_CLIENT_KEY || "").trim();
const SECRETO = (ENV.TIKTOK_CLIENT_SECRET || "").trim();
const VUELTA = ENV.TIKTOK_REDIRECT || "https://pillaojuegos.com/";
const PERMISOS = "video.upload";
const GUARDA = "data/tiktok.enc";
const modo = process.argv[2] || "url";
if (!CLAVE || !SECRETO) { console.error("Faltan TIKTOK_CLIENT_KEY o TIKTOK_CLIENT_SECRET."); process.exit(1); }

const llave = () => createHash("sha256").update(SECRETO).digest();
const cifrar = (txt) => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", llave(), iv);
  return Buffer.concat([iv, c.update(Buffer.from(txt, "utf8")), c.final(), c.getAuthTag()]).toString("base64"); };
const descifrar = (b64) => { const b = Buffer.from(b64, "base64"), iv = b.subarray(0, 12), tag = b.subarray(b.length - 16);
  const d = createDecipheriv("aes-256-gcm", llave(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString("utf8"); };

async function token(datos) {
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: CLAVE, client_secret: SECRETO, ...datos }) });
  const d = await r.json();
  if (!d.access_token) throw new Error(`TikTok: ${d.error_description || d.error || r.status}`);
  return d;
}
const guardar = async (refresco) => writeFile(GUARDA, cifrar(JSON.stringify({ refresco, fecha: new Date().toISOString() })) + "\n");

if (modo === "url") {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", CLAVE);
  url.searchParams.set("scope", PERMISOS);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", VUELTA);
  url.searchParams.set("state", "pillao");
  console.log("\nAbre este enlace, entra con tu cuenta y acepta:\n\n" + url + "\n\nTe devolverá a pillaojuegos.com con ?code=… en la barra de direcciones: ese es el código.\n");
} else if (modo === "canjear") {
  const codigo = decodeURIComponent((process.argv[3] || "").split("&")[0].replace(/^.*[?&]code=/, "").trim());
  if (!codigo) { console.error("Hace falta el código (o la dirección entera a la que te ha devuelto TikTok)."); process.exit(1); }
  const d = await token({ code: codigo, grant_type: "authorization_code", redirect_uri: VUELTA });
  await guardar(d.refresh_token);
  console.log(`Permiso guardado en ${GUARDA}. Caduca dentro de ${Math.round((d.refresh_expires_in || 0) / 86400)} días y se renueva solo en cada subida.`);
} else if (modo === "subir") {
  const cuantos = +(process.argv[3] || ENV.TIKTOK_MAX || 5);
  let guardado;
  try { guardado = JSON.parse(descifrar(await readFile(GUARDA, "utf8"))); }
  catch { console.error(`No hay permiso guardado (${GUARDA}). Lanza primero el modo «autorizar».`); process.exit(1); }
  const d = await token({ grant_type: "refresh_token", refresh_token: guardado.refresco });
  if (d.refresh_token && d.refresh_token !== guardado.refresco) await guardar(d.refresh_token);
  const acceso = d.access_token;

  const hoy = new Date().toISOString().slice(0, 10);
  const ficheros = (await readdir("videos")).filter((f) => f.startsWith(hoy) && f.endsWith(".mp4")).sort().slice(0, cuantos);
  if (!ficheros.length) { console.log("No hay vídeos de hoy que subir."); process.exit(0); }
  let subidos = 0;
  for (const f of ficheros) {
    const ruta = join("videos", f), tam = (await stat(ruta)).size;
    try {
      const r = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", { method: "POST",
        headers: { Authorization: `Bearer ${acceso}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: tam, chunk_size: tam, total_chunk_count: 1 } }) });
      const ini = await r.json();
      const sitio = ini.data?.upload_url;
      if (!sitio) throw new Error(ini.error?.message || JSON.stringify(ini).slice(0, 160));
      const sub = await fetch(sitio, { method: "PUT", body: await readFile(ruta),
        headers: { "Content-Type": "video/mp4", "Content-Length": String(tam), "Content-Range": `bytes 0-${tam - 1}/${tam}` } });
      if (!sub.ok) throw new Error(`subida: ${sub.status}`);
      subidos++;
      console.log(`  ${f} → en tus borradores de TikTok`);
    } catch (e) { console.warn(`  ${f}: ${e.message}`); }
  }
  console.log(`TikTok: ${subidos} de ${ficheros.length} vídeos en borradores.`);
} else { console.error("Modos: url | canjear <codigo> | subir [n]"); process.exit(1); }
