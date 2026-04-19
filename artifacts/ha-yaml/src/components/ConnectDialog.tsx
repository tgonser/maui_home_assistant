import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHAStore, haTest } from "@/lib/ha";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plug, PlugZap, Unplug } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_URL =
  "https://ujloq919zfapojmcvd977ybzihxfmorf.ui.nabu.casa";

export function ConnectDialog({ open, onOpenChange }: Props) {
  const { url, token, status, setCredentials, setStatus, clear } = useHAStore();
  const [draftUrl, setDraftUrl] = useState(url || DEFAULT_URL);
  const [draftToken, setDraftToken] = useState(token);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setCredentials(draftUrl, draftToken);
    setTesting(true);
    setStatus("connecting");
    const result = await haTest();
    setTesting(false);
    if (result.ok) {
      setStatus("connected");
      toast({
        title: "Connected to Home Assistant",
        description: `Linked to ${result.data.location_name} (HA ${result.data.version}).`,
      });
      onOpenChange(false);
    } else {
      setStatus("error", result.error);
      toast({
        title: "Could not connect",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    clear();
    setDraftUrl("");
    setDraftToken("");
    toast({ title: "Disconnected from Home Assistant" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="w-5 h-5 text-primary" />
            Connect to Home Assistant
          </DialogTitle>
          <DialogDescription>
            Paste your Nabu Casa URL and a long-lived access token. Both stay
            in your browser; requests are routed through this app's proxy so
            you don't need to change CORS settings on your HA instance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ha-url">Base URL</Label>
            <Input
              id="ha-url"
              placeholder="https://xxxxxxxx.ui.nabu.casa"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ha-token">Long-lived access token</Label>
            <Input
              id="ha-token"
              type="password"
              placeholder="eyJ..."
              value={draftToken}
              onChange={(e) => setDraftToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              In HA: profile (bottom-left) &rarr; Security &rarr; Long-Lived
              Access Tokens &rarr; Create Token.
            </p>
          </div>

          {status === "error" && (
            <div className="text-sm rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2">
              {useHAStore.getState().errorMessage ?? "Connection failed."}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {url && (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="mr-auto"
            >
              <Unplug className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!draftUrl || !draftToken || testing}
          >
            {testing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plug className="w-4 h-4 mr-2" />
            )}
            {testing ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
