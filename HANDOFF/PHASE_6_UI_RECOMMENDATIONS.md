# Phase 6: UI Research & Recommendations

## Date: 2026-03-29
## Based on: Full codebase audit + existing mockups in schema ss/temp/

---

## 5 Areas Assessed

### 1. Consultation Page (HIGH PRIORITY)

**Current State:**
- Patient header shows only demographics (name, age, DOB, UHID)
- No longitudinal history shown before recording starts
- Voice recorder is buried — `GlobalVoiceRecorder` is invisible by default, tiny mic icons per section
- AI output only visible inside the per-tooth dialog
- V4 doesn't load `linked_diagnosis` appointment context (only V5 does)
- No drag & drop for clinical images/X-rays during consultation

**Recommended Changes:**

#### 1a. Patient Context Panel (before recording starts)
A collapsible card between patient header and progress card showing:
- Last consultation summary (date, chief complaint, what was done)
- Active treatment episodes with progress (e.g., "Tooth 46: RCT, 2/3 visits done")
- Current medications & allergies (critical safety info)
- Flagged follow-ups
- Data source: `assemblePatientContext()` (already built in Phase 1)

#### 1b. Prominent Voice Recorder
Move the `GlobalVoiceRecorder` from hidden to a large, centered, visually prominent button directly after the patient context panel. Teal accent, pulsing animation when active. Sticky when scrolling.

#### 1c. Image/X-ray Drop Zone
Add a drag & drop zone in the consultation page (all modes) where the dentist can drop clinical images, X-rays, CBCT scans directly from their desktop or gallery. This should:
- Accept: JPG, PNG, DICOM (if feasible), PDF
- Show preview thumbnails inline
- Auto-attach to the consultation record
- Store via existing `uploadPatientFileAction` + `medical-files` bucket
- In future: feed into the AI pipeline for image analysis

#### 1d. Consultation-Level AI Summary
After the diagnostic pipeline runs on one or more teeth, show a summary card above the section grid:
- Teeth examined: 46, 14
- Diagnosis: Irreversible pulpitis (46), Deep caries (14)
- Treatment: RCT → Crown (46), Composite (14)
- Gaps: 2 questions remaining
- This card already has the data — it comes from the pipeline output stored in state

---

### 2. Tooth Diagnosis Dialog (HIGH PRIORITY)

**Current State:**
- 3-column grid: diagnosis checkboxes | AI tabs (Unified/Diagnosis/Treatment) | treatment checkboxes
- 3-tab AI switcher means dentist can't see all output at once
- Gap dialog, diagnosis copilot, and treatment copilot are separate tabs
- `conversationContext` passes to diagnosis copilot but NOT to treatment copilot
- No agent status indicator (no way to see if AI is still reasoning)

**Recommended Changes:**

#### 2a. Unified AI Panel (replace 3-tab with single scroll)
Replace the tab switcher with a single scrollable AI panel showing in order:
1. AI-Suggested Diagnosis (with confidence %) — auto-checks the left column
2. Evidence/Rationale (from RAG citations)
3. Gap Warnings (if info is missing, with "Ask" buttons)
4. Recommended Treatment Sequence (auto-checks the right column)
5. Conductor Output (if multi-track — interaction warnings, sequence)

#### 2b. Pass Full Context to Treatment Tab
Wire `conversationContext` into `EndoAICopilotLive` — currently only `DiagnosisAICopilot` receives it.

#### 2c. Agent Status Indicator
Small badge showing: "AI Analyzing..." → "Diagnosis Ready" → "Treatment Ready" with timing.

---

### 3. Patient Profile (MEDIUM PRIORITY)

**Current State:**
- 5-tab layout: Overview, Dental Chart, Journey, Files, Rx & Appt
- Journey tab shows episodes with expand/collapse and visits — good foundation
- No progress visualization (no bars, no completion indicators)
- No AI-generated patient summary

**Recommended Changes:**

#### 3a. Episode Progress Bars
In the Journey tab, add a visual progress bar to each episode card:
```
Tooth 46: RCT + Crown
[████████░░░░] 2/4 visits — In Progress
Last visit: Mar 25 — Access opening + BMP
Next: Obturation
```

#### 3b. Patient Intelligence Card (Overview tab)
At the top of the Overview tab, add an AI-generated summary card:
- Active episodes count + progress overview
- Recurring patterns (e.g., "3 teeth with periapical issues in last 6 months")
- Follow-up compliance (attended vs missed)
- Risk flags (medical conditions affecting treatment)
- This can be generated on-demand via a button (uses `assemblePatientContext` + a small Claude call)

#### 3c. Report Download in Profile
In the Rx & Appt tab or a new section in Files tab, show generated consultation reports with download links. The `patient_files` table already stores these from Phase 4.

---

### 4. Today's View / Appointment Cards (HIGH PRIORITY)

