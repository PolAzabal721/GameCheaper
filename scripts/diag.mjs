const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)","Accept-Language":"es-ES,es;q=0.9"};
const t=async(u)=>{try{const r=await fetch(u,{headers:H});return [r.status,await r.text(),r.headers.get("content-type")]}catch(e){return [0,String(e),""]}};
// MS
for (const q of ["halo infinite","EA SPORTS FC 27","fc 27","forza horizon 5"]) {
  for (const lang of ["es-ES","es-es"]) {const [s,b]=await t(`https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?market=ES&languages=${lang}&productFamilyNames=Games&query=${encodeURIComponent(q)}`);console.log("MS",q,lang,s,b.length,b.slice(0,200));}
}
{const [s,b]=await t("https://www.xbox.com/robots.txt");console.log("XBOX ROBOTS",s,b.slice(0,1500));}
{const [s,b]=await t("https://www.xbox.com/es-ES/search/results/games?q=EA%20SPORTS%20FC%2027");console.log("XBOX SEARCH",s,b.length,[...new Set([...b.matchAll(/store\/[a-z0-9-]+\/([0-9A-Z]{12})/g)].map(m=>m[0]))].slice(0,10).join(" "));const i=b.indexOf("__PRELOADED_STATE__");console.log("preloaded",i,b.slice(i,i+300));}
// GAME sitemap
{const [s,b]=await t("https://www.game.es/sitemap/sitemap.xml");console.log("GAME SITEMAP",s,b.length,b.slice(0,1500));}
// PS store search
{const [s,b]=await t("https://store.playstation.com/es-es/search/EA%20SPORTS%20FC%2027");console.log("PS SEARCH",s,b.length);
 console.log([...new Set([...b.matchAll(/(concept|product)\/([A-Z0-9_-]{6,})/g)].map(m=>m[0]))].slice(0,20).join(" "));
 const i=b.indexOf("__NEXT_DATA__");console.log("next",i);
 for(const m of [...b.matchAll(/"name":"([^"]{3,80})"[^{}]{0,400}?"basePrice":"([^"]*)"[^{}]{0,200}?"discountedPrice":"([^"]*)"/g)].slice(0,15))console.log("  ",m[1],m[2],m[3]);
 for(const m of [...b.matchAll(/"id":"([^"]+)","name":"([^"]+)"/g)].slice(0,15))console.log("  id",m[1],m[2]);
}
