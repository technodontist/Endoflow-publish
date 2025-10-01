# ENDOFLOW Clinically‑Aware Appointments

Consultation ↔ Appointment ↔ Treatment Integration (Parallel, Non‑Breaking)

Last updated: 2025‑09‑26

## TL;DR
We added a new, optional “contextual” appointment workflow that links appointments directly to consultations and planned treatments. It runs in parallel to the old/simple flow, so nothing breaks. New treatment appointments automatically update treatment status and keep the original consultation’s JSON in sync. A bird’s‑eye patient timeline shows consultations and appointments in one stream.

## Goals
- Make appointments clinically‑aware: each appointment can reference the prior consultation and the specific treatment it is for.
- Keep the existing simple appointment path intact; run the new flow in parallel.
- Reflect true clinical progress (Planned → In Progress → Completed) across appointments, treatments, and consultations in real‑time views.

## What was added (high level)
- Database enhancements (columns + helper RPC)
- New server actions for contextual creation and completion
- New contextual appointment form (assistant + dentist routes)
- Bird’s‑eye patient timeline (combined consultations + appointments)
- Safety/UX fixes (null‑safe Today’s View; keydown guards on contextual pages; search input submit prevention)

---

## Phase 1 — Database Enhancements (Non‑Breaking)
Schema: `api`

1) Appointments table additions
- `appointment_type TEXT`
- `consultation_id UUID REFERENCES api.consultations(id) ON DELETE SET NULL`
- `treatment_id UUID REFERENCES api.treatments(id) ON DELETE SET NULL`
- Helpful indexes on these columns

2) Treatments table addition (parallel status)
- `planned_status TEXT DEFAULT 'Planned'`
  - We keep legacy `status` for app logic (`pending|in_progress|completed|cancelled`).
  - `planned_status` allows recording the higher‑level clinical intent without breaking existing flows.

3) Consultations table safeguard
- `clinical_data JSONB NOT NULL DEFAULT '{}'` (for nested treatment objects inside consultation)

4) RPC for JSONB status update
- `public.update_consultation_treatment_status(p_consultation_id UUID, p_treatment_id UUID, p_new_status TEXT)`
  - Finds the treatment entry inside `consultations.clinical_data->'treatments'` by id and sets its `status` (JSONB safe update).
  - Also updates the treatment table's `planned_status` and `status` fields.

> Status: Migration created and deployed (2025-09-26). The function is located in `supabase/migrations/20250926_001_add_update_consultation_treatment_status_function.sql`.
> Note: The code includes fallback logic in case the RPC function is not available in the schema cache.

---

## Phase 2 — New Server Actions (Parallel to existing logic)
File: `lib/actions/contextual-appointments.ts`

### `createContextualAppointment(input)`
- Input includes: `patientId, dentistId, scheduledDate, scheduledTime, appointmentType, (optional) consultationId, (optional) treatmentId, (optional) toothNumbers[], (optional) toothDiagnosisIds[]`.
- Validation rules:
  - If `appointmentType` is `treatment` or `follow_up` → `consultationId` required.
- Inserts the appointment with `appointment_type`, `consultation_id`, and `treatment_id`.
- If `appointmentType === 'treatment'` and `treatmentId` provided, also updates the treatment to:
  - `planned_status = 'In Progress'` (new parallel field)
  - `status = 'in_progress'` and `started_at = now()` (keeps legacy app logic in sync)
- Tooth linkage (non-fatal):
  - Derives tooth/diagnosis from `treatmentId` if available.
  - Inserts rows into `api.appointment_teeth` from `toothDiagnosisIds` (with primary_diagnosis) and/or `toothNumbers` (best-effort lookup under same consultation).

### `completeTreatment(appointmentId)`
- Step A: Fetch `treatment_id` and `consultation_id` via the appointment.
- Step B: Mark the treatment as completed in both worlds:
  - `planned_status = 'Completed'`
  - `status = 'completed'` and `completed_at = now()`
- Step C: Update `consultations.clinical_data` JSONB with RPC:
  - `select api.update_consultation_treatment_status(consultation_id, treatment_id, 'Completed')`

> Status: Implemented. Existing simple actions untouched.

---

## Phase 3 — Contextual Appointment Form (UI)
Component: `components/appointments/ContextualAppointmentForm.tsx`

Routes (separate pages to avoid disturbing old flow):
- Dentist: `/dentist/contextual-appointment`
- Assistant: `/assistant/contextual-appointment`

