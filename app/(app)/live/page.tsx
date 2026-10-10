"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  Camera,
  Circle,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Timer,
  TriangleAlert,
  VideoOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiUpload } from "@/lib/api";
import { messageFrom } from "@/lib/strings";
import { CountUp, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Sparkline } from "@/components/shared/Sparkline";
import { useWebcam } from "@/hooks/useWebcam";
import type {
  Camera as CameraType,
  DemoSessionResponse,
  FrameResponse,
  LiveSession,
  LiveStatus,
  MyLiveResponse,
} from "@/lib/types";

/* ------------------------------------------------------------- constants */

const MIN_INTERVAL_S = 5;
const MAX_FRAME_BYTES = 1_500_000;

type Tone = "danger" | "warning";

const ALERT_CLASS: Record<Tone, string> = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

/** Frame-specific error copy (lib/strings.ts covers the rest). */
const FRAME_ERROR: Record<string, string> = {
  FILE_TOO_LARGE: "That picture was too large to send (max 1.5 MB). Try a smaller camera resolution.",
  BAD_FILE: "The camera picture could not be read. Check the lens and lighting, then try again.",
  TOO_FAST: "Sending a little too fast — waiting a full interval before the next frame.",
  NOT_FOUND: "This camera cannot be used from a browser. Add a browser camera in Setup → Cameras.",
};

const STATE_META: Record<
  string,
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  live: { label: "Live", cls: "border-success/40 bg-success/10 text-success", Icon: Radio },
  idle: { label: "Idle", cls: "border-border bg-surface text-muted-foreground", Icon: Pause },
  offline: { label: "Offline", cls: "border-border bg-surface text-muted-foreground", Icon: Circle },
  tampered: { label: "Camera problem", cls: "border-danger/40 bg-danger/10 text-danger", Icon: AlertOctagon },
  provisional: { label: "Setup pending", cls: "border-warning/40 bg-warning/10 text-warning", Icon: Timer },
};
const STATE_NO_DATA = { label: "No data", cls: "border-border bg-surface text-muted-foreground", Icon: Circle };

const REASON_LABEL: Record<string, string> = {
  dark: "The picture is too dark. Add more light to the room.",
  covered: "The lens looks covered. Check the camera.",
  blurry: "The picture is blurry. Clean the lens or steady the camera.",
  frozen: "The picture looks frozen. Check the camera connection.",
  moved: "The camera seems to have moved. Check its position.",
};

/* --------------------------------------------------------------- helpers */

function frameMessage(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? (err as { code?: unknown }).code : undefined;
  if (typeof code === "string" && FRAME_ERROR[code]) return FRAME_ERROR[code];
  return messageFrom(err);
}

const reasonText = (r: string) => REASON_LABEL[r] ?? r;

const prettyClass = (cls: string) => cls.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase());

function LiveStateChip({ state, className }: { state?: string | null; className?: string }) {
  const meta = STATE_META[state ?? ""] ?? STATE_NO_DATA;
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        meta.cls,
        className
      )}
    >
      <Icon className={cn("h-3 w-3", state === "live" && "live-dot")} aria-hidden />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ page */

