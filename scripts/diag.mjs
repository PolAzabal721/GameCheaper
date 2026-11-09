const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)","Accept-Language":"es-ES,es;q=0.9"};
const t=async(u)=>{try{const r=await fetch(u,{headers:H});return [r.status,await r.text()]}catch(e){return [0,String(e)]}};
const locs=(b)=>[...b.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
for (const q of ["EA SPORTS FC","EA SPORTS FC™ 27","EA SPORTS FC 26","ea sports fc 27"]) {const [s,b]=await t(`https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=es-ES&productFamilyNames=Games&query=${encodeURIComponent(q)}`);let p=[];try{p=JSON.parse(b).Results.flatMap(r=>r.Products)}catch{};console.log("MS",q,s,p.map(x=>x.ProductId+" "+x.Title).join(" || "));}
// xbox sitemap
{const [s,b]=await t("https://www.xbox.com/sitemap.xml");const l=locs(b);console.log("XSM",s,l.length,l.filter(x=>/es-es|games|store/i.test(x)).slice(0,30).join("\n"));
 for(const u of l.filter(x=>/es-es/i.test(x)&&/game|store|product/i.test(x)).slice(0,4)){const [s2,b2]=await t(u);const l2=locs(b2);console.log("  XSUB",u,s2,b2.length,l2.length,l2.slice(0,3).join(" "),"| fc27:",l2.filter(x=>/fc-27/i.test(x)).join(" "));}}
// GAME
{const [s,b]=await t("https://www.game.es/sitemap/sitemap_productos.xml");const l=locs(b);console.log("GSM",s,b.length,l.length,l.slice(0,5).join(" "));
 const fc=l.filter(x=>/fc-27/i.test(x));console.log("  fc27:",fc.join("\n  "));
 if(l.length<5 && /sitemapindex/.test(b))console.log(b.slice(0,800));
 if(fc[0]){const [s3,p]=await t(fc[0]);console.log("GPROD",s3,p.length);const m=p.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)||[];for(const x of m)console.log("  LD",x.slice(0,700));
   const fl=[...p.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)].map(m=>{try{return JSON.parse('"'+m[1]+'"')}catch{return ""}}).join("");
   for(const k of ['"pricing"','"availability"','"platform"','"title"']){const i=fl.indexOf(k);console.log("  FL",k,i,fl.slice(i,i+250))}}}
// PlayStation sitemap
{const [s,b]=await t("https://www.playstation.com/sitemap_index.xml");const l=locs(b);console.log("PSM",s,l.length,l.filter(x=>/es-es/i.test(x)).join("\n"));
 for(const u of l.filter(x=>/es-es/i.test(x)&&/game/i.test(x)).slice(0,3)){const [s2,b2]=await t(u);const l2=locs(b2);console.log("  PSUB",u,s2,l2.length,"| fc:",l2.filter(x=>/fc-2[67]/i.test(x)).join(" "));}}
