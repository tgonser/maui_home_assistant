import { useMemo } from "react";
import type { HAState } from "@/lib/ha";
import { SettingsPanelBody } from "@/components/SuperViewSettings";
import { StormPrepTile } from "@/components/StormPrepTile";
import { setWallUi } from "./WallV2";

// Owner settings on the new wall: storm-prep approval and settings, the
// cooling-target table, and diagnostics — the same tested classic panels,
// opened in a sheet so nothing needs the classic view.
export function SettingsSheet({ states, onClose }: { states: Map<string, HAState>; onClose: () => void }) {
  const list = useMemo(() => [...states.values()], [states]);
  return (
    <div className="v2-modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="wall-root v2-light-panels v2-settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="v2-settings-head">
          <span>Settings</span>
          <div className="v2-settings-actions">
            <button type="button" className="v2-btn" onClick={() => setWallUi("classic")}>Classic view</button>
            <button type="button" className="v2-btn v2-primary" onClick={onClose}>Done</button>
          </div>
        </div>
        <div className="v2-settings-body">
          <StormPrepTile states={list} />
          <SettingsPanelBody states={list} includeTilePickers={false} />
        </div>
      </div>
    </div>
  );
}
