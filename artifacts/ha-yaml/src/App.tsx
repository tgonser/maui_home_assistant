import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { TopBar } from "@/components/TopBar";
import { YamlEditor } from "@/components/YamlEditor";
import { DashboardView } from "@/components/DashboardView";
import { Wall } from "@/components/Wall";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={40} minSize={20} className="h-full">
            <YamlEditor />
          </ResizablePanel>
          <ResizableHandle withHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors" />
          <ResizablePanel defaultSize={60} minSize={30} className="h-full">
            <DashboardView />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function Router() {
  // When running as an HA add-on, __HA_INGRESS_BASE__ is injected by the
  // server.  The add-on always opens at the ingress root ("/"), so we render
  // Wall there instead of the YAML editor to avoid needing a sub-path.
  const isAddon = !!(window as { __HA_INGRESS_BASE__?: string }).__HA_INGRESS_BASE__;
  return (
    <Switch>
      <Route path="/" component={isAddon ? Wall : Home} />
      <Route path="/wall" component={Wall} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={((window as { __HA_INGRESS_BASE__?: string }).__HA_INGRESS_BASE__ ?? import.meta.env.BASE_URL).replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
