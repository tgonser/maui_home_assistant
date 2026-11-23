import json,sys,collections,datetime as dt
raw=json.load(open(sys.argv[1]))
txt=(raw[0]["text"] if isinstance(raw,list) else raw).split("\n\n(captured")[0].strip()
d=json.loads(json.loads(txt))
S={}
for k,v in d.items():
    S[k]={}
    for p in v.split(','):
        h,m=p.split(':')
        if m!='': S[k][int(h)]=float(m)
json.dump(S,open('stats.json','w'))
hours=sorted(set().union(*[set(x) for x in S.values()]))
def hst(h): return dt.datetime.utcfromtimestamp(h*3600)-dt.timedelta(hours=10)
# evening-night block: 17:00 day D to 09:00 D+1 (HST)
blocks=collections.defaultdict(lambda: collections.defaultdict(float))
for h in hours:
    t=hst(h)
    if t.hour>=17: key=t.date()
    elif t.hour<9: key=t.date()-dt.timedelta(days=1)
    else: continue
    b=blocks[key]
    for s in ('s1','s2'):
        if h not in S[f'{s}_load_power']: b[s+'_miss']+=1; continue
        b[s+'_load']+=S[f'{s}_load_power'][h]
        bp=S[f'{s}_battery_power'].get(h,0); b[s+'_batt']+=max(bp,0)
        gp=S[f'{s}_grid_power'].get(h,0); b[s+'_grid']+=max(gp,0)
        b[s+'_n']+=1
    for s in ('s1','s2'):
        soc=S[f'{s}_percentage_charged'].get(h)
        if soc is not None: b[s+'_socmin']=min(b.get(s+'_socmin',101),soc)
print('night(17-09)   n1 n2 | S1 load batt grid minSOC | S2 load batt grid minSOC')
tot=collections.defaultdict(float);cnt=0
for k in sorted(blocks):
    b=blocks[k]
    if b['s1_n']<15 or b['s2_n']<15: 
        print(k,'partial',int(b['s1_n']),int(b['s2_n']));continue
    cnt+=1
    for x in ('s1_load','s1_batt','s1_grid','s2_load','s2_batt','s2_grid'): tot[x]+=b[x]
    print(k, int(b['s1_n']),int(b['s2_n']),'| %5.1f %5.1f %5.1f %4.0f%% | %5.1f %5.1f %5.1f %4.0f%%'%(b['s1_load'],b['s1_batt'],b['s1_grid'],b['s1_socmin'],b['s2_load'],b['s2_batt'],b['s2_grid'],b['s2_socmin']))
print('avg over',cnt,{k:round(v/cnt,1) for k,v in tot.items()})
# daytime solar and loads 9-17
day=collections.defaultdict(lambda: collections.defaultdict(float))
for h in hours:
    t=hst(h)
    if 9<=t.hour<17:
        for s in ('s1','s2'):
            for q in ('load_power','solar_power'):
                v=S[f'{s}_{q}'].get(h)
                if v is not None: day[t.date()][s+q]+=v
n=len(day); print('daytime 9-17 avg kWh', {k: round(sum(day[d][k] for d in day)/n,1) for k in ('s1load_power','s1solar_power','s2load_power','s2solar_power')})
# hourly profile of load by HST hour
prof=collections.defaultdict(list)
for h in hours:
    t=hst(h)
    a=S['s1_load_power'].get(h); b=S['s2_load_power'].get(h)
    if a is not None and b is not None: prof[t.hour].append((a,b))
print('hour  S1load S2load (kW avg)')
for hr in range(24): 
    L=prof[hr]; print(hr, round(sum(x for x,_ in L)/len(L),2), round(sum(y for _,y in L)/len(L),2))