export default function LiveMonitorPage() {
  const cam = useWebcam();
  const { status: camStatus, capture, start: startCam, stop: stopCam } = cam;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const camRef = React.useRef(cam);
  React.useEffect(() => {
    camRef.current = cam;
  });
  const setVideo = React.useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    camRef.current.setVideo(el);
  }, []);

  const [cameraId, setCameraId] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [waitS, setWaitS] = React.useState(10);
  const [frame, setFrame] = React.useState<FrameResponse | null>(null);
  const [spark, setSpark] = React.useState<number[]>([]);
  const [banner, setBanner] = React.useState<{ tone: Tone; text: string } | null>(null);
  const [sessionHint, setSessionHint] = React.useState<LiveSession | null>(null);
  const [startingDemo, setStartingDemo] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const waitRef = React.useRef(10 * 1000);
  const rowRef = React.useRef<LiveStatus | null>(null);

  const camsQ = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api<{ items: CameraType[] }>("/my/cameras?limit=25"),
  });
  const liveQ = useQuery({
    queryKey: ["live", "mine"],
    queryFn: () => api<MyLiveResponse>("/my/live"),
    refetchInterval: 10_000,
  });

  const cameras = React.useMemo(() => camsQ.data?.items ?? [], [camsQ.data]);
  const rows = React.useMemo(() => liveQ.data?.items ?? [], [liveQ.data]);
  const counts = liveQ.data?.counts;
  const row = React.useMemo(() => rows.find((r) => r.camera_id === cameraId) ?? null, [rows, cameraId]);

  const rowSession = rows.find((r) => r.session)?.session ?? null;
  const session = rowSession ?? sessionHint;

  // Drop the local demo hint once its end time passes (time only inside effects).
  React.useEffect(() => {
    if (!sessionHint) return;
    const end = Date.parse(sessionHint.end_ts ?? "");
    if (!Number.isFinite(end)) {
      setSessionHint(null);
      return;
    }
    const ms = end - Date.now();
    if (ms <= 0) {
      setSessionHint(null);
      return;
    }
    const id = setTimeout(() => setSessionHint(null), ms);
    return () => clearTimeout(id);
  }, [sessionHint]);

  React.useEffect(() => {
    rowRef.current = row;
  }, [row]);

  React.useEffect(() => {
    if (!cameraId && cameras.length) setCameraId(cameras[0].id);
  }, [cameras, cameraId]);

  /* ------------------------------------------------------------ streaming */

  const applyWait = React.useCallback((seconds?: number) => {
    const s = Math.max(MIN_INTERVAL_S, Math.round(seconds ?? waitRef.current / 1000));
    waitRef.current = s * 1000;
    setWaitS(s);
  }, []);

  React.useEffect(() => {
    if (!streaming) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const send = async () => {
      if (cancelled || !cameraId || camStatus !== "live") return;
      const b64 = capture();
      if (!b64) return;

      let blob: Blob;
      try {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        blob = new Blob([bytes], { type: "image/jpeg" });
      } catch {
        if (!cancelled) setBanner({ tone: "danger", text: FRAME_ERROR.BAD_FILE });
        return;
      }
      if (blob.size > MAX_FRAME_BYTES) {
        if (!cancelled) setBanner({ tone: "danger", text: FRAME_ERROR.FILE_TOO_LARGE });
        return;
      }

      const fd = new FormData();
      fd.append("file", blob, "frame.jpg");
      try {
        const j = await apiUpload<FrameResponse>(`/my/cameras/${cameraId}/frame`, fd);
        if (cancelled) return;
        if (j.accepted === false) return; // BUSY — skip silently
        const reasons = j.state === "tampered" ? (j.reasons ?? []) : [];
        setBanner(
          reasons.length ? { tone: "warning", text: `The picture looks wrong: ${reasons.map(reasonText).join(" ")}` } : null
        );
        setFrame(j);
        const p = j.people;
        if (typeof p === "number") setSpark((s) => [...s, p].slice(-30));
        if (j.next_interval_s) applyWait(j.next_interval_s);
      } catch (err) {
        if (cancelled) return;
        const e = (err ?? {}) as { status?: number; code?: string };
        if (e.code === "TOO_FAST") {
          applyWait(rowRef.current?.interval_s ?? waitRef.current / 1000);
          setBanner({ tone: "warning", text: FRAME_ERROR.TOO_FAST });
          return;
        }
        if (e.code === "CENTRE_INACTIVE" || e.code === "NOT_FOUND" || e.status === 404) {
          setStreaming(false);
          setBanner({ tone: "danger", text: frameMessage(err) });
          return;
        }
        setBanner({
          tone: e.status ? "danger" : "warning",
          text: e.status ? frameMessage(err) : "Connection problem — we will keep trying.",
        });
      }
    };

    const tick = async () => {
      if (cancelled) return;
      await send();
      if (cancelled) return;
      timer = setTimeout(tick, waitRef.current);
    };
    timer = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [streaming, cameraId, camStatus, capture, applyWait]);

  /* ---------------------------------------------------- boxes on the canvas */

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    const video = videoRef.current;
    const boxes = frame?.boxes ?? [];
    if (camStatus !== "live" || !video?.videoWidth || !video.videoHeight || !boxes.length) return;

    // object-cover: the frame is cropped to fill the 16:9 box — map boxes into that rect.
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
    const dw = video.videoWidth * scale;
    const dh = video.videoHeight * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;

    ctx.lineWidth = 2;
    ctx.font = "12px sans-serif";
    for (const b of boxes) {
      const x = ox + b.x1 * dw;
      const y = oy + b.y1 * dh;
      const bw = (b.x2 - b.x1) * dw;
      const bh = (b.y2 - b.y1) * dh;
      ctx.strokeStyle = b.cls === "person" ? "#0E7C6B" : "#0F766E";
      ctx.strokeRect(x, y, bw, bh);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(`${b.cls}${b.conf != null ? ` ${Math.round(b.conf * 100)}%` : ""}`, x, Math.max(12, y - 4));
    }
  }, [frame, camStatus, videoRef]);

  useGSAP(() => {
    draw();
  }, [draw]);

  React.useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Stop the webcam and clear the overlay on unmount.
  React.useEffect(
    () => () => {
      stopCam();
      const c = canvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    },
    [stopCam]
  );

  /* -------------------------------------------------------------- actions */

  const pickCamera = (id: string) => {
    setCameraId(id);
    setFrame(null);
    setSpark([]);
    setBanner(null);
  };

  const toggleStreaming = (on: boolean) => {
    if (!on) {
      setStreaming(false);
      setFrame(null);
      return;
    }
    if (!cameraId || camStatus !== "live") return;
    applyWait(row?.interval_s ?? 10);
    setBanner(null);
    setStreaming(true);
  };

  const startDemo = async () => {
    setStartingDemo(true);
    try {
      const j = await api<DemoSessionResponse>("/my/live/demo-session", {
        method: "POST",
        body: JSON.stringify({ minutes: 60 }),
      });
      setSessionHint({
        id: j.session_id,
        label: j.label ?? "Demo session",
        start_ts: j.start_ts,
        end_ts: j.end_ts ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      toast.success("Demo session started for 60 minutes.");
      void liveQ.refetch();
    } catch (err) {
      toast.error(messageFrom(err));
    } finally {
      setStartingDemo(false);
    }
  };

  /* ---------------------------------------------------------- derived data */

  const state = frame?.state ?? row?.state ?? null;
  const people = typeof frame?.people === "number" ? frame.people : (row?.people ?? null);
  const claimed = row?.claimed ?? null;
  const labels = row?.labels ?? {};
  const items = frame?.items && Object.keys(frame.items).length > 0 ? frame.items : (row?.items ?? {});
  const itemList = Object.entries(items).map(([cls, v]) => ({
    key: cls,
    text: `${labels[cls] ?? prettyClass(cls)} ${v.present} (${v.in_use} in use)`,
  }));
  const reasons = React.useMemo(() => {
    const fromFrame = frame?.state === "tampered" ? (frame.reasons ?? []) : [];
    const fromRow = row?.quality && row.quality.ok === false ? (row.quality.reasons ?? []) : [];
    return [...new Set(fromFrame.length ? fromFrame : fromRow)];
  }, [frame, row]);
  const sparkData = (spark.length ? spark : (row?.spark ?? [])).slice(-30);
  const streamHint = streaming
    ? camStatus !== "live"
      ? "Camera is off — start the camera to send frames."
      : `Sending a frame every ${waitS} s.`
    : camStatus !== "live"
      ? "Turn on the camera to start streaming."
      : "Nothing is sent until you switch streaming on.";

  /* ----------------------------------------------------------------- view */

  if (liveQ.error && !liveQ.data) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Monitor" title="Live Monitor" />
        <div className="card">
          <ErrorState onRetry={() => liveQ.refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitor"
        title="Live Monitor"
        description="Use this computer's camera to watch the room during a session. Each frame is counted on your server, then discarded — only people and equipment numbers are kept."
      />

      {banner && (
        <div role="alert" className={cn("flex items-start gap-2 rounded-[12px] border p-3 text-sm", ALERT_CLASS[banner.tone])}>
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">{banner.text}</p>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss message"
            className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {!liveQ.isLoading && !session && (
        <div className="card">
          <EmptyState
            icon={Play}
            title="No active session"
            hint="Counts are only saved during a session. Start a demo session to try the Live Monitor now."
            action={
              <Button onClick={startDemo} loading={startingDemo}>
                <Play className="mr-1.5 h-4 w-4" aria-hidden />
                Start demo session (60 min)
              </Button>
            }
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-5" aria-label="Camera preview">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-2">
              <label htmlFor="live-camera-select" className="text-sm font-medium">
                Select camera
              </label>
              {camsQ.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : camsQ.error ? (
                <Button size="sm" variant="secondary" onClick={() => camsQ.refetch()}>
                  Could not load cameras — Retry
                </Button>
              ) : (
                <Select value={cameraId} onValueChange={pickCamera}>
                  <SelectTrigger id="live-camera-select" aria-label="Camera">
                    <SelectValue placeholder={cameras.length ? "Select camera" : "No cameras"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.resolution ? ` (${c.resolution})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {camsQ.data && cameras.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No cameras yet —{" "}
                  <Link href="/cameras" className="font-medium underline underline-offset-2">
                    add this computer&apos;s webcam
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[16px] bg-surface-2" style={{ aspectRatio: "16 / 9" }}>
            {camStatus !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                {camStatus === "denied" ? (
                  <>
                    <VideoOff className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-medium">Camera access denied</p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      Allow camera access in your browser settings, then try again. On a phone, open this page over
                      HTTPS.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => startCam()}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Try again
                    </Button>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <Button size="sm" onClick={() => startCam()} disabled={camStatus === "starting"}>
                      {camStatus === "starting" ? (
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      Start camera
                    </Button>
                  </>
                )}
              </div>
            )}

            <video
              ref={setVideo}
              playsInline
              muted
              onLoadedMetadata={draw}
              className="h-full w-full object-cover"
              aria-label="Camera preview"
            />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />

            {streaming && camStatus === "live" && (
              <span className="absolute left-3 top-3 inline-flex h-6 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 text-xs font-medium text-success">
                <span className="h-2 w-2 rounded-full bg-success live-dot" aria-hidden />
                Streaming
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Switch
                id="live-stream-toggle"
                checked={streaming}
                disabled={!cameraId || camStatus !== "live"}
                onCheckedChange={toggleStreaming}
              />
              <label htmlFor="live-stream-toggle" className="cursor-pointer text-sm font-medium">
                Start streaming
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{streamHint}</p>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Point the camera at the classroom. The detector finds people, chairs, desks and monitors, and draws what it
            sees on this preview.
          </p>
        </section>

        <section className="card p-5 space-y-4" aria-label="Right now">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Right now</h2>
            <LiveStateChip state={state} />
          </div>

          {liveQ.isLoading && !frame ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-16 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div>
                <p className="eyebrow">People</p>
                <p className="mt-1 text-[40px] font-semibold leading-none tabular">
                  {people != null ? <CountUp value={people} /> : "—"}
                </p>
                {claimed != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Claimed <span className="tabular font-medium text-foreground">{claimed}</span> / Camera saw{" "}
                    <span className="tabular font-medium text-foreground">{people ?? "—"}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-3 py-2">
                <span className="text-xs font-medium">Session</span>
                <span className="truncate text-xs text-muted-foreground">
                  {session ? (session.label ?? "Active session") : "No active session"}
                </span>
              </div>

              {reasons.length > 0 && (
                <ul className="space-y-1 rounded-[12px] border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                  {reasons.map((r) => (
                    <li key={r}>{reasonText(r)}</li>
                  ))}
                </ul>
              )}

              {itemList.length > 0 && (
                <div className="space-y-2">
                  <p className="eyebrow">Equipment</p>
                  <div className="flex flex-wrap gap-2">
                    {itemList.map((it) => (
                      <span
                        key={it.key}
                        className="inline-flex h-7 items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium"
                      >
                        {it.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="eyebrow">Last {sparkData.length} counts</p>
                {sparkData.length > 1 ? (
                  <Sparkline data={sparkData} className="h-12 w-full" />
                ) : (
                  <p className="text-xs text-muted-foreground">Waiting for the first frame…</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="card overflow-hidden" aria-label="All cameras">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">All cameras</h2>
          {counts && (
            <p className="tabular text-xs text-muted-foreground">
              {counts.live} live · {counts.idle} idle · {counts.offline} offline · {counts.tampered} camera problem
              {counts.tampered === 1 ? "" : "s"} · {counts.provisional} setup pending
            </p>
          )}
        </div>
        {liveQ.isLoading && rows.length === 0 ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Radio} title="No cameras reporting yet" hint="Add a camera to see its status here." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.camera_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.camera_name}</span>
                <span className="tabular text-xs text-muted-foreground">
                  {typeof r.people === "number" ? `${r.people} people` : "—"}
                </span>
                <LiveStateChip state={r.state} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Camera pictures are analysed on your server and discarded immediately. Only people and equipment counts and
        blurred thumbnails are kept — faces are never identified.
      </p>
    </div>
  );
}
