export type Role = "centre_admin" | "trainer";

export type CentreStatus =
  | "pending_setup"
  | "awaiting_camera_approval"
  | "live"
  | "suspended"
  | "terminated";

export interface Me {
  id: string;
  login_id: string;
  role: Role;
  centre_id: string | null;
  full_name: string;
  must_change_password: boolean;
  mfa_enabled: boolean;
  centre: { id: string; code: string; name: string; status: CentreStatus } | null;
}

export interface Centre {
  id: string;
  code: string;
  name: string;
  max_trainees: number;
  enrolled_count: number;
  status: CentreStatus;
  status_reason?: string | null;
  address?: string;
  district?: string;
  state?: string;
  lat?: number | null;
  lng?: number | null;
  contact_phone?: string;
  equipment?: {
    class: string;
    label: string;
    sanctioned_qty: number;
    declared_qty: number;
  }[];
  risk_score?: number;
  created_at?: string;
  live_since?: string | null;
  submitted_at?: string | null;
}

export interface Checklist {
  camera: boolean;
  batches: boolean;
  staff: boolean;
  equipment: boolean;
  submitted: boolean;
}

export interface CentreStats {
  open_flags: number;
  unread_notices: number;
  sessions_today: number;
  camera_status: "none" | "online" | "offline" | "tampered" | "unknown";
  camera_count: number;
}

export interface MyCentre {
  centre: Centre | null;
  checklist: Checklist | null;
  status: CentreStatus | null;
  submitted_at: string | null;
  stats: CentreStats | null;
}

export type SessionState = "upcoming" | "active" | "closed" | "missed";

export interface Session {
  id: string;
  batch_id: string | null;
  batch_name?: string | null;
  trainer_name?: string | null;
  session_date: string;
  start_ts: string;
  end_ts: string;
  status: string;
  claimed?: number | null;
  observed?: number | null;
  ci_low?: number | null;
  ci_high?: number | null;
  observation_state?: string | null;
}

export type CameraSetupStatus = "draft" | "submitted" | "approved" | "rejected";
export type CameraStatus = "online" | "offline" | "tampered" | "unknown";

export interface Camera {
  id: string;
  name: string;
  source_uri: string;
  resolution?: string | null;
  roi_polygon: [number, number][] | null;
  zones: { name: string; polygon: [number, number][] }[] | null;
  setup_status: CameraSetupStatus;
  status: CameraStatus;
  reject_reason?: string | null;
  last_seen?: string | null;
  created_at?: string;
  reference_blob_id?: string | null;
  reference_width?: number | null;
  reference_height?: number | null;
  reference_quality?: {
    brightness?: number;
    sharpness?: number;
    coverage?: number;
  } | null;
}

export interface ReferenceFrame {
  url: string;
  width: number | null;
  height: number | null;
  quality: { brightness?: number; sharpness?: number; coverage?: number } | null;
}

export interface Batch {
  id: string;
  name: string;
  trainer_id: string | null;
  weekdays: number[];
  start_time: string;
  end_time: string;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
  created_at?: string;
}

export interface Staff {
  id: string;
  full_name: string;
  staff_role: "trainer" | "official";
  phone?: string | null;
  face_consent: boolean;
  face_enrolled: boolean;
  active: boolean;
  user_id?: string | null;
  created_at?: string;
}

export interface Trainee {
  id: string;
  full_name: string;
  external_id?: string | null;
  batch_id: string | null;
  active: boolean;
  created_at?: string;
}

export interface EquipmentItem {
  class: string;
  label: string;
  sanctioned_qty: number;
  declared_qty: number;
  required: boolean;
  operability: string;
  observed: number | null;
  observed_at: string | null;
  observed_status: "unknown" | "ok" | "missing" | "idle" | "repair_approved";
  repair_pending: boolean;
  repair_approved: boolean;
  repairs: Repair[];
}

export interface Repair {
  id: string;
  equipment_class: string;
  qty: number;
  reason: string;
  expected_fix_date: string;
  status: "pending" | "approved" | "rejected" | "expired";
  approved_until?: string | null;
  decision_comment?: string | null;
  created_at?: string;
}

export type FlagStatus =
  | "open"
  | "acknowledged"
  | "centre_responded"
  | "under_review"
  | "resolved"
  | "dismissed"
  | "escalated";

export interface Flag {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  state: "flagged" | "uncertain";
  status: FlagStatus;
  reason: string;
  claimed_count?: number | null;
  observed_count?: number | null;
  evidence_ids?: string[];
  evidence_urls?: string[];
  created_at?: string;
  updated_at?: string;
  events?: {
    action: string;
    actor_role?: string;
    comment?: string | null;
    ts: string;
  }[];
}

export interface Notice {
  id: string;
  level: "advisory" | "notice" | "warning" | "suspension" | "termination";
  subject: string;
  body: string;
  flag_ids?: string[];
  read_at?: string | null;
  reply?: string | null;
  replied_at?: string | null;
  created_at?: string;
}

export interface ChangeRequest {
  id: string;
  kind: "equipment" | "enrolment" | "batch" | "camera" | "changerequests" | "repairdeclarations";
  payload?: Record<string, unknown>;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  decision_comment?: string | null;
  decided_at?: string | null;
  equipment_class?: string;
  qty?: number;
  created_at?: string;
}

export interface EquipmentRule {
  class: string;
  label: string;
  min_units_per_trainee: number;
  operability: string;
  required: boolean;
}

export interface TradeTemplate {
  id: string;
  trade_name: string;
  presence_rule?: string;
  equipment_rules: EquipmentRule[];
}

export interface Scheme {
  id: string;
  name: string;
  code: string;
  description?: string;
  templates: TradeTemplate[];
}

export interface DemoRunResult {
  observed: number | null;
  ci_low: number | null;
  ci_high: number | null;
  state: string;
  per_frame: number[];
  frames_used: number;
  claimed: number | null;
  thumbnails: string[];
  flags: Flag[];
}

export interface EdgeStatus {
  online: boolean;
  unsynced_count: number;
  last_sync?: string | null;
  chain_ok: boolean;
}
