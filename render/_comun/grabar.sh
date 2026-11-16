#!/bin/bash
# Graba una historia «¿Sabías que…?» (index.html + kit.js) fotograma a fotograma con el fondo de Paper Shaders.
# Uso (desde la carpeta del proyecto): bash ../_comun/grabar.sh <nombre-salida> <duración-en-segundos>
set -eu
NOMBRE="$1"; DUR="$2"
python3 -m http.server 8744 >/dev/null 2>&1 & SRV=$!
sleep 1
cat > grabar.mjs <<JS
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const DUR=${DUR}, FPS=30; mkdirSync("fr",{recursive:true});
const b=await chromium.launch({ args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto("http://localhost:8744/index.html?grabar=1");
await p.waitForFunction(()=>window.render&&document.fonts.status=="loaded",null,{timeout:60000}); await p.waitForTimeout(4000);
console.log("shader:", await p.evaluate(()=>!!window.shaderFrame));
for(let i=0;i<Math.round(DUR*FPS);i++){
  await p.evaluate(t=>{window.render(t); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}, i/FPS);
  await p.screenshot({path:"fr/f"+String(i).padStart(5,"0")+".png",type:"png"});
  if(i%300==0) console.log("fotograma",i);
}
await b.close();
JS
NODE_PATH="$GITHUB_WORKSPACE/node_modules" node grabar.mjs
kill $SRV || true
ffmpeg -v error -y -framerate 30 -i fr/f%05d.png -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -movflags +faststart "$SALIDA/$NOMBRE.mp4"
rm -r fr
rm grabar.mjs
