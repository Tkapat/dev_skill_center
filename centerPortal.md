==================================================================
 dev_skill_center: CENTRE PORTAL, PAGE PLAN   (v3: MongoDB + GSAP + LIVE ROOM + CALENDAR)
 Give with UI/UX 6C v3 (+ 6A rules it does not override), 6B and the
 Frontend Patch (M5). Accent --primary #0E7C6B. Tone: supportive.
==================================================================

RULES FOR THE AI BUILDER (read first)
------------------------------------------------------------------
 1. Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
    Libraries: @tanstack/react-query, react-hook-form + zod,
    gsap + @gsap/react, recharts, react-leaflet, lucide-react, sonner,
    next-themes. DO NOT install framer-motion, @supabase/*, qrcode.react.
    Animation = GSAP helpers only (6B + 6C v3 section 9).
    Fonts = next/font/google only (6C). No Next middleware for auth.
 2. AUTH IS THE BACKEND (JWT): POST /auth/login, /auth/refresh,
    /auth/logout, GET /me, POST /me/change-password.
    Use lib/auth.ts and lib/api.ts as in the Frontend Patch, PLUS add
    apiUpload(path, formData) to lib/api.ts: same as api() but it must NOT
    set Content-Type (the browser sets the multipart boundary), same Bearer,
    ngrok header, silent refresh and error mapping. Env: NEXT_PUBLIC_API_URL ONLY.
 3. LOGIN ID: the user types a Centre ID (DSK-WB-0001) or Trainer ID
    (DSK-WB-0001-T01). Send AS IS (trimmed) as login_id. No email conversion.
 4. lib/api.ts adds Bearer + "ngrok-skip-browser-warning": "true",
    refreshes once on 401, redirects to /change-password on 403
    PASSWORD_CHANGE_REQUIRED, shows "These credentials expired. Ask the
    department to reset them." on CREDENTIALS_EXPIRED. Error shape
    {detail:{detail,code}}. Map codes in lib/strings.ts: INVALID_CREDENTIALS,
    ACCOUNT_LOCKED, WEAK_PASSWORD, SAME_PASSWORD, ENROLMENT_CAP_REACHED,
    CLAIM_LOCKED, WRONG_CENTRE, FORBIDDEN, CENTRE_INACTIVE, LINK_EXPIRED,
    BAD_FILE, FILE_TOO_LARGE, LOGIN_EXISTS, BAD_STATE, NOT_FOUND, TOO_FAST,
    BUSY.
 5. Allowed roles: centre_admin, trainer. Otherwise logout() and show
    "This account belongs to the Government portal."
 6. Every page: loading skeleton (mirrors layout), empty state, error state
    with Retry.
 7. IMAGES: relative signed URLs only through SignedImage/useSignedImage.
 8. Dates in IST. Date-only values arrive as "YYYY-MM-DD", times as "HH:MM" or
    "HH:MM:SS": never convert them with new Date() timezone shifts.
 9. Polling: dashboard, flags, notices, sessions today every 15 s. Live Room
    status panel is driven by frame responses (no extra polling). Calendar
    month 60 s; today's day sheet 30 s. No websockets. Polling must not replay
    entrance animations (6B R5).
10. IDs are strings under "id". Lists use ?limit=25&cursor=<id>.
11. TRAINEES ARE NEVER FACE-SCANNED OR PHOTOGRAPHED. Face features exist only
    for staff and only with consent. No face/photo fields in trainee forms.
12. getUserMedia works on HTTPS or localhost only. Always show a
    permission-denied fallback. Stop all tracks and clear canvases on stop and
    on unmount. Never keep face images or camera frames in state, storage or
    the React Query cache. (Live Room frames exist only as transient Blobs
    that are dropped after the upload.)
13. Respect centre status: pending_setup / awaiting_camera_approval show the
    onboarding banner; suspended or terminated show a full-page notice and
    every write action (including starting the Live Room) is disabled.
14. Role views:
      trainer      : Today (dashboard), Attendance, Live room, Calendar,
                     Flags (read), Notices (read), Settings
      centre_admin : everything below
    Disallowed routes redirect to /dashboard.
15. Do not add pages or features not listed.

NAVIGATION
------------------------------------------------------------------
 Desktop pill nav (centre_admin): Home, Attendance, Monitor (dropdown: Live
 room, Calendar), People (dropdown: Trainees, Staff), Setup (dropdown:
 Cameras, Schedule, Equipment), Requests, Flags, Notices; "More": Onboarding
 (until live), Demo Lab, Settings. Trainer: Today, Attendance, Live room,
 Calendar, Flags, Notices.
 Mobile dock (5): centre_admin: Home, Attendance, Monitor (opens a bottom
 sheet with Live room + Calendar), People, More (Flags, Setup items,
 Requests, Notices, Demo Lab, Settings). Trainer: Today, Attendance, Calendar,
 Flags, More (Live room, Notices, Settings).
 Bell badge = open flags + unread notices.

DATA SHAPES (from the API; use these names exactly)
------------------------------------------------------------------
 LiveStatus = { camera_id, camera_name, state: "live"|"idle"|"offline"|
   "tampered"|"provisional", ts, age_s, interval_s, session:{id,label,
   start_ts,end_ts}|null, people, people_smooth, claimed|null,
   items:{class:{present,in_use,idle,off}}, labels:{class:label},
   quality:{ok,reasons[]}, thumb_url, spark:number[] }
 FrameResponse (POST /my/cameras/{id}/frame) = { accepted, state, reason?,
   people, people_smooth, items, boxes:[{cls,x1,y1,x2,y2,conf}] (0..1),
   session, next_interval_s, reasons? }
 CalendarDay / DayDetail / SnapshotRow = same as in the Gov plan:
   CalendarDay = {date,status("ok"|"attention"|"critical"|"no_data"|"holiday"|
   "upcoming"|"none"),updates,snapshots,sessions,people_max,people_avg,claimed,
   observed,delta,flags{total,open,max_severity}|null,uptime_pct,in_use_pct}
   DayDetail = {date,summary,sessions[],timeline{interval_s,points[]},
   equipment[],flags[],evidence[],camera_health[],events[]}
 Endpoints: GET /my/live, GET /my/calendar?from=&to=, GET /my/calendar/{date},
   GET /my/calendar/{date}/snapshots?limit=&cursor=, POST /my/live/demo-session,
   PUT /my/cameras/{id}/live, POST /my/cameras/{id}/reference-frame (multipart).

PUBLIC PAGES (no login, no AuthGate)
------------------------------------------------------------------
 /apply   Application form, 5-step Stepper with animateStep:
   1 Applicant: name, type (municipality | panchayat | ngo | other), phone,
     email (optional).
   2 Centre and scheme: centre name; scheme and trade from GET /public/schemes
     (trade shows required equipment).
   3 Capacity and equipment: trainers list (name, qualification, add/remove),
     max trainees, equipment rows PREFILLED from the trade template (editable
     class + label + quantity). Live plausibility hint (amber, never blocks).
   4 Location and room: address, district, state, GPS ("Use my location" +
     draggable pin), room size, number of cameras, resolution, internet
     availability (none | intermittent | stable), proposed batches.
   5 Documents and review: PDF/JPG/PNG, max 5 files, 5 MB each; review
     summary; Submit.
   Submit: POST /public/applications -> tracking_code -> upload each file with
   POST /public/applications/{code}/documents?phone=<phone> (multipart "file"),
   per-file progress and retry. Success card: tracking code (mono 28), Copy,
   "Keep this code and your phone number to track your application." Handle 429.
 /apply/track   code + phone -> GET /public/applications/track?code=&phone=
   Vertical status timeline built from events. query_raised: officer comment +
   "Edit and resubmit" (PUT /public/applications/{code} {phone,...fields}).
   Approved: "Your centre has been approved. The department will share your
   login details with your contact person." NEVER show credentials. Wrong
   details -> "No application found for these details."

AUTH PAGES
------------------------------------------------------------------
 /login   Split layout (6C). Label "Centre ID or Trainer ID" (placeholder
   DSK-WB-0001), password with show/hide. POST /auth/login {login_id,
   password}. Errors inline + shake. Links "Apply for a new centre" and "Track
   application". After login: GET /me, role check, then /change-password if
   must_change_password, else /onboarding (centre_admin, not live) or /dashboard.
 /change-password   Forced on first login; also from /settings. Fields
   current (temporary), new, confirm; strength Meter; data-use notice with a
   REQUIRED checkbox on first login: "I understand: cameras count people
   anonymously; faces are used only for staff, only with consent; camera
   pictures are analysed and discarded, only blurred thumbnails and counts
   are kept." POST /me/change-password {current_password, new_password,
   accepted_notice:true}; store fresh tokens, continue.

APP PAGES
------------------------------------------------------------------
 /onboarding  (centre_admin; hidden once live)
   GET /my/centre -> {centre, checklist:{camera,batches,staff,equipment,
   submitted}, status, submitted_at}. ProgressRing + 5 checklist rows:
     1 Register camera and draw classroom area -> /cameras
       (a browser camera uses THIS computer's webcam: Add camera ->
        "This computer's webcam" -> capture reference frame -> draw area)
     2 Create batches and timetable -> /schedule
     3 Add trainers/officials and enrol faces -> /staff
     4 Declare equipment inventory -> /equipment
     5 Submit for government approval (enabled when 1-4 done)
   Check icon draws when an item flips to done. Step 5 calls
   POST /my/cameras/{id}/submit for each draft camera. Banner by status:
   pending_setup "Complete the steps below"; awaiting_camera_approval
   "Awaiting government approval" + relative time; live success row (no
   confetti) + link to /dashboard. Rejected camera: show reason + "Fix and
   resubmit". Tip card: "You can try the Live room before approval. It will
   show on the department's wall as 'Setup pending' and nothing is recorded
   until the camera is approved."

 /dashboard
   centre_admin: hero card + 4 stat tiles (Today's sessions, Enrolled / max
   with Meter, Open flags, Camera: online/offline/tampered chip LINKING to
   /live) + "Right now" card when a camera is live (People number, items in
   use chips, button "Open Live room") + session rail + attention list + quick
   actions (Mark attendance, Add trainee, Declare repair, New request, Open
   Live room).
   Data: GET /my/centre, GET /my/sessions/today, GET /my/flags?limit=5,
   GET /my/notices?unread=true, GET /my/live.
   trainer: today's sessions as large cards with "Verify yourself" and "Mark
   attendance" plus a secondary button "Open Live room".

 /live  (LIVE ROOM; centre_admin, trainer)   [camera runs in this browser tab]
   Purpose: "Use this computer's camera to monitor the room during a session."
   Pre-flight panel (shown until monitoring starts):
     - Camera picker: browser cameras of this centre (GET /my/cameras). If none:
       button "Add this computer as a camera" (POST /my/cameras {name:"Lab PC",
       source_uri:"browser", resolution}) then continue.
     - Hints: classroom area drawn? (link to /cameras/[id]/setup; optional
       for tests); session status: active session label + time left, or
       "No session right now" with button "Start a demo session" (minutes
       selector 30 | 60 | 120 -> POST /my/live/demo-session).
     - Interval select (5 s | 10 s | 30 s | 60 s; default 10 s; PUT
       /my/cameras/{id}/live {enabled:true, interval_s, tiling:false}).
     - "Allow camera" button -> getUserMedia({video:{width:{ideal:1280},
       height:{ideal:720}, facingMode:"user"}, audio:false}); denied -> clear
       fallback message with browser instructions.
   Running state:
     - Local preview <video muted playsInline> (never uploaded as video) with a
       transparent <canvas> overlay drawing boxes + labels from the LAST
       FrameResponse.boxes (normalised). Preview is mirrored only visually.
     - Right panel (live): People (big, CountUp), per-class cards (Chairs, Desks,
       Monitors, others from items) each "present N, in use M" with a small
       Meter; state chip (Monitoring | Paused | Camera problem | Waiting for
       session); "Updates sent today" counter; last update time; sparkline of
       the last 60 people_smooth values (kept in memory only).
     - Buttons: Start monitoring / Stop monitoring (primary 56 px), Switch
       camera, Interval select (live-change).
   CAPTURE LOOP (implement exactly):
     - Drive the schedule with a Web Worker timer (public/live-timer.worker.js:
       setInterval -> postMessage("tick")) because background tabs throttle
       main-thread timers. On each tick (skip if a request is in flight):
       capture a frame (prefer ImageCapture.grabFrame() on the video track,
       fallback drawImage(video)) into an offscreen canvas scaled to max 960 px
       width, canvas.toBlob("image/jpeg", 0.7), then apiUpload(
       "/my/cameras/{id}/frame", FormData{file}). The Blob is released right
       after the response.
     - Handle responses: accepted -> update panel, draw boxes; accepted:false
       reason BUSY -> skip silently; 429 TOO_FAST -> widen interval by 2 s;
       state tampered -> show friendly advice ("The picture looks too dark or
       covered. Check the lens and lighting."); 403 CENTRE_INACTIVE -> stop
       and show the read-only notice; network error -> "Reconnecting..." chip
       with exponential backoff (5, 10, 20, 40, 60 s) and auto-resume.
     - Request navigator.wakeLock.request("screen") when starting (ignore
       failure, show a small tip "Keep this tab open and the screen awake").
     - Stop on unmount, on Stop, and when the session ends (message "Session
       ended. Monitoring stopped.").
   Privacy block (shield): "Camera pictures are analysed on the centre's server
   and discarded immediately. Only people and equipment counts and blurred
   thumbnails are kept. Faces are never identified." The browser preview is
   shown only on this screen.
   Trainer can use this page too (same behaviour).

 /calendar  (CALENDAR; centre_admin, trainer; read-only)
   Purpose: "See what the camera recorded on any day." Same spec as the Gov
   CALENDAR SPEC but with the Centre theme, supportive wording and these data
   sources: GET /my/calendar?from=&to= (month or year) and GET
   /my/calendar/{date}, GET /my/calendar/{date}/snapshots.
   Header: month title, prev/next, Today, Month | Year toggle, legend chips:
   All matched, Worth a look, Needs your response, No camera data, Holiday,
   Scheduled (each with an icon).
   Month cell: date, status icon, "412 updates", intensity bar, average people
   (Users icon), small difference chip when claimed vs camera exist ("2 fewer"
   / "Matched"). Keyboard + aria-labels as in the Gov spec.
   Year view: contribution-style squares with intensity; click opens that month.
   Month summary strip: total updates, days with data, average people, open
   flags to respond to.
   Day sheet (right drawer 480 px; bottom sheet on mobile) tabs: Sessions
   (claimed vs camera saw, range, staff verified), Timeline (people over time,
   equipment in use per class), Equipment (present avg/max, in use %), Flags
   (with "Respond" link to /flags), Pictures (blurred thumbnails, lightbox),
   Updates (Feed | Raw snapshots paged). Empty day shows the reason.

 /cameras  (centre_admin)
   List: name, source kind chip (This computer | Server webcam | RTSP | Sample
   video), resolution, status chip, setup status chip, last seen. "Add camera"
   dialog: name; Source type segmented control:
     "This computer's webcam (browser)" -> source_uri "browser"
     "Webcam on the server" -> "webcam:0" (only if the backend machine has one)
     "Network camera (RTSP)" -> rtsp URL field
     "Sample video (demo)" -> select from GET /edge/videos
   Zone label (optional), resolution. POST /my/cameras.
   Per camera: toggle "Monitoring enabled" (PUT /my/cameras/{id}/live),
   interval select, link to Live room (browser kind).
 /cameras/[id]/setup   ROI EDITOR (follow 6A section 10 via 6C)
   - Reference frame: for BROWSER cameras the page first shows "Capture a
     reference picture": a live preview + button "Capture", then uploads it
     via POST /my/cameras/{id}/reference-frame (multipart "file"), then loads
     GET /my/cameras/{id}/reference-frame -> {url,width,height,quality}. Other
     kinds load the GET directly. "Retake" allowed.
   - Overlay and modes as before: Classroom area (one polygon, required),
     Workstation zones (many, named). Undo, Clear (confirm), Close shape, drag
     handles, min 3 points, area > 0.02, normalised 0..1 with 4 decimals.
   - Quality panel chips with advice. Save draft -> PUT /my/cameras/{id}/setup
     {roi_polygon, zones}; Submit -> POST /my/cameras/{id}/submit (needs saved
     classroom area). Rejected: callout with reason. Reload must reproduce
     shapes exactly. Privacy line shown.

 /schedule  (centre_admin)
   Batches list + form (drawer/sheet): name, trainer, weekday chips (Mon..Sun =
   1..7), start/end time (HH:MM), start/end date. Week grid preview. Holidays
   list (add/remove date + reason). Note "Monitoring runs only inside these
   windows (or a demo session)." Editing shows a warning and calls PUT
   /my/batches/{id}. After approval a NEW batch returns 403 NEEDS_APPROVAL ->
   offer the change-request dialog instead.

 /staff  (centre_admin)
   List: name, role, login ID (mono), face status chip, consent chip, active
   switch. "Add staff" (POST /my/staff creates person + trainer login ->
   credentials modal, 409 LOGIN_EXISTS handled). "Enrol face" ->
   /staff/[id]/face-enrol. Deactivate (confirm; face data deleted). The admin
   can add themselves as an official.
 /staff/[id]/face-enrol   consent text + REQUIRED checkbox, webcam, capture,
   preview (memory only), Enrol -> POST /my/staff/{id}/face-enrol {image_b64,
   consent:true}. Errors: no face / multiple faces -> advice. Success tick,
   failure shake. "Remove face data" -> DELETE /my/staff/{id}/face. Only that
   staff member or the centre admin.

 /trainees  (centre_admin)
   Cap card "38 of 40 seats used" with Meter. List with search + batch filter,
   cursor pagination. Add trainee dialog (name, external ID, batch) -> POST
   /my/trainees. CSV import (preview, then POST /my/trainees/bulk {rows[]};
   stops at the cap and reports added/skipped). At cap: "Request extra seats".
   409 ENROLMENT_CAP_REACHED handled. Deactivate -> POST
   /my/trainees/{id}/deactivate. NO photo or face fields.

 /attendance  (trainer, centre_admin)
   Session picker (today). Step 1 "Verify yourself": webcam face scan of the
   logged-in person only -> POST /my/sessions/{id}/staff-scan {image_b64,
   frames_b64?}; allowed 15 min before start until end; 3 failures -> "Ask your
   centre admin to help. This will be noted." Not enrolled -> link to enrol.
   Step 2 "Mark trainees": roster (GET /my/trainees?batch=), large checkboxes,
   Select all / Clear, search, sticky bar "Present 24 of 30 [Submit]" ->
   confirm -> POST /my/sessions/{id}/claim {present_trainee_ids}. Locked after
   submit; "Edit (needs reason)" re-submits with edit_reason; 409 CLAIM_LOCKED
   handled. Past sessions list read-only. Privacy line shown.

 /equipment  (centre_admin)
   GET /my/equipment. Cards: item, sanctioned, declared (stepper -> PUT
   /my/equipment), observed status chip (OK | Missing | Idle | Non-operational |
   Repair approved), "In use" % over the last 7 days (Meter) and last observed
   date. Amber note when declared != sanctioned. "Declare repair" (item, qty,
   reason, expected fix date <= 30 days) -> POST /my/repair-declarations;
   active repairs list with "approved until". "Request more equipment".

 /requests   Create + list change requests (equipment | enrolment | batch |
   camera) + repair declarations; payload shapes: equipment {class,extra_qty};
   enrolment {extra_trainees}; batch {name,weekdays,start_time,end_time,
   trainer_id}; camera {name,source_uri}. Lock icon on unapproved items.

 /flags
   Own flags: plain-language reason, severity chip, status, evidence thumbnails
   (SignedImage), supportive wording; detail drawer with why-text, lightbox,
   timeline (flag.events), link "See this day in your calendar" ->
   /calendar?date=. "Respond": comment + optional file (PDF/JPG/PNG <= 5 MB) ->
   POST /my/flags/{id}/respond. Uncertain flags: violet dashed chip + "The
   camera could not count reliably. No action is needed unless asked."

 /notices   Inbox with level chips, unread dot; opening marks read (POST
   /my/notices/{id}/read); reply (POST /my/notices/{id}/reply). Suspension or
   termination notices drive the read-only banner.

 /settings   Profile, change password, theme, data-use notice, logout.

 /demo  (centre_admin; "Demo Lab", "Demo" chip)
   Sample-video scenarios for judges (unchanged from v2): camera, session,
   scenario (Normal class | Few students | Equipment removed | Camera covered |
   Frozen feed), claimed override, "Run session analysis" -> POST
   /edge/demo/run {camera_id, session_id, video, scenario, claimed_override},
   animated pipeline steps, results card, offline toggle + sync counter + chain
   status. Add a link card: "Prefer a live demo? Open the Live room."

STATE AND ERROR HANDLING SUMMARY
------------------------------------------------------------------
 401 silent refresh then /login; 403 WRONG_CENTRE/FORBIDDEN "You do not have
 access to this."; 403 CENTRE_INACTIVE read-only banner; 409
 ENROLMENT_CAP_REACHED cap message + request; 409 CLAIM_LOCKED ask for edit
 reason; 429 "Too many requests. Please wait a moment."; 429 TOO_FAST widen
 interval; network failure ErrorState with Retry, forms keep typed values.

ACCEPTANCE CHECKS
------------------------------------------------------------------
 - Govt account logging into this app is rejected politely.
 - Trainer cannot open /staff, /cameras, /schedule, /trainees, /equipment,
   /requests, /demo (redirected to /dashboard) but CAN open /live and /calendar.
 - Login uses the plain Centre/Trainer ID; no email conversion.
 - Enrolment stops at the cap; 10 quick clicks never exceed it.
 - ROI polygon saves normalised and reloads exactly; works by touch at 390 px.
 - Roster locks after submit; edit demands a reason.
 - Live room: permission denied shows the fallback; frames upload every
   interval; boxes are drawn on the local preview; stopping releases the camera
   (browser camera light turns off); a hidden tab keeps sending frames (worker
   timer); network loss shows Reconnecting and resumes.
 - No frame, Blob or face image is retained in state, storage or cache.
 - Starting the Live room in a suspended centre is blocked.
 - Without an active session the Live room shows "No session right now" and the
   demo-session button; frames sent then do not appear in the calendar.
 - After a monitored session the calendar day shows updates, people avg,
   claimed vs camera, equipment in use and thumbnails.
 - Calendar month grid issues one request per month; year view works; keyboard
   navigation and aria-labels present.
 - Evidence and live thumbnails display via SignedImage.
 - Suspended centre sees read-only mode with the notice banner.
 - Public /apply works without login; tracking never shows credentials.
 - 390 px layout: bottom dock, stacked cards, bottom-sheet dialogs.
 - No Supabase, framer-motion or Supabase env variable in the code.
 - Polling flags for 60 s does not replay row animations.