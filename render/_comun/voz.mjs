// Dobla las frases del vídeo con ElevenLabs (voz por nombre en VOZ_NOMBRE). Escribe voz/NN.mp3 y voz.json con las duraciones.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
const K=process.env.ELEVENLABS_API_KEY, NOM=(process.env.VOZ_NOMBRE||"Marcos").toLowerCase(), H={"xi-api-key":K};
const j=async(u)=>{const r=await fetch("https://api.elevenlabs.io"+u,{headers:H});if(!r.ok)throw new Error(u+" "+r.status+" "+await r.text());return r.json()};
let voz=null;
try{const v=await j("/v2/voices?page_size=100&search="+encodeURIComponent(NOM.split(" ")[0]));voz=(v.voices||[]).find(x=>x.name.toLowerCase().includes(NOM))||(v.voices||[])[0]}catch(e){console.log("voces propias:",e.message)}
if(!voz){const s=await j("/v1/shared-voices?page_size=50&search="+encodeURIComponent(NOM));voz=(s.voices||[]).find(x=>x.name.toLowerCase().includes(NOM))||(s.voices||[])[0]; if(voz) voz.voice_id=voz.voice_id}
if(!voz) throw new Error("No encuentro la voz "+NOM);
console.log("voz:",voz.name,voz.voice_id);
let modelo="eleven_multilingual_v2";
try{const ms=await j("/v1/models");const ids=ms.map(m=>m.model_id);console.log("modelos:",ids.join(" "));modelo=ids.find(i=>/v4/.test(i)&&!/flash|turbo/.test(i))||ids.find(i=>/v3/.test(i)&&!/flash|turbo|conv/.test(i))||modelo}catch(e){console.log("modelos:",e.message)}
console.log("modelo:",modelo);
const b=await chromium.launch(); const p=await b.newPage();
await p.goto("http://localhost:8744/index.html?grabar=1&sinvoz=1"); await p.waitForFunction(()=>window.TRAMOS,null,{timeout:60000});
const frases=await p.evaluate(()=>TRAMOS.map(e=>e.f.replace(/\*/g,""))); await b.close();
mkdirSync("voz",{recursive:true}); const d=[];
for(let i=0;i<frases.length;i++){
 const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz.voice_id}?output_format=mp3_44100_128`,{method:"POST",headers:{...H,"content-type":"application/json"},body:JSON.stringify({text:frases[i],model_id:modelo})});
 if(!r.ok) throw new Error("TTS "+r.status+" "+await r.text());
 const f=`voz/${String(i).padStart(2,"0")}.mp3`; writeFileSync(f,Buffer.from(await r.arrayBuffer()));
 d.push(+execFileSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",f]).toString().trim()); console.log(i,d[i].toFixed(2),frases[i]);
}
writeFileSync("voz.json",JSON.stringify({d}));