**Current State:**
- Appointment cards show: patient name, time, duration, type badge, status, action buttons
- `linked_diagnosis`, `linked_treatment_plan`, `linked_tooth_numbers` exist in DB but are NOT fetched or displayed
- No "continuing treatment" context on cards
- No direct "Start Consultation" button that pre-loads appointment context

**Recommended Changes:**

#### 4a. Fetch Linked Context
Update `getDentistAppointmentsAction` to include:
```sql
linked_diagnosis, linked_treatment_plan, linked_tooth_numbers, linked_episode_id
```

#### 4b. Treatment Context Badge on Cards
When `linked_diagnosis` is present, show a context strip below the appointment type:
```
┌──────────────────────────────────────┐
│ 10:30 AM — Rajesh Sharma             │
│ Follow-up (Tooth 46)                 │
│ ┌──────────────────────────────────┐ │
│ │ 🦷 Continuing: RCT Visit 2       │ │
│ │    Irreversible pulpitis — 46    │ │
│ └──────────────────────────────────┘ │
│ [Start Consultation]  [View Profile] │
└──────────────────────────────────────┘
```

#### 4c. Start Consultation Button
"Start Consultation" button navigates to Clinical mode with `appointmentId`, `patientId`, and `episodeId` pre-set so V5 auto-loads everything.

---

### 5. Image/File Drop Zone (NEW — Nisarg's Request)

**Across All Consultation Modes:**

Add a drag & drop zone component that:
- Appears in the consultation page header area (near the voice recorder)
- Accepts image files (JPG, PNG) up to 10MB
- Shows inline preview thumbnails
- Uses existing `uploadPatientFileAction` from `lib/actions/patient-files.ts`
- Auto-classifies file type (X-ray, Oral Photo, CBCT Scan) based on filename or a quick classifier
- Attaches files to the current consultation via `consultationId`
- Files appear in the patient's Files tab immediately (real-time subscription)

**Future Enhancement:** Feed dropped images into the AI diagnostic pipeline for automated analysis (caries detection, periapical lesion identification).

---

## Color Discussion: Magenta Accent

**Current palette:** Teal (#009688 / #2dd4bf) as the primary brand color across both themes.

**Magenta options to consider:**

| Shade | Hex | Use Case | Notes |
|-------|-----|----------|-------|
| Vibrant Magenta | `#E91E63` | CTA buttons, active states | Material Design Pink 500 — high energy, stands out strongly against teal |
| Soft Magenta | `#EC407A` | Badges, highlights | Slightly softer, less aggressive |
| Berry/Fuschia | `#D946EF` | AI features, accent | Tailwind fuchsia-500 — could differentiate AI-related elements |
| Rose | `#F43F5E` | Alerts, urgent items | Tailwind rose-500 — good for attention-grabbing without being "error red" |

**My recommendation:**

Use magenta as a **secondary accent**, not replacing teal as primary. Good pairings:

1. **Teal (primary) + Magenta (AI/intelligence features)** — The AI copilot panels, agent status indicators, and intelligence cards could use a magenta accent to visually distinguish "AI-generated content" from "user-entered data." This is a pattern used by GitHub Copilot (purple) and Notion AI (purple gradient).

2. **Teal (navigation/actions) + Magenta (clinical urgency)** — Use magenta for urgent/high-priority items instead of red. This avoids the "error" connotation of red while still demanding attention.

3. **Gradient: Teal → Magenta** — For the EndoFlow branding header or AI panels, a subtle teal-to-magenta gradient creates a modern, distinctive look.

**What to avoid:** Don't use magenta for all buttons/CTAs — it will clash with the teal ecosystem. Keep teal as the dominant brand color and introduce magenta selectively for a specific semantic meaning (AI, urgency, or highlights).

Would you like me to create a small color swatch component to preview the teal + magenta combinations in the app?

---

## Implementation Priority Order

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Today's View: fetch + display linked diagnosis on appointment cards | 2-3 hrs | High — dentist sees WHY each appointment exists |
| 2 | Consultation: drag & drop image/file zone | 3-4 hrs | High — Nisarg's direct request |
| 3 | Consultation: Patient Context panel (before recording) | 2-3 hrs | High — dentist reviews history before starting |
| 4 | Consultation: prominent voice recorder positioning | 1 hr | Medium — better UX |
| 5 | Tooth Dialog: unified AI panel (replace 3 tabs) | 4-6 hrs | High — better AI output display |
| 6 | Patient Profile: episode progress bars | 2-3 hrs | Medium — better visualization |
| 7 | Today's View: "Start Consultation" button with context | 1-2 hrs | Medium — streamlined workflow |
| 8 | Magenta accent integration (AI features) | 1-2 hrs | Low — visual polish |
| 9 | Patient Profile: AI Intelligence card | 3-4 hrs | Lower — enhancement |
| 10 | Consultation: AI summary card (multi-tooth overview) | 2-3 hrs | Lower — enhancement |

**Total estimated: ~22-31 hours across 3-4 sessions**
