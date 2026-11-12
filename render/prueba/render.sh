#!/bin/bash
# Prueba de las cuatro herramientas: cada una deja algo en $SALIDA
set -u
ok() { echo "✔ $1"; }; mal() { echo "✘ $1"; }

# 1. HyperFrames: un ejemplo suyo, de HTML a MP4
( hyperframes init hf --example warm-grain --non-interactive --skip-skills >/dev/null && cd hf && timeout 900 hyperframes render --output "$SALIDA/1-hyperframes.mp4" ) && ok HyperFrames || mal HyperFrames

# 2. Paper Shaders: fondo degradado animado, grabado 4 s con Playwright
cat > grabar.mjs <<'JS'
import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const c = await b.newContext({ viewport: { width: 540, height: 960 }, recordVideo: { dir: "tmpvid", size: { width: 540, height: 960 } } });
const p = await c.newPage();
await p.goto("file://" + process.cwd() + "/fondo.html");
await p.waitForFunction(() => window.listo, null, { timeout: 30000 });
await p.waitForTimeout(4000);
await p.screenshot({ path: process.env.SALIDA + "/2-shaders.png" });
await c.close(); await b.close();
JS
( NODE_PATH="$GITHUB_WORKSPACE/node_modules" node grabar.mjs && f=$(ls tmpvid/*.webm | head -1) && ffmpeg -v error -y -i "$f" -c:v libx264 -pix_fmt yuv420p "$SALIDA/2-shaders.mp4" ) && ok "Paper Shaders" || mal "Paper Shaders"

# 3. Claude Animation Base: la hoja de personaje y el vídeo de ejemplo
( cd "$HERR/ClaudeAnimationBase" && timeout 600 node render.mjs --sheet=0,1,2,3 --soft-gl --out="$SALIDA/3-animacion-hoja.jpg" && timeout 2400 node render.mjs --clip --soft-gl --out="$SALIDA/3-animacion.mp4" ) && ok "Claude Animation Base" || mal "Claude Animation Base"

# 4. Lemo-Opuscar: un fotograma del estilo «ascii-crt» con su propio motor
( cd "$LEMO_OPUSCAR_HOME" && sh plugin/skills/lemo-opuscar/scripts/setup.sh demo ascii-crt >/dev/null && sh styles/ascii-crt/demo/tools/fonts.sh && timeout 600 node core/render/still.mjs styles/ascii-crt/demo 12 --q 'nosub=1' --out "$SALIDA/opuscar" --prefix crt_ ) && ok "Lemo-Opuscar" || mal "Lemo-Opuscar"
rm -rf tmpvid hf grabar.mjs
exit 0
