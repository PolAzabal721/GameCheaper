#!/bin/bash
# Vídeo de chollo, versión 2 (HyperFrames + fondo de Paper Shaders). Juegos: variable JUEGOS (ids separados por espacios)
set -eu
JUEGOS="${JUEGOS:-red-dead-redemption-2 a-plague-tale-innocence}"
curl -sSL -o /tmp/gsap.min.js https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js
curl -sSL -o /tmp/shaders.mjs "https://cdn.jsdelivr.net/npm/@paper-design/shaders@0.0.82/+esm"
grep -q "^import" /tmp/shaders.mjs && { echo "El módulo de shaders tiene importaciones: revisar"; head -c 300 /tmp/shaders.mjs; }
for id in $JUEGOS; do
  d="proy-$id"; rm -rf "$d"; mkdir -p "$d"
  node hacer.mjs "$id" "$d"
  cp /tmp/gsap.min.js "$d/assets/lib/gsap.min.js"; cp /tmp/shaders.mjs "$d/assets/lib/shaders.mjs"
  curl -sSL -A "Mozilla/5.0" -o "$d/assets/arte.jpg" "$(cat "$d/arte-url.txt")"
  ( cd "$d" && (hyperframes check --json | head -c 3000 || true) && hyperframes render --output "$SALIDA/$id.mp4" )
  ffmpeg -v error -y -i "$SALIDA/$id.mp4" -vf "select='eq(n\,0)+eq(n\,150)+eq(n\,200)+eq(n\,270)+eq(n\,345)',scale=270:-1,tile=5x1" -frames:v 1 "$SALIDA/$id-hoja.jpg" || true
done
