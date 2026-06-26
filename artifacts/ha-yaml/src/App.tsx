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

// Injected by the Express server when running under HA ingress.
const ingressBase = (window as { __HA_INGRESS_BASE__?: string }).__HA_INGRESS_BASE__;

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

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function App() {
  // When __HA_INGRESS_BASE__ is present we are running as an HA add-on.
  // Skip Wouter entirely — path-based routing is meaningless inside the
  // ingress iframe and has caused persistent 404s due to base-path math.
  if (ingressBase) {
    return (
      <AppProviders>
        <Wall />
      </AppProviders>
    );
  }

  return (
    <AppProviders>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/wall" component={Wall} />
          <Route component={NotFound} />
        </Switch>
      </WouterRouter>
    </AppProviders>
  );
}

export default App;
