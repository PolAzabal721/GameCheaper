import xml.etree.ElementTree as ET, collections, sys, re
C=collections.Counter(); R=collections.Counter(); P=collections.Counter(); S=collections.Counter(); tags=collections.Counter(); ej={}
for ev,el in ET.iterparse(sys.argv[1]):
    if el.tag!='product': continue
    for ch in el: tags[ch.tag]+=1
    g=lambda k:(el.findtext(k) or '').strip()
    n=g('name')
    if re.search(r'account',n,re.I): S['account']+=1; el.clear(); continue
    C[g('category')]+=1; R[g('region')]+=1; P[g('platform')+' | '+g('drm')]+=1; S[g('stock')]+=1
    ej.setdefault(g('category'),n+' | '+g('price')+' | '+g('region'))
    el.clear()
print('TAGS',tags.most_common()); print('STOCK',S.most_common())
print('CAT'); [print(' ',c,k,'::',ej[k]) for k,c in C.most_common(80)]
print('REG',R.most_common(60)); print('PLAT',P.most_common(40))
