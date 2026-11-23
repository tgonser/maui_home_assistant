import json,bisect,statistics as st,sys
raw=json.load(open(sys.argv[1]))
txt=raw[0]['text'].split('\n\n(captured')[0].strip()
d=json.loads(json.loads(txt))
def ser(k): 
    pts=[]
    for p in d[k].split(','):
        if not p: continue
        t,v=p.split(':',1)
        try: pts.append((int(t),float(v)))
        except: pass
    return pts
L={'s1':ser('sensor.gonser_4680_system_1_load_power'),'s2':ser('sensor.4680_system_2_load_power')}
print({k:len(v) for k,v in L.items()}, 'median gap s', {k: st.median([b[0]-a[0] for a,b in zip(v,v[1:])]) for k,v in L.items()})
LT={k:[t for t,_ in v] for k,v in L.items()}
def avg(s,a,b):
    T=LT[s];V=L[s];i=bisect.bisect_right(T,a)-1;i=max(i,0);vals=[]
    while i<len(T) and T[i]<=b: vals.append(V[i][1]); i+=1
    return st.mean(vals) if vals else None
ev=[]
for k,v in d.items():
    if not k.startswith('climate'): continue
    prev=None
    for p in v.split(','):
        if not p: continue
        t,a=p.split(':',1); t=int(t)
        if prev is not None and (a=='cooling')!=(prev=='cooling'): ev.append((t,k,+1 if a=='cooling' else -1))
        prev=a
ev.sort()
res={}
for i,(t,k,sg) in enumerate(ev):
    if any(abs(t2-t)<300 and k2!=k for t2,k2,_ in ev[max(0,i-20):i+20]): continue
    r=[]
    for s in ('s1','s2'):
        a=avg(s,t-240,t-30); b=avg(s,t+60,t+300)
        if a is None or b is None: break
        r.append(sg*(b-a))
    else: res.setdefault(k,[]).append(r)
print('thermostat         n   median kW step S1   S2   | share of events with bigger step on S1')
for k in sorted(res):
    r=res[k]; m1=st.median(x[0] for x in r); m2=st.median(x[1] for x in r); share=sum(1 for x in r if x[0]>x[1])/len(r)
    print(f'{k:24s}{len(r):4d}   {m1:5.2f} {m2:5.2f}   {share:.0%}')
print()
import datetime as dt, collections
end=max(t for t,_ in L['s1']); start=min(t for t,_ in L['s1']); days=(end-start)/86400
print('days',round(days,1))
for k,v in d.items():
    if not k.startswith('climate'): continue
    pts=[(int(p.split(':',1)[0]),p.split(':',1)[1]) for p in v.split(',') if p]
    on=collections.defaultdict(float)
    for (t,a),(t2,_) in zip(pts,pts[1:]+[(end,None)]):
        if a!='cooling': continue
        x=t
        while x<t2:
            h=(dt.datetime.fromtimestamp(x,dt.UTC)-dt.timedelta(hours=10)).hour
            nxt=min(t2,(x//3600+1)*3600); on['day' if 9<=h<17 else 'peak' if 17<=h<21 else 'night']+=(nxt-x)/3600; x=nxt
    print(f"{k:22s} transitions {len(pts):4d}  cooling h/day: day {on['day']/days:4.1f} peak {on['peak']/days:4.1f} night {on['night']/days:4.1f}")
