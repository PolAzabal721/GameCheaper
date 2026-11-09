const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)","Accept-Language":"es-ES,es;q=0.9"};
const t=async(u)=>{try{const r=await fetch(u,{headers:H});return [r.status,await r.text()]}catch(e){return [0,String(e)]}};
const locs=(b)=>[...b.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
{const [s,b]=await t("https://www.playstation.com/es-es/sitemap.xml");const l=locs(b);console.log("PSM",s,l.length,l.slice(0,20).join("\n"));
 for(const u of l.filter(x=>/game/i.test(x)).slice(0,5)){const [s2,b2]=await t(u);const l2=locs(b2);console.log("  PSUB",u,s2,l2.length,l2.slice(0,2).join(" "),"| fc:",l2.filter(x=>/fc-2[67]|fifa/i.test(x)).join(" "));}}
{const [s,b]=await t("https://www.game.es/sitemap/sitemap_productos.xml");const l=locs(b);
 const seg=l.filter(x=>/semi|usad|segunda/i.test(x));console.log("GSEMI",seg.length,seg.slice(0,8).join(" "));
 const suf={};for(const u of l){const m=u.match(/-(ps5|ps4|nintendo-switch-2|nintendo-switch|xbox-series-x|xbox-one|pc)\/[a-z0-9]+$/);suf[m?m[1]:"otro"]=(suf[m?m[1]:"otro"]||0)+1}console.log("GSUF",JSON.stringify(suf));
 console.log("GOTRO",l.filter(u=>!/-(ps5|ps4|nintendo-switch-2|nintendo-switch|xbox-series-x|xbox-one|pc)\/[a-z0-9]+$/.test(u)).slice(0,25).join(" "));
 console.log("GZELDA",l.filter(u=>/zelda/.test(u)).slice(0,12).join(" "));
 for (const u of ["https://www.game.es/ea-sports-fc-27-ps5/264870", ...l.filter(u=>/ea-sports-fc-26-ps5/.test(u)).slice(0,1)]) {const [s3,p]=await t(u);
  const ld=(p.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)||[]).find(x=>/"@type":"Product"/.test(x))||"";
  let o={};try{o=JSON.parse(ld.replace(/^<script[^>]*>|<\/script>$/g,""))}catch(e){console.log("ldErr",e.message)}
  console.log("GPROD",u,s3,o.name,JSON.stringify(o.offers),o.sku,o.gtin13);
  const fl=[...p.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map(m=>{try{return JSON.parse('"'+m[1]+'"')}catch{return ""}}).join("");
  for (const m of [...fl.matchAll(/"platform":"[^"]*","platformName":"[^"]*"[^{}]{0,500}/g)].slice(0,6)) console.log("   FL",m[0].slice(0,420));
  const i=fl.indexOf("eminuevo");console.log("   SEMI",i,fl.slice(Math.max(0,i-300),i+200));
 }}
