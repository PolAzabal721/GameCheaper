const H={"User-Agent":"Mozilla/5.0 (compatible; Pillao-comparador/2.0; +https://pillaojuegos.com)"};
for(const u of ["https://ggpick.com/en/subscriptions/ai/duolingo/","https://ggpick.com/en/subscriptions/vpn/nordvpn/"]){const h=await (await fetch(u,{headers:H})).text();
 const keys=[...new Set((h.match(/\\"[a-zA-Z_]{3,30}\\":/g)||[]))];console.log('\n##',u,keys.filter(k=>/price|amount|cost|sale|usd|eur|currency|offer|variant|product|plan|month|region|stock/i.test(k)).join(' '));
 for(const m of [...h.matchAll(/(Duolingo|NordVPN)[^<]{0,40}/g)].slice(0,6)) console.log('-',m[0]);
 const i=h.indexOf('\\"price\\":');let k=0;let j=i;while(j>=0&&k<4){console.log('P:',h.slice(j-400,j+200).replace(/\s+/g,' '));j=h.indexOf('\\"price\\":',j+10);k++}}
