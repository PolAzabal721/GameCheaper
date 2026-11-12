#!/bin/bash
# Vídeo de chollo, versión 2 (HyperFrames + fondo de Paper Shaders). Juegos: variable JUEGOS (ids separados por espacios)
set -eu
JUEGOS="${JUEGOS:-red-dead-redemption-2 a-plague-tale-innocence}"
curl -sSL -o /tmp/gsap.min.js https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js
for id in $JUEGOS; do
  d="proy-$id"; rm -rf "$d"; mkdir -p "$d"
  node hacer.mjs "$id" "$d"
  cp /tmp/gsap.min.js "$d/assets/lib/gsap.min.js";
  curl -sSL -A "Mozilla/5.0" -o "$d/assets/arte.jpg" "$(cat "$d/arte-url.txt")"
  ffmpeg -v error -y -i "$d/assets/arte.jpg" -vf "scale=540:-2,boxblur=24:3,eq=saturation=1.3:brightness=-0.08" "$d/assets/fondo.jpg"
  ( cd "$d" && (hyperframes check --json | head -c 3000 || true) && hyperframes render --output "$SALIDA/$id.mp4" )
  ffmpeg -v error -y -i "$SALIDA/$id.mp4" -vf "select='eq(n\,0)+eq(n\,150)+eq(n\,200)+eq(n\,270)+eq(n\,345)',scale=270:-1,tile=5x1" -frames:v 1 "$SALIDA/$id-hoja.jpg" || true
done
