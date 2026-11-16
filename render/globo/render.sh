#!/bin/bash
# «Los chollos nunca duermen»: globo (d3-geo) + casetas en HTML, fondo Paper Shaders (mesh gradient), fotograma a fotograma.
set -eu
python3 -m http.server 8744 >/dev/null 2>&1 & SRV=$!
sleep 1
cat > grabar.mjs <<'JS'
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const DUR=38.8, FPS=30; mkdirSync("fr",{recursive:true});
const b=await chromium.launch({ args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on("console",m=>console.log("consola:",m.text()));
await p.goto("http://localhost:8744/index.html"); await p.evaluate(()=>window.listo);
console.log("shader:", await p.evaluate(()=>!!window.shaderFrame));
for(let i=0;i<Math.round(DUR*FPS);i++){
  await p.evaluate(t=>{window.render(t); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}, i/FPS);
  await p.screenshot({path:`fr/f${String(i).padStart(5,"0")}.png`,type:"png"});
  if(i%150==0) console.log("fotograma",i);
}
await b.close();
JS
NODE_PATH="$GITHUB_WORKSPACE/node_modules" node grabar.mjs
kill $SRV || true
ffmpeg -v error -y -framerate 30 -i fr/f%05d.png -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -movflags +faststart "$SALIDA/chollos-nunca-duermen.mp4"
rm -rf fr grabar.mjs
