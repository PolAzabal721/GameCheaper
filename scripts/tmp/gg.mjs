const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)"};
const sm=await (await fetch("https://ggpick.com/sitemap.xml",{headers:H})).text();const locs=[...new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).filter(u=>/\/en\/subscriptions\//.test(u)&&!/account|bundle/.test(u)))];
console.log(locs.length,locs.map(u=>u.replace('https://ggpick.com/en/subscriptions/','')).join(' '));
for(const u of [locs.find(u=>/duolingo\/$/.test(u)),locs.find(u=>/nordvpn\/./.test(u))||locs.find(u=>/nordvpn/.test(u))]){const h=await (await fetch(u,{headers:H})).text();console.log('\n##',u,h.length);
 console.log([...h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1].slice(0,500)));
 const i=h.search(/\$\d|USD|"price"/);console.log(h.slice(Math.max(0,i-1500),i+800).replace(/\s+/g,' '));
 console.log([...new Set(h.match(/\\?"(price|amount|name|title|currency|duration|sku)\\?"\s*:\s*\\?"?[^,}]{1,60}/g)||[])].slice(0,40));}