What it does
- Dropdown: `appointment_type` = `first_visit | consultation | treatment | follow_up`.
- If `treatment` or `follow_up`: loads patient’s past consultations for selection.
- If `treatment`: parses `consultation.clinical_data.treatments` and lists treatments with `Planned/Pending` status only.
- Tooth capture:
  - If a DB treatment is chosen, carries its `tooth_number` and `tooth_diagnosis_id` (when present).
  - If a recommendation from `tooth_diagnoses` is chosen, carries its `tooth_number` and `id`.
- On submit: calls `createContextualAppointment()`.
  - For treatment appointments, it automatically flips the treatment to **In Progress**.
  - Links teeth to the created appointment (see `api.appointment_teeth`).

Key UX safeties
- Prevented accidental page navigation/submit on keydown in contextual pages.

---

## Phase 4 — Bird’s‑Eye Patient Timeline
Server action: `lib/actions/patient-events.ts`
- `getPatientEventsCombinedAction(patientId)` returns a chronologically sorted list of events combining:
  - Consultation created events
  - Appointments (typed: First Visit, Consultation, Treatment, Follow‑up)

Component: `components/dentist/patient-birdseye-timeline.tsx`
Page: `/dentist/patient-timeline?patientId=<uuid>`
Enhancements:
- Client-side version now also fetches `api.appointment_teeth` and shows linked tooth numbers next to appointment entries.

---

## UX/QA Fixes
- Today’s View crash: sorted by `scheduled_time || scheduledTime` (null‑safe) to avoid `localeCompare` on undefined.
- Prevented global keydown/implicit submit redirections on contextual pages and the search panel.

---

## How to Use (Step‑by‑Step)
1) Create a treatment appointment linked to a planned treatment
   - Go to `/dentist/contextual-appointment` (or Assistant route)
   - Select type = `Treatment`
   - Pick a past consultation
   - Choose a planned treatment from that consultation
   - Submit → appointment created and treatment moved to **In Progress**

2) Complete a treatment appointment
   - When finishing, call `completeTreatment(appointmentId)` (via UI button or action)
   - This marks the treatment **Completed** and updates the consultation’s JSON.

3) Bird’s‑eye view
   - Open `/dentist/patient-timeline?patientId=<uuid>` to see a combined timeline of consultations and appointments.

---

## Where to Find the New Code
- Actions
  - `lib/actions/contextual-appointments.ts`
  - `lib/actions/patient-events.ts`
- UI
  - `components/appointments/ContextualAppointmentForm.tsx`
  - `components/dentist/patient-birdseye-timeline.tsx`
  - Pages
    - `/dentist/contextual-appointment` → `app/dentist/contextual-appointment/page.tsx`
    - `/assistant/contextual-appointment` → `app/assistant/contextual-appointment/page.tsx`
    - `/dentist/patient-timeline` → `app/dentist/patient-timeline/page.tsx`
- Small UX fixes
  - Today’s View sorter: `components/dentist/todays-view.tsx`
  - Search guard: `components/patient-search-panel.tsx`

---

## Data Model (added/used)
- `api.appointments`
  - `appointment_type TEXT`
  - `consultation_id UUID` (nullable)
  - `treatment_id UUID` (nullable)
- `api.treatments`
  - `planned_status TEXT DEFAULT 'Planned'` (parallel to legacy `status`)
  - legacy fields: `status`, `started_at`, `completed_at`, `total_visits`, etc.
- `api.consultations`
  - `clinical_data JSONB` (contains `treatments` array for planned items)
- `api.appointment_teeth`
  - Links appointments to one or more teeth and (optionally) tooth_diagnoses and diagnosis text.
  - Columns: `appointment_id`, `consultation_id`, `tooth_number`, `tooth_diagnosis_id (nullable)`, `diagnosis (nullable)`

---

## FDI Chart Integration and Tooth Status Lifecycle (2025‑09‑26)

This section documents the new end‑to‑end behavior connecting consultation diagnoses, treatment appointments, and the FDI dental chart colors.

Key principles
- Single source of truth for tooth status: api.tooth_diagnoses
- Chart read path:
  - In a consultation context: load rows for that consultation (per‑tooth)
  - Otherwise: load the latest row per tooth (view: api.latest_tooth_diagnoses)
- Realtime: one subscription on api.tooth_diagnoses for the patient; any change triggers a reload

Central helpers
- File: lib/utils/toothStatus.ts
  - mapInitialStatusFromDiagnosis(diagnosis, plan) → ToothStatus
  - mapFinalStatusFromTreatment(treatment) → ToothStatus | null

Initial status (Consultation save)
- When saving the clinical record for a tooth (InteractiveDentalChart → Save Clinical Record):
  - If the user didn’t explicitly change the status, we derive it with mapInitialStatusFromDiagnosis using diagnosis/treatment plan text
  - We upsert api.tooth_diagnoses with: status, primary_diagnosis, recommended_treatment, examination_date, follow_up_required
  - The FDI chart updates immediately via realtime

