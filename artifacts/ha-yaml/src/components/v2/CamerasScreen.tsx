import { useEffect, useMemo, useState } from "react";
import { haCameraImage, type HAState } from "@/lib/ha";
import { listCameras, type CameraInfo } from "@/lib/cameras";

// Cameras: a grid of snapshots (refreshed every 10 s, every 2 s when one is
// enlarged) with a badge when the camera sees motion.

function useSnapshot(id: string, everyMs: number, enabled = true) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let off = false;
    const load = async () => {
      const r = await haCameraImage(id);
      if (off) return;
      if (r.ok) { setSrc(r.data); setErr(null); } else setErr(r.error);
    };
    void load();
    const t = window.setInterval(() => { if (!document.hidden) void load(); }, everyMs);
    return () => { off = true; window.clearInterval(t); };
  }, [id, everyMs, enabled]);
  return { src, err };
}

// Guests don't see cameras that look into the owners' private spaces.
const OWNER_ONLY = /master/i;

export function CamerasScreen({ states, guest = false }: { states: Map<string, HAState>; guest?: boolean }) {
  const cams = useMemo(() => listCameras(states).filter((c) => !guest || !OWNER_ONLY.test(c.name + c.id)), [states, guest]);
  const [big, setBig] = useState<CameraInfo | null>(null);
  const motionNow = (c: CameraInfo) => states.get(c.motionId)?.state === "on";
  return (
    <div className="v2-cams">
      <div className="v2-cam-grid">
        {cams.map((c) => <CamTile key={c.id} cam={c} motion={motionNow(c)} onOpen={() => setBig(c)} />)}
      </div>
      {big && (
        <div className="v2-modal" role="dialog" aria-modal="true" aria-label={`${big.name} camera`} onClick={() => setBig(null)}>
          <BigCam cam={big} motion={motionNow(big)} onClose={() => setBig(null)} />
        </div>
      )}
    </div>
  );
}

function CamTile({ cam, motion, onOpen }: { cam: CameraInfo; motion: boolean; onOpen: () => void }) {
  const { src, err } = useSnapshot(cam.id, 10_000, cam.available);
  return (
    <button type="button" className="v2-cam" onClick={onOpen} disabled={!cam.available} aria-label={`${cam.name}${motion ? ", motion now" : ""}. Tap to enlarge`}>
      {src ? <img src={src} alt="" /> : <span className="v2-cam-empty">{!cam.available ? "Offline" : err ? "No picture" : "Loading…"}</span>}
      <span className="v2-cam-label">{cam.name}</span>
      {motion && <span className="v2-cam-motion">Motion</span>}
    </button>
  );
}

function BigCam({ cam, motion, onClose }: { cam: CameraInfo; motion: boolean; onClose: () => void }) {
  const { src } = useSnapshot(cam.id, 2_000);
  return (
    <div className="v2-cam-big" onClick={(e) => e.stopPropagation()}>
      {src ? <img src={src} alt={`${cam.name} live picture`} /> : <div className="v2-cam-empty">Loading…</div>}
      <div className="v2-cam-big-bar">
        <span>{cam.name}{motion ? " · motion now" : ""}</span>
        <button type="button" className="v2-mini" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
