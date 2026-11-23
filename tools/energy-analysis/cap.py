import json,datetime as dt,collections
S={k:{int(h):v for h,v in d.items()} for k,d in json.load(open('stats.json')).items()}
def hst(h): return dt.datetime.fromtimestamp(h*3600,dt.UTC).replace(tzinfo=None)-dt.timedelta(hours=10)
byday=collections.defaultdict(dict)
for h in S['s2_percentage_charged']:
    t=hst(h); byday[t.date()][t.hour]=h
print('date        SOC@9  SOC@17(max day) | S1:      S2:   | day solar-load (net kWh 9-17) S1 S2')
caps={'s1':[],'s2':[]}
for d in sorted(byday):
    hh=byday[d]
    if 9 not in hh or 16 not in hh: continue
    row=[]
    for s in ('s1','s2'):
        soc=S[f'{s}_percentage_charged']
        a=soc.get(hh[9]); b=soc.get(hh[16]); mx=max(soc.get(hh[x],0) for x in range(9,17) if x in hh)
        net=sum(S[f'{s}_solar_power'].get(hh[x],0)-S[f'{s}_load_power'].get(hh[x],0) for x in range(9,17) if x in hh)
        ch=sum(max(-S[f'{s}_battery_power'].get(hh[x],0),0) for x in range(9,17) if x in hh)
        row.append((a,b,mx,net,ch))
        if a is not None and b is not None and b-a>20 and mx<99: caps[s].append(ch/(b-a)*100)
    print(d, ' | '.join('%3.0f→%3.0f (max %3.0f) net %+5.1f chg %4.1f'%r for r in row))
for s in caps: 
    c=sorted(caps[s]); print(s,'implied usable kWh (median of',len(c),')', round(c[len(c)//2],1) if c else None)
