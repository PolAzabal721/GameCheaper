const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://github.com/PolAzabal721/GameCheaper)","Accept-Language":"es-ES,es;q=0.9"};
const t=async(u)=>{try{const r=await fetch(u,{headers:H});return [r.status,await r.text(),r.url]}catch(e){return [0,String(e),""]}};
const locs=(b)=>[...b.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
{const [s,b]=await t("https://www.playstation.com/es-es/sitemap.xml");const l=locs(b);const g=l.filter(x=>/\/games\//.test(x));console.log("PSG",g.length,g.filter(x=>/fc|fifa/i.test(x)).join(" "));}
for (const u of ["https://store.playstation.com/es-es/pages/browse/1","https://store.playstation.com/es-es/pages/browse/2","https://store.playstation.com/es-es/search/EA%20SPORTS%20FC%2027"]) {
  const [s,b,fin]=await t(u);console.log("PSB",u,s,fin,b.length);
  const nd=b.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if(nd){let d;try{d=JSON.parse(nd[1])}catch(e){console.log("ndErr")};const ap=d?.props?.apolloState||d?.props?.pageProps?.apolloState||{};const ks=Object.keys(ap);console.log("  apollo keys",ks.length,ks.slice(0,15).join(" "));
    const prods=ks.filter(k=>/^(Product|Concept):/.test(k));console.log("  prods",prods.length);for(const k of prods.slice(0,8))console.log("   ",k,JSON.stringify(ap[k]).slice(0,400));
    console.log("  pageProps keys",Object.keys(d?.props?.pageProps||{}).join(","));}
  const ids=[...new Set([...b.matchAll(/(concept|product)\/([A-Z0-9_-]{6,})/g)].map(m=>m[0]))];console.log("  links",ids.length,ids.slice(0,10).join(" "));
  const pr=[...b.matchAll(/"(?:basePrice|discountedPrice|price)":"?([^",}]+)/g)].slice(0,5).map(m=>m[0]);console.log("  prices",pr.join(" "));
}
