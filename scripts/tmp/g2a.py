import csv,sys,collections,re
for f in sys.argv[1:]:
    rows=list(csv.DictReader(open(f,encoding='utf-8',errors='replace'),delimiter=';'))
    print('==',f,len(rows)); print(list(rows[0].keys()))
    for r in rows[:3]: print({k:(v[:90] if v else v) for k,v in r.items()})
    c=collections.Counter(); cat=collections.Counter(); cur=collections.Counter()
    for r in rows:
        n=r.get('name','');m=re.search(r'\b(GLOBAL|EUROPE|EU|NORTH AMERICA|LATAM|LATIN AMERICA|UNITED STATES|ROW|MEXICO|ARGENTINA|BRAZIL|SPAIN|GERMANY|ITALY|FRANCE|UNITED KINGDOM|TURKEY|INDIA)\b',n,re.I)
        c[m.group(1).upper() if m else '?']+=1; cat[r.get('categoryId') or r.get('category','')]+=1; cur[r.get('currencyId','')]+=1
    print(c.most_common(15)); print(cat.most_common(15)); print(cur)
    print([r['name'] for r in rows if 'grand theft auto v' in r.get('name','').lower()][:8])
