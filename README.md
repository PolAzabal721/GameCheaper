# Pillao · comparador de precios de videojuegos

Web responsive (móvil y ordenador) que compara precios de juegos digitales y en disco en tiendas españolas. Todo sale de un único archivo: `precios.json`.

## Qué hay aquí

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La web. Lee `precios.json` y lo vuelve a leer cada 5 minutos. |
| `precios.json` | Los precios. Ahora mismo son **de ejemplo** (inventados). |
| `config/tiendas.json` | Tiendas: nombre, tipo (`oficial`, `revendedor`, `marketplace`, `tienda`) y enlace de búsqueda. |
| `config/seguimiento.json` | Juegos que quieres seguir, con su PVP y, si existe, su `steamAppId`. |
| `config/manual.json` | Ofertas que metes a mano. Mira `manual.ejemplo.json`. |
| `scripts/actualizar.mjs` | Genera `precios.json` a partir de todo lo anterior. |
| `.github/workflows/actualizar-precios.yml` | Ejecuta el actualizador cada 6 horas en GitHub, gratis. |

## Probarlo en tu ordenador

```bash
npx serve .          # o: python3 -m http.server
```
Abre http://localhost:3000 (o :8000). Abrir `index.html` con doble clic también funciona, pero usa los datos incrustados.

## Actualizar precios

```bash
node scripts/actualizar.mjs
```
Necesita Node 18 o superior. Sin dependencias.

Fuentes con precio real y automático: **Steam**, **Nintendo eShop**, **PlayStation Store** (juegos con `psConcept` en `config/seguimiento.json`), **GAME** (nuevo y seminuevo), **eBay** (con claves) e **IsThereAnyDeal** (opcional, secreto `ITAD_KEY`).

Sin precio automático: MediaMarkt, Fnac, Amazon, El Corte Inglés, Eneba, G2A, Instant Gaming, CeX y Wallapop. No tienen API pública y bloquean la lectura automática; la web muestra enlaces para buscar el juego en ellas. La vía legal para tener sus precios son sus programas de afiliados. Mientras, se pueden añadir ofertas a mano en `config/manual.json`.

## Catálogo y búsqueda en vivo

- El actualizador junta automáticamente los más vendidos de Steam, el catálogo de la eShop y los juegos de `config/seguimiento.json`, y busca precios de disco nuevo y seminuevo en GAME para los más populares.
- **Buscador en vivo** (`buscador/`, un Cloudflare Worker): si alguien busca un juego que no está, lo consulta al momento en Steam y la eShop (y en eBay si hay claves) y lo añade al catálogo para siempre.
- Se despliega solo con el workflow «Desplegar buscador» usando los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- eBay se activa al añadir los secretos `EBAY_CLIENT_ID` y `EBAY_CLIENT_SECRET` (y volver a desplegar el buscador).

## Publicarlo con actualización automática

1. Sube esta carpeta a un repositorio de GitHub.
2. Settings → Pages → publica desde la rama `main`.
3. (Opcional) Settings → Secrets → Actions → crea `ITAD_KEY`.
4. Actions → «Actualizar precios» → Run workflow para la primera vez. Después corre solo cada 6 horas.

## Formato del JSON

```json
{
  "actualizado": "2026-11-08T16:40:00+01:00",
  "ejemplo": false,
  "tiendas": [{ "id": "steam", "nombre": "Steam", "tipo": "oficial", "busqueda": "https://store.steampowered.com/search/?term={q}" }],
  "juegos": [{
    "id": "silksong", "titulo": "Hollow Knight: Silksong", "plataformas": ["PC"], "pvp": 19.5,
    "ofertas": [{ "tienda": "steam", "plataforma": "PC", "formato": "digital", "precio": 19.5, "stock": true, "url": "https://…" }]
  }]
}
```
Obligatorio: `juegos[].titulo`, `juegos[].ofertas[].tienda` y `precio`. Lo demás es opcional. `formato` es `digital` o `fisico`.

Segunda mano: añade `"estado": "usado"` (se trata como disco), y si quieres `"condicion": "Como nuevo"` y `"envio": 3.49`. La web compara siempre **precio + envío**, que es lo que pagas. Tipos de tienda para esto: `segundamano` (CeX, GAME Seminuevos, Amazon Segunda Mano) y `particulares` (Wallapop, eBay). Ninguna de estas webs tiene API pública de precios para particulares, así que van en `config/manual.json` (mira el ejemplo).
Si una oferta no trae `url`, el botón busca el juego en la tienda usando `busqueda` (`{q}` se cambia por el título).

Desde la propia web («Tus datos») puedes pegar o subir un JSON para probarlo sin tocar el servidor.
