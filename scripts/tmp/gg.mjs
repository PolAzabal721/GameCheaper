const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)","Accept-Language":"es-ES,es;q=0.9"};
const t=async u=>{const r=await fetch(u,{headers:H});return [r.status,await r.text()]};
const [s,sm]=await t("https://ggpick.com/sitemap.xml");const locs=[...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const c={};for(const u of locs){const k=u.replace(/^https:\/\/ggpick\.com\/\w+\//,'').split('/').slice(0,2).join('/').replace(/[a-z0-9-]+\/(steam-global-(key|account))/,'*/$1');c[k.split('/')[0]+'/'+(u.match(/steam-global-(key|account)|gift-card|subscriptions/)||['otro'])[0]]=(c[k.split('/')[0]+'/'+(u.match(/steam-global-(key|account)|gift-card|subscriptions/)||['otro'])[0]]||0)+1}
console.log(s,locs.length,c);
console.log(locs.filter(u=>/gift/.test(u)).slice(0,15));
for(const u of ["https://ggpick.com/en/games/borderlands-4-standard-edition/steam-global-key/", locs.find(u=>/gift-card\/./.test(u))||"https://ggpick.com/en/gift-card/"]){const [st,h]=await t(u);console.log('\n##',u,st,h.length);
 const ld=[...h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1].slice(0,600));console.log('LD',ld);
 const nx=h.match(/__NEXT_DATA__[^>]*>([\s\S]{0,1500})/);console.log('NEXT',nx&&nx[1].slice(0,1500));
 console.log([...new Set(h.match(/"(price|amount|currency|stock|inStock|region|sku)"\s*:\s*[^,}]{1,40}/g)||[])].slice(0,30));}
