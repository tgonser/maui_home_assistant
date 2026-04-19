import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as yaml from 'js-yaml';

export type EntityKind = 'light' | 'switch' | 'sensor' | 'climate' | 'media_player' | 'cover' | 'binary_sensor';

export interface Entity {
  id: string;
  name: string;
  area?: string;
  kind: EntityKind;
  state: any;
  attributes: Record<string, any>;
}

export interface Area {
  id: string;
  name: string;
  icon?: string;
}

export interface Automation {
  id: string;
  alias: string;
  description?: string;
  trigger: any[];
  condition?: any[];
  action: any[];
}

export interface Script {
  id: string;
  alias: string;
  sequence: any[];
}

export interface DashboardCard {
  type: string;
  entity?: string;
  entities?: string[];
  title?: string;
  [key: string]: any;
}

export interface DashboardView {
  title: string;
  icon?: string;
  cards: DashboardCard[];
}

export interface Dashboard {
  views: DashboardView[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  entity_id?: string;
}

interface AppState {
  yamls: {
    entities: string;
    areas: string;
    automations: string;
    scripts: string;
    dashboard: string;
  };
  parsed: {
    entities: Entity[];
    areas: Area[];
    automations: Automation[];
    scripts: Script[];
    dashboard: Dashboard;
  };
  errors: {
    entities: string | null;
    areas: string | null;
    automations: string | null;
    scripts: string | null;
    dashboard: string | null;
  };
  liveState: Record<string, any>;
  logs: LogEntry[];
  
