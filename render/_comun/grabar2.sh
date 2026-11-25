#!/bin/bash
# Graba una historia «¿Sabías que…?» (index.html + kit.js) fotograma a fotograma con el fondo de Paper Shaders.
# Uso (desde la carpeta del proyecto): bash ../_comun/grabar2.sh <nombre-salida>  (la duración la da la página: window.DUR)
# Copia antes kit.js, historia.js y las fuentes comunes a la carpeta del proyecto.
set -eu
NOMBRE="$1"
cp -r ../_comun/fuentes ../_comun/kit.js ../_comun/historia.js .
rm -rf voz voz.json
python3 -m http.server 8744 >/dev/null 2>&1 & SRV=$!
sleep 1
if [ -n "${ELEVENLABS_API_KEY:-}" ] && [ "${SIN_VOZ:-}" != "1" ]; then cp ../_comun/voz.mjs . && NODE_PATH="$GITHUB_WORKSPACE/node_modules" node voz.mjs; rm voz.mjs; fi
cat > grabar.mjs <<JS
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const FPS=30; mkdirSync("fr",{recursive:true});
const b=await chromium.launch({ args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto("http://localhost:8744/index.html?grabar=1");
await p.waitForFunction(()=>window.render&&window.DUR&&document.fonts.status=="loaded",null,{timeout:60000}); await p.waitForTimeout(4000);
const DUR=await p.evaluate(()=>window.DUR); (await import("fs")).writeFileSync("t0.json",JSON.stringify(await p.evaluate(()=>TRAMOS.map(e=>e.t0)))); console.log("duración", DUR);
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
if [ -f voz.json ]; then
  python3 - "$SALIDA/$NOMBRE.mp4" <<'PY'
import json,subprocess,sys,glob,os
v=sys.argv[1]; t0=json.load(open("t0.json")); fs=sorted(glob.glob("voz/*.mp3"))
args=["ffmpeg","-v","error","-y","-i",v]; f=[]
for i,a in enumerate(fs): args+=["-i",a]; f.append(f"[{i+1}]adelay={int(t0[i]*1000)}:all=1[a{i}]")
f.append("".join(f"[a{i}]" for i in range(len(fs)))+f"amix=inputs={len(fs)}:normalize=0[a]")
subprocess.run(args+["-filter_complex",";".join(f),"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","con_voz.mp4"],check=True)
os.replace("con_voz.mp4",v)
PY
  rm -rf voz voz.json
fi
rm -f t0.json
rm -r fr
rm grabar.mjs
