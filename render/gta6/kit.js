// Kit común de los vídeos «¿Sabías que…?» de Pillao (1080x1920). Cada historia define FRASES, DUR, PALETA y escena(t).
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), sg=(t,a,b)=>cl((t-a)/(b-a));
const eio=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2, eo=x=>1-Math.pow(1-x,3), eb=x=>{const c=1.5;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
function rnd(n){const x=Math.sin(n*91.7+12.3)*43758.5453;return x-Math.floor(x)}
const eur=v=>v.toFixed(2).replace(".",",")+" €";

document.write(`<style>
@font-face{font-family:"Inter";font-weight:600;src:url(fuentes/Inter-SemiBold.otf)}
@font-face{font-family:"Inter";font-weight:700;src:url(fuentes/Inter-Bold.otf)}
@font-face{font-family:"Inter";font-weight:800;src:url(fuentes/Inter-ExtraBold.otf)}
@font-face{font-family:"Inter Display";font-weight:900;src:url(fuentes/InterDisplay-Black.otf)}
@font-face{font-family:"DejaVu Sans Mono";font-weight:700;src:url(fuentes/DejaVuSansMono-Bold.ttf)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#111}
#st{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:"Inter",sans-serif;transform-origin:0 0}
#cielo,#shader,#estrellas,#esc{position:absolute;inset:0}
#sub{position:absolute;left:80px;right:80px;top:230px;text-align:center;font-size:52px;line-height:1.25;font-weight:600;z-index:5}
#sub span{color:rgba(255,255,255,.38)} #sub span.ya,#sub span.on{color:#fff} #sub span.on{font-weight:800}
#sub span.k{outline:3px solid var(--acento,#6aa8ff);outline-offset:4px;border-radius:4px;background:rgba(40,60,140,.3)}
.tagp{display:inline-block;background:#1f6e5a;color:#d9ffe9;border:3px solid #7ff0c0;border-radius:12px;font:800 30px "Inter";padding:4px 14px}
.reloj{display:inline-block;background:#3a0f22;color:#ff5a7a;border:3px solid #ff5a7a;border-radius:10px;font:700 40px "DejaVu Sans Mono";padding:2px 12px;box-shadow:0 0 18px rgba(255,90,122,.45)}
.dato{position:absolute;background:rgba(14,8,28,.88);color:#fff;font-weight:800;border-radius:16px;padding:10px 20px;font-size:54px;box-shadow:0 0 0 2px rgba(255,255,255,.14)}
.dato small{font-size:28px;margin-left:6px;opacity:.85}
</style>`);

function persona(tipo,piel,ropa,pelo,peinado,extra=""){
 const dorm=tipo=="dorm";
 const oy=tipo=="sorpresa"?200:204;
 const ojos = dorm ? `<path d="M152 205 q16 12 32 0 M216 205 q16 12 32 0" stroke="#3a2412" stroke-width="7" fill="none" stroke-linecap="round"/>`
  : [168,232].map(x=>`<ellipse cx="${x}" cy="${oy}" rx="17" ry="${tipo=="sorpresa"?22:19}" fill="#fff"/><circle cx="${x+3}" cy="${oy+2}" r="${tipo=="sorpresa"?8:10}" fill="#2b1a0e"/><circle cx="${x+7}" cy="${oy-3}" r="3.5" fill="#fff"/>`).join("");
 const cejas = tipo=="sorpresa" ? `<path d="M148 168 q20 -14 40 -2 M212 166 q20 -12 40 2" stroke="${pelo}" stroke-width="8" fill="none" stroke-linecap="round"/>` : dorm?"":`<path d="M150 178 q18 -8 36 0 M214 178 q18 -8 36 0" stroke="${pelo}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
 const boca = tipo=="feliz" ? `<path d="M176 248 q24 26 48 0 Z" fill="#7a1f2b"/><path d="M182 250 q18 8 36 0" stroke="#fff" stroke-width="5" fill="none"/>`
  : tipo=="sorpresa" ? `<ellipse cx="200" cy="256" rx="14" ry="18" fill="#7a1f2b"/>` : `<path d="M184 250 q16 8 32 0" stroke="#7a3a2a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
 const pelos = peinado==1 ? `<path d="M118 196 q-8 -96 82 -100 q92 2 84 100 q-14 -50 -44 -58 q-30 18 -84 4 q-26 20 -38 54 Z" fill="${pelo}"/>`
  : peinado==2 ? `<path d="M120 200 q-10 -100 80 -104 q90 4 82 104 q-6 -34 -26 -52 q-60 22 -112 -2 q-18 22 -24 54 Z" fill="${pelo}"/><circle cx="200" cy="86" r="26" fill="${pelo}"/>`
  : peinado==3 ? `<path d="M116 230 q-14 -130 84 -134 q100 4 86 134 q-10 -60 -30 -84 q-56 26 -110 0 q-20 24 -30 84 Z" fill="${pelo}"/><path d="M110 230 q-10 60 10 120 M290 230 q10 60 -10 120" stroke="${pelo}" stroke-width="28" stroke-linecap="round"/>`
  : `<path d="M122 190 q4 -86 78 -92 q80 4 80 92 q-30 -40 -80 -40 q-50 0 -78 40 Z" fill="${pelo}"/>`;
 const cuerpo = `<path d="M70 400 q4 -96 130 -100 q126 4 130 100 Z" fill="${ropa}"/><path d="M168 300 l32 34 l32 -34" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="10" stroke-linejoin="round"/><rect x="182" y="270" width="36" height="34" rx="10" fill="${piel}"/>`;
 const cabeza = `<ellipse cx="124" cy="214" rx="16" ry="22" fill="${piel}"/><ellipse cx="276" cy="214" rx="16" ry="22" fill="${piel}"/>
  <ellipse cx="200" cy="208" rx="78" ry="86" fill="${piel}"/><ellipse cx="200" cy="230" rx="78" ry="64" fill="rgba(0,0,0,.06)"/>
  <ellipse cx="150" cy="236" rx="16" ry="10" fill="#ff8a8a" opacity=".45"/><ellipse cx="250" cy="236" rx="16" ry="10" fill="#ff8a8a" opacity=".45"/>
  <path d="M196 214 q-8 14 4 18" stroke="rgba(0,0,0,.25)" stroke-width="5" fill="none" stroke-linecap="round"/>`;
 return `<svg viewBox="0 0 400 400" width="100%" height="100%" style="position:absolute;inset:0">${cuerpo}${cabeza}${pelos}${cejas}${ojos}${boca}${extra}</svg>`}
function mando(x=150,y=330,col="#222"){return `<g transform="translate(${x} ${y})"><rect x="0" y="0" width="100" height="46" rx="22" fill="${col}"/><circle cx="24" cy="22" r="7" fill="#888"/><circle cx="76" cy="16" r="5" fill="#e74c3c"/><circle cx="86" cy="28" r="5" fill="#3498db"/></g>`}
function caseta({x,y,w=440,col="#1f6e5a",pais,hora,persona:per="",fondo="#3b1d66",luz="#ffcf7a",extra=""}){
 const h=w*1.25, win=w*.84;
 return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.45))">
  <div style="position:absolute;left:-${w*.04}px;right:-${w*.04}px;top:0;height:${h*.07}px;border-radius:12px 12px 0 0;background:repeating-linear-gradient(90deg,${col} 0 ${w/10}px,#f4efe6 ${w/10}px ${w/5}px);box-shadow:inset 0 -8px 0 rgba(0,0,0,.18)"></div>
  <div style="position:absolute;left:0;right:0;top:${h*.07}px;height:${h*.12}px;background:${col};display:flex;align-items:center;justify-content:space-between;padding:0 ${w*.035}px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.25)"><span class="tagp" style="font-size:${w/16}px">${pais}</span>${hora?`<span class="reloj" style="font-size:${w/12}px">${hora}</span>`:""}</div>
  <div style="position:absolute;left:0;right:0;top:${h*.19}px;bottom:0;background:linear-gradient(180deg,${col},rgba(0,0,0,.35)),${col};border-radius:0 0 10px 10px"></div>
  <div style="position:absolute;left:${w*.08}px;right:${w*.08}px;top:${h*.23}px;height:${win}px;background:${fondo};border:7px solid #efe9f7;border-radius:8px;overflow:hidden;box-shadow:inset 0 0 60px rgba(0,0,0,.35),0 0 40px ${luz}55">
   <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,${luz}33,transparent 65%)"></div>${per}${extra}
   <div style="position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.10) 48%,rgba(255,255,255,0) 56%)"></div>
  </div>
  <div style="position:absolute;left:${w*.08}px;right:${w*.08}px;bottom:${h*.025}px;height:${h*.04}px;display:flex;justify-content:space-around">${[...Array(6)].map(()=>`<i style="width:${w*.035}px;height:${w*.035}px;border-radius:50%;background:#ffe9a8;box-shadow:0 0 12px #ffd36a"></i>`).join("")}</div>
 </div>`}
function calle(suelo="#191226",linea="#f2c94c",edif="#24163a"){return `<div style="position:absolute;left:0;right:0;top:1500px;bottom:0;background:${suelo}"></div>
 <div style="position:absolute;left:0;right:0;top:1640px;height:10px;background:repeating-linear-gradient(90deg,${linea} 0 70px,transparent 70px 130px)"></div>
 <div style="position:absolute;left:0;right:0;top:1150px;height:350px;opacity:.9;background:
  linear-gradient(${edif},${edif}) 40px 120px/120px 230px no-repeat,linear-gradient(${edif},${edif}) 200px 40px/150px 310px no-repeat,
  linear-gradient(${edif},${edif}) 720px 80px/140px 270px no-repeat,linear-gradient(${edif},${edif}) 900px 0/150px 350px no-repeat"></div>`}
