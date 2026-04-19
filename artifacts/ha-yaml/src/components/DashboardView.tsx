import { useStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityCard, LightCard, ThermostatCard, MediaCard, GlanceCard, getEntityIcon } from "@/components/Cards";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Activity, Clock, TerminalSquare, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

function DashboardTab() {
  const { parsed } = useStore();
  const dashboard = parsed.dashboard;

  if (!dashboard || !dashboard.views || dashboard.views.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <TerminalSquare className="w-12 h-12 mb-4 opacity-20" />
        <p>No dashboard views defined.</p>
        <p className="text-sm opacity-60">Add a view in your YAML to see cards here.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {dashboard.views.map((view, i) => (
        <div key={i} className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            {view.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {view.cards?.map((card, j) => {
              return (
                <motion.div
                  key={j}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: j * 0.05 }}
                >
                  {card.type === 'light' && card.entity && <LightCard entityId={card.entity} />}
                  {card.type === 'thermostat' && card.entity && <ThermostatCard entityId={card.entity} />}
                  {card.type === 'media' && card.entity && <MediaCard entityId={card.entity} />}
                  {card.type === 'glance' && card.entities && <GlanceCard entities={card.entities} title={card.title} />}
                  {card.type === 'entities' && card.entities && (
                    <Card className="bg-card">
                      {card.title && <div className="px-4 pt-4 pb-2 text-sm font-medium text-muted-foreground">{card.title}</div>}
                      <div className="p-2 space-y-2">
                        {card.entities.map(e => <EntityCard key={e} entityId={e} />)}
                      </div>
                    </Card>
                  )}
                  {/* Fallback for basic entity card if type not explicitly handled but entity provided */}
                  {card.type === 'entity' && card.entity && <EntityCard entityId={card.entity} />}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DevicesTab() {
  const { parsed, liveState } = useStore();
  const { entities, areas } = parsed;

  const grouped = areas.map(area => ({
    ...area,
    entities: entities.filter(e => e.area === area.id)
  }));

  const unassigned = entities.filter(e => !e.area);
  if (unassigned.length > 0) {
    grouped.push({ id: 'unassigned', name: 'Unassigned', icon: 'help-circle', entities: unassigned });
  }

  // Synthesize fake history
  const sparklineData = Array.from({ length: 20 }, (_, i) => ({ value: 20 + Math.random() * 80 }));

  return (
    <div className="p-6 space-y-8">
      {grouped.map(area => {
        if (area.entities.length === 0) return null;
        return (
          <div key={area.id} className="space-y-4">
            <h3 className="font-medium text-muted-foreground">{area.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {area.entities.map(entity => {
                const state = liveState[entity.id];
                const isOn = state?.state === 'on' || state?.state === 'open' || state?.state === 'playing';
                
                return (
                  <Sheet key={entity.id}>
                    <SheetTrigger asChild>
                      <Card className={`cursor-pointer transition-all hover:bg-muted/50 ${isOn ? 'border-primary/30 bg-primary/5' : ''}`}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`p-2 rounded-full shrink-0 ${isOn ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted'}`}>
                            {getEntityIcon(entity.kind)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate" title={entity.name}>{entity.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{state?.state} {state?.unit_of_measurement || ''}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </SheetTrigger>
                    <SheetContent className="w-[400px] sm:w-[540px] border-l border-border bg-card">
                      <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10 text-primary">
                            {getEntityIcon(entity.kind)}
                          </div>
                          <div>
                            <div>{entity.name}</div>
                            <div className="text-xs font-normal text-muted-foreground font-mono">{entity.id}</div>
                          </div>
                        </SheetTitle>
                      </SheetHeader>
                      
                      <div className="space-y-6">
                        <div className="p-4 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Current State</span>
                          <span className="font-bold text-lg">{state?.state} {state?.unit_of_measurement || ''}</span>
                        </div>

                        {Object.keys(state || {}).filter(k => k !== 'state').length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Attributes</h4>
                            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                              {Object.entries(state || {}).filter(([k]) => k !== 'state').map(([k, v]) => (
                                <div key={k} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{k}</span>
                                  <span className="font-mono">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">State History (24h)</h4>
                          <div className="h-[100px] w-full rounded-lg border border-border bg-muted/10 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparklineData}>
                                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                                <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AutomationsTab() {
  const { parsed, runAutomation } = useStore();
  const { automations } = parsed;
  const { toast } = useToast();

  if (!automations || automations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <Activity className="w-12 h-12 mb-4 opacity-20" />
        <p>No automations defined.</p>
      </div>
    );
  }

  const handleRun = (id: string, alias: string) => {
    runAutomation(id);
    toast({
      title: "Automation Triggered",
      description: `Running "${alias}"...`,
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {automations.map((auto, i) => (
        <motion.div
          key={auto.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="bg-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">{auto.alias}</div>
                {auto.description && <div className="text-sm text-muted-foreground">{auto.description}</div>}
                <div className="text-xs text-muted-foreground font-mono mt-2 bg-muted/50 inline-block px-2 py-1 rounded">
                  {auto.id}
                </div>
              </div>
              <Button size="sm" onClick={() => handleRun(auto.id, auto.alias)}>
                <Play className="w-4 h-4 mr-2" />
                Run Actions
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function LogbookTab() {
  const { logs } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border bg-muted/30 shrink-0">
        <h2 className="font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Logbook
        </h2>
      </div>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-1">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No events yet.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="text-sm py-2 px-3 hover:bg-muted/50 rounded-md transition-colors flex items-start gap-4">
                <div className="text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                </div>
                <div className="flex-1">
                  <span>{log.message}</span>
                  {log.entity_id && <span className="text-muted-foreground ml-2 text-xs font-mono">({log.entity_id})</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DashboardView() {
  const { yamls, loadExamplePack } = useStore();
  const [activeTab, setActiveTab] = useState("dashboard");

  const isEmpty = !yamls.entities && !yamls.dashboard && !yamls.areas;

  if (isEmpty) {
    return (
      <div className="h-full flex items-center justify-center bg-card p-6">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold">Welcome to HA YAML Studio</h2>
          <p className="text-muted-foreground">
            A playful playground to write Home Assistant config and see it come alive instantly.
            No servers, no waiting, just immediate feedback.
          </p>
          <div className="pt-4">
            <Button size="lg" onClick={loadExamplePack} className="w-full sm:w-auto shadow-lg shadow-primary/20">
              Load Example Pack
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center px-4 h-12 border-b border-border bg-card shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent h-12 p-0 space-x-6 border-b-0 w-full justify-start overflow-x-auto">
            <TabsTrigger 
              value="dashboard" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 bg-transparent"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="devices" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 bg-transparent"
            >
              Devices
            </TabsTrigger>
            <TabsTrigger 
              value="automations" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 bg-transparent"
            >
              Automations
            </TabsTrigger>
            <TabsTrigger 
              value="logbook" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 bg-transparent"
            >
              Logbook
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "devices" && <DevicesTab />}
          {activeTab === "automations" && <AutomationsTab />}
          {activeTab === "logbook" && <LogbookTab />}
        </ScrollArea>
      </div>
    </div>
  );
}
