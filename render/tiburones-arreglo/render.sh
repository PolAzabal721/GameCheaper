#!/bin/bash
# Arreglo puntual: vuelve a hacer solo los fotogramas 3,97–4,6 s del vídeo de los tiburones (sin el círculo que parecía una ruedita de carga)
set -eu
cd ../tiburones
cat > parche.mjs <<'JS'
import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("pf",{recursive:true});
const b=await chromium.launch({ args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto("file://"+process.cwd()+"/index.html"); await p.evaluate(()=>window.listo);
console.log("shader:", await p.evaluate(()=>!!window.shaderFrame));
for(let i=118;i<=139;i++){
  await p.evaluate(t=>{window.render(t); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}, i/30);
  await p.screenshot({path:`pf/f${String(i).padStart(5,"0")}.png`,type:"png"});
}
await b.close();
JS
NODE_PATH="$GITHUB_WORKSPACE/node_modules" node parche.mjs
ffmpeg -v error -y -i salida/tiburones-pillao.mp4 -start_number 118 -framerate 30 -i pf/f%05d.png \
  -filter_complex "[1:v]setpts=PTS+118/30/TB[p];[0:v][p]overlay=0:0:eof_action=pass" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart "$SALIDA/tiburones-pillao.mp4"
rm -rf pf parche.mjs