function luna(x,y,s=1){return `<div style="position:absolute;left:${x}px;top:${y}px;width:${70*s}px;height:${70*s}px;border-radius:50%;box-shadow:${-14*s}px ${8*s}px 0 0 #f4f1ff;transform:rotate(-20deg)"></div>`}
function sol(x,y,c="#ffe08a"){return `<div style="position:absolute;left:${x}px;top:${y}px;width:110px;height:110px;border-radius:50%;background:${c};box-shadow:0 0 80px 30px rgba(255,210,120,.5)"></div>`}
function etiq(txt,glow=1,fondo="#d8ff1f",col="#1a0b33"){return `<div style="display:inline-block;padding:14px 26px;border-radius:20px;background:${fondo};color:${col};font:900 84px 'Inter Display';letter-spacing:-.04em;box-shadow:0 0 ${50*glow}px ${16*glow}px ${fondo}88">${txt}</div>`}
function portada(src,x,y,w,rot=0,borde="#d8ff1f"){return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${w*1.5}px;border-radius:12px;background:url(${src}) center/cover;box-shadow:0 0 0 6px ${borde},0 30px 60px rgba(0,0,0,.5);transform:rotate(${rot}deg)"></div>`}
function contador(t,t0,t1,de,a){return eur(de+(a-de)*eo(sg(t,t0,t1)))}
function cierre(lt,acento="#d8ff1f"){const k=eo(sg(lt,.3,1));
 return `<div style="position:absolute;left:0;right:0;top:${760+(1-k)*40}px;text-align:center;opacity:${k};font:900 110px 'Inter Display';letter-spacing:-.04em;color:#fff">pillaojuegos<span style="color:${acento}">.com</span></div>
  <div style="position:absolute;left:0;right:0;top:910px;text-align:center;opacity:${sg(lt,.8,1.2)};font:700 34px 'DejaVu Sans Mono';color:#ffd0ec;letter-spacing:.08em">TELEGRAM: PILLAO CHOLLOS</div>`}
// Karaoke: los precios y cifras tardan más (el locutor tarda más en decirlos)
function peso(w){const x=w.replace(/[*¿?¡!.,:…]/g,""); if(/\d/.test(x)) return x.length>3?3.6:2.2; if(/^(euros?|por|ciento|%)$/i.test(x)) return 1.4; return .7+Math.min(x.length,10)*.06}
function subt(t){const f=FRASES.find(f=>t>=f[0]&&t<f[1]+.25); if(!f) return "";
 const ws=f[2].split(" "), ps=ws.map(peso), tot=ps.reduce((a,b)=>a+b,0); let acc=f[0];
 return ws.map((w,i)=>{const k=w.includes("*"); w=w.replace(/\*/g,""); const d=(f[1]-f[0])*ps[i]/tot, ts=acc; acc+=d; const st=t>=ts+d?"ya":t>=ts?"on":"";
  return `<span class="${st} ${k&&t>=ts?"k":""}">${w}</span>`}).join(" ")}
function sello(txt,x,y,k,col="#ff4f6d"){return `<div style="position:absolute;left:${x}px;top:${y}px;padding:10px 22px;border:8px solid ${col};border-radius:14px;color:${col};font:900 64px 'Inter Display';letter-spacing:.02em;transform:rotate(-14deg) scale(${2.2-1.2*eb(k)});opacity:${cl(k*3)};background:rgba(0,0,0,.25)">${txt}</div>`}
function estrellas(n=90,alto=1300){let h="";for(let i=0;i<n;i++)h+=`<div style="position:absolute;left:${rnd(i)*1080}px;top:${rnd(i+90)*alto}px;width:${2+rnd(i+5)*3}px;height:${2+rnd(i+5)*3}px;border-radius:50%;background:#fff;opacity:${.2+rnd(i+7)*.6}"></div>`;return h}

// montaje común
document.write(`<div id="st"><div id="cielo"></div><div id="shader"></div><div id="estrellas"></div><div id="esc"></div>
 <div style="position:absolute;left:0;right:0;top:0;height:520px;background:linear-gradient(180deg,rgba(8,4,18,.7),rgba(8,4,18,0));z-index:4"></div><div id="sub"></div></div>`);
window.render=function(t){
 if(window.shaderFrame) window.shaderFrame(t*600);
 document.getElementById("esc").innerHTML=escena(t);
 document.getElementById("sub").innerHTML=subt(t);
};
window.iniciar=async function(colores){
 document.getElementById("cielo").style.background=PALETA.cielo;
 document.documentElement.style.setProperty("--acento",PALETA.acento||"#6aa8ff");
 await document.fonts.load('900 40px "Inter Display"'); await document.fonts.load('600 40px Inter'); await document.fonts.ready;
 await Promise.all([...(window.IMAGENES||[])].map(s=>new Promise(r=>{const i=new Image();i.onload=r;i.onerror=r;i.src=s})));
 try{const m=await import("https://cdn.jsdelivr.net/npm/@paper-design/shaders@0.0.82/+esm");
  const u={u_colors:PALETA.shader.map(m.getShaderColorFromString),u_colorsCount:PALETA.shader.length,u_distortion:.7,u_swirl:.25,u_grainMixer:.1,u_grainOverlay:.12,
   u_fit:m.ShaderFitOptions.cover,u_rotation:0,u_scale:1,u_offsetX:0,u_offsetY:0,u_originX:.5,u_originY:.5,u_worldWidth:0,u_worldHeight:0};
  const sm=new m.ShaderMount(document.getElementById("shader"),m.meshGradientFragmentShader,u,undefined,0,0,1,1080*1920);
  document.getElementById("shader").style.opacity=PALETA.shaderOpacidad??.9;
  window.shaderFrame=ms=>sm.setFrame(ms);}catch(e){console.log("SIN SHADER",e.message)}
 // vista previa: si no lo controla el grabador, se reproduce solo y se ajusta a la ventana
 if(!/grabar/.test(location.search)){
  const st=document.getElementById("st"), ajusta=()=>{const s=Math.min(innerWidth/1080,innerHeight/1920); st.style.transform=`scale(${s})`; document.body.style.width=1080*s+"px"; document.body.style.height=1920*s+"px"};
  ajusta(); addEventListener("resize",ajusta); document.documentElement.style.cssText+="width:auto;height:auto;background:#000"; document.body.style.margin="0 auto";
  const t0=performance.now(); const bucle=()=>{render(((performance.now()-t0)/1000)%DUR); requestAnimationFrame(bucle)}; bucle();
 }
};
