import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Play, Download, Upload } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import * as yaml from "js-yaml";

type TabKey = "entities" | "areas" | "automations" | "scripts" | "dashboard";

export function YamlEditor() {
  const { yamls, setYaml, loadExamplePack, errors } = useStore();
  const [activeTab, setActiveTab] = useState<TabKey>("entities");
  const { resolvedTheme } = useTheme();
  
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setYaml(activeTab, value);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = yaml.load(yamls[activeTab]);
      const formatted = yaml.dump(parsed, { indent: 2 });
      setYaml(activeTab, formatted);
    } catch (e) {
      // Cannot format invalid yaml
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          <TabsList className="grid grid-cols-5 w-full h-9">
            <TabsTrigger value="entities" className="text-xs">Entities</TabsTrigger>
            <TabsTrigger value="areas" className="text-xs">Areas</TabsTrigger>
            <TabsTrigger value="automations" className="text-xs">Automations</TabsTrigger>
            <TabsTrigger value="scripts" className="text-xs">Scripts</TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <Button variant="outline" size="sm" onClick={handleFormat}>
          Format
        </Button>
        <Button variant="outline" size="sm" onClick={loadExamplePack}>
          Load Example Pack
        </Button>
      </div>

      <div className="flex-1 relative">
        <Editor
          height="100%"
          language="yaml"
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
          value={yamls[activeTab]}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            renderWhitespace: "selection",
          }}
        />
        {errors[activeTab] && (
          <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground p-3 text-sm font-mono z-10 break-words">
            {errors[activeTab]}
          </div>
        )}
      </div>
    </div>
  );
}