  setYaml: (key: keyof AppState['yamls'], value: string) => void;
  loadExamplePack: () => void;
  updateEntityState: (entityId: string, newState: any, message?: string) => void;
  addLog: (message: string, entity_id?: string) => void;
  runAutomation: (automationId: string) => void;
  runScript: (scriptId: string) => void;
}

const DEFAULT_YAMLS = {
  areas: `
- id: living_room
  name: Living Room
  icon: sofa
- id: kitchen
  name: Kitchen
  icon: chef-hat
- id: primary_bedroom
  name: Primary Bedroom
  icon: bed
- id: office
  name: Office
  icon: brief-case
- id: garage
  name: Garage
  icon: car
- id: backyard
  name: Backyard
  icon: tree-pine
`.trim(),
  entities: `
- id: light.living_room_main
  name: Living Room Main
  area: living_room
  kind: light
  state: "on"
  attributes:
    brightness: 255
    color_temp: 400

- id: light.living_room_lamp
  name: Reading Lamp
  area: living_room
  kind: light
  state: "off"
  attributes:
    brightness: 120

- id: switch.coffee_maker
  name: Coffee Maker
  area: kitchen
  kind: switch
  state: "off"
  attributes: {}

- id: sensor.living_room_temp
  name: Living Room Temperature
  area: living_room
  kind: sensor
  state: 72
  attributes:
    unit_of_measurement: "°F"

- id: climate.home_thermostat
  name: Home Thermostat
  area: living_room
  kind: climate
  state: "cool"
  attributes:
    current_temperature: 72
    target_temperature: 70
    hvac_modes: ["auto", "heat", "cool", "off"]

- id: media_player.living_room_tv
  name: Living Room TV
  area: living_room
  kind: media_player
  state: "playing"
  attributes:
    volume_level: 0.4
    media_title: "Stranger Things"

- id: cover.living_room_blinds
  name: Living Room Blinds
  area: living_room
  kind: cover
  state: "open"
  attributes:
    position: 100

- id: binary_sensor.garage_motion
  name: Garage Motion
  area: garage
  kind: binary_sensor
  state: "off"
  attributes:
    device_class: motion
`.trim(),
  automations: `
- id: auto_sunset_lights
  alias: "Sunset Lights"
  description: "Turn on living room lights at sunset"
  trigger:
    - platform: sun
      event: sunset
  action:
    - service: light.turn_on
      target:
        entity_id: light.living_room_main

- id: auto_garage_motion
  alias: "Garage Motion Lights"
  description: "Turn on garage light when motion is detected"
  trigger:
    - platform: state
      entity_id: binary_sensor.garage_motion
      to: "on"
  action:
    - service: light.turn_on
      target:
        entity_id: light.garage_main
`.trim(),
  scripts: `
- id: script.movie_mode
  alias: "Movie Mode"
  sequence:
    - service: light.turn_off
      target:
        entity_id: light.living_room_main
    - service: cover.close_cover
      target:
        entity_id: cover.living_room_blinds
    - service: media_player.turn_on
      target:
        entity_id: media_player.living_room_tv
`.trim(),
  dashboard: `
views:
  - title: Home
    icon: home
    cards:
      - type: glance
        title: Overview
        entities:
          - sensor.living_room_temp
          - binary_sensor.garage_motion
      
      - type: light
        entity: light.living_room_main
        
      - type: thermostat
        entity: climate.home_thermostat
        
      - type: media
        entity: media_player.living_room_tv
        
  - title: Rooms
    icon: layout-grid
    cards:
      - type: entities
        title: Living Room
        entities:
          - light.living_room_main
          - light.living_room_lamp
          - cover.living_room_blinds
          
      - type: entities
        title: Kitchen
        entities:
          - switch.coffee_maker
`.trim()
};

function parseYamlSafely<T>(content: string, fallback: T): { parsed: T; error: string | null } {
  try {
    if (!content.trim()) return { parsed: fallback, error: null };
    const parsed = yaml.load(content) as T;
    return { parsed: parsed || fallback, error: null };
  } catch (e: any) {
    return { parsed: fallback, error: e.message };
  }
}

function computeLiveState(entities: Entity[]) {
  const state: Record<string, any> = {};
  entities.forEach(e => {
    state[e.id] = { state: e.state, ...e.attributes };
  });
  return state;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      yamls: {
        entities: '',
        areas: '',
        automations: '',
        scripts: '',
        dashboard: '',
      },
      parsed: {
        entities: [],
        areas: [],
        automations: [],
        scripts: [],
        dashboard: { views: [] },
      },
      errors: {
        entities: null,
        areas: null,
        automations: null,
        scripts: null,
        dashboard: null,
      },
      liveState: {},
      logs: [],

      setYaml: (key, value) => {
        set((state) => {
          const newYamls = { ...state.yamls, [key]: value };
          
          let parsedEntities = state.parsed.entities;
          let newLiveState = state.liveState;
          const newErrors = { ...state.errors };
          const newParsed = { ...state.parsed };

          if (key === 'entities') {
            const { parsed, error } = parseYamlSafely<Entity[]>(value, []);
            parsedEntities = parsed || [];
            newErrors.entities = error;
            newParsed.entities = parsedEntities;
            
            // Only update live state for newly added entities or full resets
            // Preserve existing live state overrides
            const computed = computeLiveState(parsedEntities);
            Object.keys(computed).forEach(id => {
              if (newLiveState[id] === undefined) {
                newLiveState[id] = computed[id];
              }
            });
          } else if (key === 'areas') {
            const { parsed, error } = parseYamlSafely<Area[]>(value, []);
            newParsed.areas = parsed || [];
            newErrors.areas = error;
          } else if (key === 'automations') {
             const { parsed, error } = parseYamlSafely<Automation[]>(value, []);
             newParsed.automations = parsed || [];
             newErrors.automations = error;
          } else if (key === 'scripts') {
             const { parsed, error } = parseYamlSafely<Script[]>(value, []);
             newParsed.scripts = parsed || [];
             newErrors.scripts = error;
          } else if (key === 'dashboard') {
             const { parsed, error } = parseYamlSafely<Dashboard>(value, { views: [] });
             newParsed.dashboard = parsed || { views: [] };
             newErrors.dashboard = error;
          }

          return { yamls: newYamls, parsed: newParsed, errors: newErrors, liveState: newLiveState };
        });
      },

      loadExamplePack: () => {
        set((state) => {
          const parsedEntities = yaml.load(DEFAULT_YAMLS.entities) as Entity[];
          return {
            yamls: { ...DEFAULT_YAMLS },
            parsed: {
              entities: parsedEntities,
              areas: yaml.load(DEFAULT_YAMLS.areas) as Area[],
              automations: yaml.load(DEFAULT_YAMLS.automations) as Automation[],
              scripts: yaml.load(DEFAULT_YAMLS.scripts) as Script[],
              dashboard: yaml.load(DEFAULT_YAMLS.dashboard) as Dashboard,
            },
            errors: {
              entities: null,
              areas: null,
              automations: null,
              scripts: null,
              dashboard: null,
            },
            liveState: computeLiveState(parsedEntities),
            logs: [{ id: Date.now().toString(), timestamp: Date.now(), message: "Example pack loaded" }]
          };
        });
      },

      updateEntityState: (entityId, newState, message) => {
        set((state) => {
          const current = state.liveState[entityId] || {};
          const updated = { ...current, ...newState };
          const logMsg = message || `Updated ${entityId} to ${newState.state !== undefined ? newState.state : 'new attributes'}`;
          return {
            liveState: { ...state.liveState, [entityId]: updated },
            logs: [{ id: Date.now().toString() + Math.random(), timestamp: Date.now(), message: logMsg, entity_id: entityId }, ...state.logs].slice(0, 100)
          };
        });
      },

      addLog: (message, entity_id) => {
        set((state) => ({
          logs: [{ id: Date.now().toString() + Math.random(), timestamp: Date.now(), message, entity_id }, ...state.logs].slice(0, 100)
        }));
      },

      runAutomation: (automationId) => {
        const { parsed, addLog } = get();
        const auto = parsed.automations.find(a => a.id === automationId);
        if (auto) {
          addLog(`Triggered automation: ${auto.alias}`);
          // simulate actions roughly based on the YAML
        }
      },

      runScript: (scriptId) => {
        const { parsed, addLog } = get();
        const script = parsed.scripts.find(s => s.id === scriptId);
        if (script) {
          addLog(`Started script: ${script.alias}`);
        }
      }
    }),
    {
      name: 'ha-yaml-studio-storage',
      partialize: (state) => ({ yamls: state.yamls }), // Only persist YAMLs
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Trigger a re-parse of loaded YAMLs to hydrate parsed state and liveState
          state.setYaml('entities', state.yamls.entities);
          state.setYaml('areas', state.yamls.areas);
          state.setYaml('automations', state.yamls.automations);
          state.setYaml('scripts', state.yamls.scripts);
          state.setYaml('dashboard', state.yamls.dashboard);
        }
      }
    }
  )
);
