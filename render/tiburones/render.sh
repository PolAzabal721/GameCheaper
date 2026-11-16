#!/bin/bash
# Historia «¿Sabías que los tiburones…?»: HTML animado + fondo Paper Shaders (god rays), fotograma a fotograma.
set -eu
cat > grabar.mjs <<'JS'
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const DUR=42.8, FPS=30; mkdirSync("fr",{recursive:true});
const b=await chromium.launch({ args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on("console",m=>console.log("consola:",m.text()));
await p.goto("file://"+process.cwd()+"/index.html"); await p.evaluate(()=>window.listo);
console.log("shader:", await p.evaluate(()=>!!window.shaderFrame));
for(let i=0;i<Math.round(DUR*FPS);i++){
  await p.evaluate(t=>{window.render(t); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}, i/FPS);
  await p.screenshot({path:`fr/f${String(i).padStart(5,"0")}.jpg`,type:"jpeg",quality:90});
  if(i%150==0) console.log("fotograma",i);
}
await b.close();
JS
NODE_PATH="$GITHUB_WORKSPACE/node_modules" node grabar.mjs
ffmpeg -v error -y -framerate 30 -i fr/f%05d.jpg -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart "$SALIDA/tiburones-pillao.mp4"
rm -rf fr grabar.mjs
