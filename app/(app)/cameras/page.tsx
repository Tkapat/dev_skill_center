"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { messageFrom } from "@/lib/strings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { CameraStatusChip } from "@/components/shared/StatusChip";
import type { Camera } from "@/lib/types";

const SETUP_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};
const SETUP_CHIP: Record<string, string> = {
  draft: "border-border bg-surface text-muted-foreground",
  submitted: "border-info/40 bg-info/10 text-info",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-danger/40 bg-danger/10 text-danger",
};

function AddCameraDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [source, setSource] = React.useState("");
  const [resolution, setResolution] = React.useState("1280x720");
  const [saving, setSaving] = React.useState(false);

  const videosQ = useQuery({
    queryKey: ["edge", "videos"],
    queryFn: () => api<{ videos: string[] }>("/edge/videos"),
    enabled: open,
  });

  React.useEffect(() => {
    if (open) {
      setName("");
      setSource("");
      setResolution("1280x720");
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !source.trim()) return;
    setSaving(true);
    try {
      await api("/my/cameras", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          source_uri: source.trim(),
          resolution: resolution.trim(),
        }),
      });
      toast.success("Camera added. Draw the classroom area next.");
      await qc.invalidateQueries({ queryKey: ["cameras"] });
      await qc.invalidateQueries({ queryKey: ["centre", "mine"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(messageFrom(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add camera</DialogTitle>
          <DialogDescription>
            Paste an RTSP URL, or pick a sample video for the demo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cam-name">Name</Label>
            <Input id="cam-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lab 101" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cam-source">Source (RTSP URL)</Label>
            <Input
              id="cam-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="rtsp://…"
              className="font-mono text-sm"
            />
            {videosQ.data && videosQ.data.videos.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Or choose a sample video:</p>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger aria-label="Sample video">
                    <SelectValue placeholder="Sample videos" />
                  </SelectTrigger>
                  <SelectContent>
                    {videosQ.data.videos.map((v) => (
                      <SelectItem key={v} value={`sample:${v}`}>
                        <span className="font-mono text-xs">{v}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cam-res">Resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger id="cam-res" aria-label="Resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="640x480">640 × 480</SelectItem>
                <SelectItem value="1280x720">1280 × 720 (HD)</SelectItem>
                <SelectItem value="1920x1080">1920 × 1080 (Full HD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || !source.trim() || saving}>
            Add camera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CamerasPage() {
  const [addOpen, setAddOpen] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api<{ items: Camera[] }>("/my/cameras?limit=25"),
    refetchInterval: 15_000,
  });

  if (error) return <ErrorState onRetry={refetch} />;
  const cams = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Setup"
        title="Cameras"
        description="Each classroom camera needs its class area drawn before the government can approve it."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Add camera
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : cams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Video}
            title="No cameras yet"
            hint="Add the camera that watches your classroom. You will draw the class area in the next step."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Add camera
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {cams.map((c) => (
            <li key={c.id} className="card card-hover flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{c.source_uri}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.resolution ?? "—"} · Last seen {c.last_seen ? relativeTime(c.last_seen) : "never"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CameraStatusChip status={c.status} />
                <span
                  className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${SETUP_CHIP[c.setup_status] ?? SETUP_CHIP.draft}`}
                >
                  {SETUP_LABEL[c.setup_status] ?? c.setup_status}
                </span>
              </div>
              {c.setup_status === "rejected" && c.reject_reason && (
                <p className="w-full rounded-[12px] border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  Rejected: {c.reject_reason}
                </p>
              )}
              <Button asChild size="sm" variant={c.roi_polygon ? "secondary" : "default"}>
                <Link href={`/cameras/${c.id}/setup`}>
                  {c.roi_polygon ? "Review setup" : "Draw class area"}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AddCameraDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
