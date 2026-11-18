const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)","Accept-Language":"es-ES,es;q=0.9"};
const t=async u=>{const r=await fetch(u,{headers:H});return [r.status,await r.text()]};
const [s,sm]=await t("https://ggpick.com/sitemap.xml");const locs=[...new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]))];
const ej=[locs.find(u=>/\/games\/[^/]+\/$/.test(u)&&!/games\/$/.test(u)),locs.find(u=>/gift-card\/steam/.test(u)),locs.find(u=>/subscriptions\/.+\/$/.test(u)&&!/account/.test(u)),locs.find(u=>/top-up\/./.test(u))];
console.log(ej);console.log(locs.filter(u=>/subscriptions\//.test(u)).slice(0,40).map(u=>u.replace('https://ggpick.com/en/','')).join(' '));
for(const u0 of ej){for(const u of [u0,u0.replace('/en/','/es/')]){const [st,h]=await t(u);
 const ld=[...h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 console.log('\n##',u,st);for(const l of ld){try{const j=JSON.parse(l);const g=j['@graph']||[j];for(const p of g)if(p['@type']==='Product')console.log(JSON.stringify({name:p.name,offers:p.offers}).slice(0,1200))}catch(e){}}}}
