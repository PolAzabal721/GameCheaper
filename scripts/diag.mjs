const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)","Accept-Language":"es-ES,es;q=0.9"};
const t=async(u)=>{const r=await fetch(u,{headers:H});return [r.status,await r.text()]};
function bloqueJSON(texto, desde){let i=texto.indexOf("{",desde),p=0,e=false;for(let k=i;k<texto.length;k++){const c=texto[k];if(e){if(c==="\\")k++;else if(c==='"')e=false;continue}if(c==='"')e=true;else if(c==="{")p++;else if(c==="}"&&--p===0)return texto.slice(i,k+1)}return null}
for (const q of ["EA SPORTS FC 27","EA Sports FC 27 Ultimate Edition"]) {
  const [s,html]=await t("https://www.game.es/resultados?search="+encodeURIComponent(q));
  const fl=[...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map(m=>{try{return JSON.parse('"'+m[1]+'"')}catch{return ""}}).join("");
  const i=fl.indexOf('"initialResult":');console.log("GAME",q,s,i);
  if(i>=0){const it=JSON.parse(bloqueJSON(fl,i)).items||[];for(const x of it.slice(0,15))console.log("  ",x.title,"|",x.category,"|",x.allPlatforms,"|",x.isPack,"|",JSON.stringify(x.pricing),"|",x.availability,"|",JSON.stringify(x.tag))}
  const [s2,sug]=await t(`https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=es-ES&productFamilyNames=Games&query=${encodeURIComponent(q)}`);
  let js={};try{js=JSON.parse(sug)}catch{}
  const ps=(js.Results||[]).flatMap(r=>r.Products||[]);console.log("MS",s2,ps.map(p=>p.ProductId+" "+p.Title).join(" || "));
  if(ps.length){const [s3,d]=await t(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ps.slice(0,5).map(p=>p.ProductId).join(",")}&market=ES&languages=es-es`);
    for(const p of JSON.parse(d).Products||[]){console.log("  MSP",p.ProductId,p.LocalizedProperties?.[0]?.ProductTitle);for(const s of p.DisplaySkuAvailabilities||[])for(const a of s.Availabilities||[]){const pr=a.OrderManagementData?.Price;if(pr)console.log("     ",s.Sku?.LocalizedProperties?.[0]?.SkuTitle,pr.CurrencyCode,pr.ListPrice,pr.MSRP,(a.Actions||[]).join(","))}}}
}
for (const u of ["https://www.playstation.com/es-es/games/ea-sports-fc-27/","https://www.playstation.com/es-es/games/ea-sports-fc-26/","https://store.playstation.com/robots.txt","https://www.playstation.com/robots.txt","https://www.game.es/robots.txt"]) {
  const [s,b]=await t(u); console.log("URL",u,s, u.endsWith("robots.txt")? "\n"+b.slice(0,1500) : [...new Set([...b.matchAll(/concept\/(\d+)/g)].map(m=>m[1]))].join(","));
}
