import json,sys,datetime as dt
raw=json.load(open(sys.argv[1])); d=json.loads(json.loads(raw[0]['text'].split('\n\n(captured')[0].strip()))
s2=[(int(t),float(v)) for t,v in (p.split(':',1) for p in d['sensor.4680_system_2_load_power'].split(',') if p) if v.replace('.','',1).isdigit()]
H=lambda t: (dt.datetime.fromtimestamp(t,dt.UTC)-dt.timedelta(hours=10)).replace(tzinfo=None)
# count ~4.5kW up-steps (3.8-5.2) per 6h block, last 14 days
import collections
c=collections.Counter()
for (t0,v0),(t1,v1) in zip(s2,s2[1:]):
    if 3.8<=v1-v0<=5.2: h=H(t1); c[(h.date(),h.hour//6)]+=1
for k in sorted(c): 
    if k[0]>=dt.date(2026,10,30): print(k[0], f'{k[1]*6:02d}-{k[1]*6+6:02d}h', '#'*c[k], c[k])
print('last sample', H(s2[-1][0]))
