import json,sys,datetime as dt,statistics as st
raw=json.load(open(sys.argv[1])); d=json.loads(json.loads(raw[0]['text'].split('\n\n(captured')[0].strip()))
def ser(k): return [(int(t),float(v)) for t,v in (p.split(':',1) for p in d[k].split(',') if p) if v.replace('.','',1).replace('-','',1).isdigit()]
s1=ser('sensor.gonser_4680_system_1_load_power'); s2=ser('sensor.4680_system_2_load_power')
H=lambda t: dt.datetime.fromtimestamp(t,dt.UTC)-dt.timedelta(hours=10)
import collections
for name,S in (('S1',s1),('S2',s2)):
    b=collections.defaultdict(list)
    for t,v in S: h=H(t); b[(h.date(),h.hour)].append(v)
    print(name,'hourly avg kW, nights 5pm-9am (HST)')
    days=sorted({k[0] for k in b})[-8:]
    for day in days[:-1]:
        row=[]
        for hr in list(range(17,24))+list(range(0,9)):
            dd=day if hr>=17 else day+dt.timedelta(days=1)
            v=b.get((dd,hr)); row.append(f'{st.mean(v):4.1f}' if v else '  - ')
        print(day,' '.join(row))
# S2 step detection on nights of 11/3 and 11/4: big jumps >1.5kW
print('S2 jumps > 1.5 kW, Nov 3 15:00 - Nov 5 12:00 HST')
for (t0,v0),(t1,v1) in zip(s2,s2[1:]):
    h=H(t1)
    if dt.datetime(2026,11,3,15)<=h.replace(tzinfo=None)<=dt.datetime(2026,11,5,12) and abs(v1-v0)>1.5:
        print(h.strftime('%m/%d %H:%M'), f'{v0:5.1f} -> {v1:5.1f}')
