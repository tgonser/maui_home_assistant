import { useStore, Entity } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, 
  Power, 
  Thermometer, 
  Tv, 
  Blinds, 
  Activity,
  Play,
  Pause,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { motion } from "framer-motion";

export function getEntityIcon(kind: string) {
  switch (kind) {
    case 'light': return <Lightbulb className="w-5 h-5" />;
    case 'switch': return <Power className="w-5 h-5" />;
    case 'climate': return <Thermometer className="w-5 h-5" />;
    case 'media_player': return <Tv className="w-5 h-5" />;
    case 'cover': return <Blinds className="w-5 h-5" />;
    case 'binary_sensor':
    case 'sensor': return <Activity className="w-5 h-5" />;
    default: return <Power className="w-5 h-5" />;
  }
}

export function EntityCard({ entityId }: { entityId: string }) {
  const { parsed, liveState, updateEntityState } = useStore();
  const entity = parsed.entities.find(e => e.id === entityId);
  const state = liveState[entityId];

  if (!entity) return <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md">Entity not found: {entityId}</div>;

  const isOn = state?.state === 'on' || state?.state === 'playing' || state?.state === 'open';

  return (
    <Card className={`transition-colors duration-200 ${isOn ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isOn ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {getEntityIcon(entity.kind)}
          </div>
          <div>
            <div className="font-medium text-sm">{entity.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{state?.state}</div>
          </div>
        </div>
        {(entity.kind === 'light' || entity.kind === 'switch' || entity.kind === 'cover') && (
          <Switch 
            checked={isOn} 
            onCheckedChange={(c) => updateEntityState(entityId, { state: c ? (entity.kind === 'cover' ? 'open' : 'on') : (entity.kind === 'cover' ? 'closed' : 'off') })}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function LightCard({ entityId }: { entityId: string }) {
  const { parsed, liveState, updateEntityState } = useStore();
  const entity = parsed.entities.find(e => e.id === entityId);
  const state = liveState[entityId];

  if (!entity || entity.kind !== 'light') return null;

  const isOn = state?.state === 'on';
  const brightness = state?.brightness || 0;

  return (
    <Card className={`transition-colors duration-200 overflow-hidden ${isOn ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isOn ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="font-medium text-sm">{entity.name}</div>
          </div>
          <Switch 
            checked={isOn} 
            onCheckedChange={(c) => updateEntityState(entityId, { state: c ? 'on' : 'off', brightness: c ? 255 : 0 })}
          />
        </div>
        {isOn && (
          <div className="px-2">
            <Slider 
              value={[brightness]} 
              min={0} 
              max={255} 
              step={1}
              onValueChange={(v) => updateEntityState(entityId, { brightness: v[0] })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ThermostatCard({ entityId }: { entityId: string }) {
  const { parsed, liveState, updateEntityState } = useStore();
  const entity = parsed.entities.find(e => e.id === entityId);
  const state = liveState[entityId];

  if (!entity || entity.kind !== 'climate') return null;

  const targetTemp = state?.target_temperature || 70;
  const currentTemp = state?.current_temperature || 70;

  return (
    <Card className="bg-gradient-to-br from-card to-card border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 flex items-center justify-between bg-muted/30 border-b border-border">
           <div className="flex items-center gap-2 text-sm font-medium">
             <Thermometer className="w-4 h-4 text-secondary" />
             {entity.name}
           </div>
           <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
             {state?.state}
           </div>
        </div>
        <div className="p-6 flex flex-col items-center justify-center">
          <div className="text-5xl font-light tracking-tighter mb-1 text-foreground">
            {targetTemp}°
          </div>
          <div className="text-sm text-muted-foreground mb-6">
            Currently {currentTemp}°
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => updateEntityState(entityId, { target_temperature: targetTemp - 1 })}>
              <ChevronDown className="w-6 h-6" />
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => updateEntityState(entityId, { target_temperature: targetTemp + 1 })}>
              <ChevronUp className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MediaCard({ entityId }: { entityId: string }) {
  const { parsed, liveState, updateEntityState } = useStore();
  const entity = parsed.entities.find(e => e.id === entityId);
  const state = liveState[entityId];

  if (!entity || entity.kind !== 'media_player') return null;

  const isPlaying = state?.state === 'playing';

  return (
    <Card className="bg-card">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="h-12 w-12 bg-muted rounded-md flex items-center justify-center">
             <Tv className="w-6 h-6 text-muted-foreground" />
           </div>
           <div>
             <div className="font-medium text-sm">{entity.name}</div>
             <div className="text-xs text-muted-foreground">{state?.media_title || "Idle"}</div>
           </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full h-10 w-10 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          onClick={() => updateEntityState(entityId, { state: isPlaying ? 'paused' : 'playing' })}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
        </Button>
      </CardContent>
    </Card>
  );
}

export function GlanceCard({ entities, title }: { entities: string[], title?: string }) {
  const { parsed, liveState } = useStore();

  return (
    <Card className="bg-card">
      {title && (
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-4 flex flex-wrap gap-4">
        {entities.map(id => {
          const entity = parsed.entities.find(e => e.id === id);
          if (!entity) return null;
          const state = liveState[id];
          return (
            <div key={id} className="flex flex-col items-center gap-1 min-w-[60px]">
              <div className={`p-2 rounded-full ${state?.state === 'on' || state?.state === 'open' ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted'}`}>
                {getEntityIcon(entity.kind)}
              </div>
              <div className="text-xs font-medium max-w-[80px] truncate text-center" title={entity.name}>
                {state?.state} {state?.unit_of_measurement || ''}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