In‑progress behavior (Treatment started)
- When an appointment’s status transitions to in_progress, we bump linked teeth to attention (orange) so the chart reflects ongoing work
  - Resolution order to find teeth: treatment.tooth_diagnosis_id → (consultation_id + tooth_number) → appointment_teeth → latest per tooth

Final status (Treatment completed)
- When an appointment transitions to completed, we infer the final status via mapFinalStatusFromTreatment and update api.tooth_diagnoses
  - Example mappings: Filling → filled (blue); Root canal → root_canal (purple); Crown → crown (yellow); Extraction → missing (gray); Implant → implant (cyan)

Files changed today
- components/dentist/interactive-dental-chart.tsx
  - Persists consultation saves to api.tooth_diagnoses (initial mapping)
  - Keeps realtime reload and status badges/colors
- lib/actions/treatments.ts
  - Centralized final mapping; in_progress bump to attention; completion sets final status
- lib/actions/contextual-appointments.ts
  - Links appointment to teeth; best‑effort bump to attention on creation for treatment/follow_up
- lib/utils/toothStatus.ts (new)
  - Central mapping helpers

Done
- Persist consultation saves → tooth_diagnoses with derived initial status
- Realtime chart refresh wired
- Appointment in_progress → attention (orange) on linked teeth
- Appointment completed → inferred final color (filled/root_canal/crown/missing/implant/healthy)
- Unified status mapping helpers and refactors

Pending / next steps
- Confirm/adjust mapping tables (diagnosis → initial, treatment → final) per clinical preference
- Add unit tests for mapping helpers and status sync functions
- Toggle: make the creation‑time bump to attention optional (config flag)
- Ensure RLS policies cover new flows (assistants/dentists update; patients read)
- Add UI cues in organizer/timeline to reflect in_progress and completed with the same colors
- Performance: consider batched updates for multi‑tooth operations

---

## Follow-Up Appointment System (2025-09-26)

This section documents the follow-up appointment system that links to treatment appointments and tracks follow-up schedules.

### Key Features
- Follow-up appointments can link to previous treatment appointments
- Track specific tooth/diagnosis/treatment relationships for follow-ups
- Show follow-up timeline for treatments (e.g., "3-month follow-up", "2-day post-op")
- Interactive follow-up tab in consultation interface (similar to treatment overview)
- Follow-up overview showing completed and pending follow-ups per treatment

### Database Structure
- Follow-up appointments use existing `api.appointments` table
- `appointment_type = 'follow_up'` or `'follow-up'`
- `consultation_id` references the original consultation
- `treatment_id` references the specific treatment being followed up
- `appointment_teeth` links follow-ups to specific teeth/diagnoses

### Follow-Up Workflow
1. **During Treatment Completion**: Option to schedule follow-up appointments
2. **Follow-Up Creation**: Links to parent treatment appointment and consultation
3. **Follow-Up Overview**: Shows timeline of follow-ups per treatment/tooth
4. **Interactive Tab**: Manage follow-ups directly from consultation interface

### Components and Actions
- `lib/actions/followup-overview.ts` - Follow-up data management
- Interactive follow-up tab in consultation v2 interface
- Follow-up appointment creation from treatment completion
- Timeline calculation showing days/weeks/months since treatment

### Status Flow
```
Treatment Completed → Follow-Up Scheduled → Follow-Up Completed
                  ↓
            Additional follow-ups can be scheduled
```

---

## Known Gaps & Next Steps
- Classic scheduler doesn't show the selected patient by default. Optionally pass `?patientId=` to the organizer and render a "Scheduling for <name>" header.
- Add in‑form patient picker for contextual pages (instead of pasting UUID).
- Enrich timeline UI with the same badges/colors used in organizer.
- Add deep link buttons on diagnosis → "Create treatment appointment for this diagnosis".
- Implement automated follow-up reminders based on treatment type and timeline
- Add follow-up templates for common treatments (e.g., RCT follow-up at 3 months, 6 months)

---

## Troubleshooting
- If you see `localeCompare` errors in Today’s View, ensure the sorter is reading `scheduled_time || scheduledTime`.
- If typing in contextual pages or patient search causes redirects, confirm keydown prevention is present on those pages.
- After adding new routes or actions, restart the dev server to clear prior error state.

---

## Why this is non‑breaking
- We added columns and a new `planned_status`, but we did not remove or repurpose fields the legacy flow relies on.
- New pages (contextual) are separate from the classic scheduling path; teams can migrate gradually.
