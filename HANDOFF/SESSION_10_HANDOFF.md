# Session 10 Handoff — Longitudinal Patient Tracking System

**Date:** 2026-03-29
**Duration:** Full session
**Dentist:** Dr. Nisarg (Endodontist)

---

## What Was Built This Session

### The Core Vision
A complete longitudinal patient tracking system that follows a patient's clinical journey from first consultation through treatment completion and follow-up. Before this session, every consultation was an isolated snapshot — no way to track a tooth's journey, group multi-visit treatments, or evaluate progress over time.

### 6 Phases Implemented

#### Phase 1: Database Schema Foundation
**SQL files in `sql/` directory (all executed in Supabase):**

- `sql/001_treatment_episodes.sql` — 3 new tables:
  - **`api.treatment_episodes`** — Groups related visits under one clinical unit (single tooth or prosthetic group like a bridge). Fields: patient_id, dentist_id, episode_type, linked_teeth (array), original_diagnosis, treatment_plan, combined_treatment_sequence, planned_visits, completed_visits, status (planned→in_progress→completed→failed), priority, outcome, ai_prognosis. Indexes on patient_id, status, linked_teeth (GIN).
  - **`api.episode_visits`** — Individual visits within an episode. Fields: episode_id (FK CASCADE), consultation_id, appointment_id, visit_number, visit_type (treatment/follow_up/emergency/review), procedures_done (JSONB), materials_used (JSONB), complications, clinical_notes, next_visit_plan, ai_progress_assessment (JSONB), dentist_confirmed (boolean — human-in-the-loop gate).
  - **`api.tooth_timeline`** — Chronological event log per tooth. Fields: patient_id, tooth_number, event_type (diagnosis/treatment_start/treatment_visit/treatment_complete/follow_up/new_finding/status_change), episode_id, consultation_id, description, previous_status, new_status, data_snapshot (JSONB).

- `sql/002_add_consultation_linkage_columns.sql` — Added to existing tables:
  - `api.appointments` ← `consultation_id UUID`
  - `api.consultations` ← `appointment_id UUID`, `consultation_mode TEXT`, `episode_id UUID`, `image_references JSONB`

- `sql/003_episodes_rls_policies.sql` — RLS policies + GRANT permissions for all 3 new tables.

**Drizzle schema updated:** `lib/db/schema.ts` — 3 new table definitions + columns on appointments/consultations. Types exported: `TreatmentEpisode`, `EpisodeVisit`, `ToothTimelineEvent`.

#### Phase 2: Server Actions (CRUD)

- **`lib/actions/treatment-episodes.ts`** — 6 functions:
  - `createTreatmentEpisodeAction`, `getTreatmentEpisodesForPatientAction`, `getActiveEpisodesForPatientAction`, `updateTreatmentEpisodeAction`, `getEpisodeWithVisitsAction`, `getEpisodesForToothAction`

- **`lib/actions/episode-visits.ts`** — 4 functions:
  - `createEpisodeVisitAction` (auto-increments episode.completed_visits, auto-transitions status)
  - `getEpisodeVisitsAction`, `updateEpisodeVisitAction`, `confirmVisitAssessmentAction` (human-in-the-loop)

- **`lib/actions/tooth-timeline.ts`** — 3 functions:
  - `addToothTimelineEventAction`, `getToothTimelineAction`, `getPatientFullTimelineAction` (combines tooth_timeline + consultations + appointments into unified chronological view)

- **`lib/actions/consultation.ts`** — ~25 lines added to `finalizeConsultationFromDraftAction`:
  - Bidirectional linking: `appointments.consultation_id` ↔ `consultations.appointment_id`
  - Stores `consultation_mode` and `episode_id` on consultation record
  - Calls sync engine (Phase 3) after existing prescription/follow-up sync

#### Phase 3: Sync Engine

- **`lib/services/consultation-sync-engine.ts`** — `syncConsultationToPatientProfile()`:
  - Triggered automatically when a consultation is completed
  - Compares each tooth's status against `latest_tooth_diagnoses` view
  - Creates `tooth_timeline` entries for status changes and new diagnoses
  - Auto-creates `treatment_episodes` for teeth with treatment plans (estimated visits: RCT=3, implant=4, extraction=1, crown=2, bridge=3, filling=1)
  - For treatment_visit/follow_up modes: logs episode_visit, increments completed_visits, transitions episode status
  - Fully try/catch wrapped — never blocks consultation save on failure

#### Phase 4: Consultation Mode System

- **4 consultation modes** controlling which UI sections are visible:
  - **New Consultation** — Renders V4 completely unchanged (zero behavior modification)
  - **Treatment Visit** — 5 tabs: Episode Progress, Procedures Done, Materials Used, Clinical Notes, Next Visit Plan
  - **Follow-Up** — 4 tabs: Episode Progress, Healing Status, Outcome Evaluation, Clinical Notes
  - **Emergency** — 2 tabs: Quick Examination, Immediate Treatment

- **`lib/types/consultation-modes.ts`** — Mode type definitions and configuration map

- **`components/consultation/ConsultationModeSelector.tsx`** — 4-button horizontal bar with auto-detection from appointment type

- **`components/dentist/enhanced-new-consultation-v5.tsx`** — Wraps V4 for new_consultation mode, renders mode-specific layouts for others. Each tab is a clickable card that opens a dialog with a real interactive form. Save handler calls `finalizeConsultationFromDraftAction` with mode metadata.

- **8 new tab components in `components/consultation/tabs/`:**
  - `TreatmentProgressTab.tsx` — Episode context + progress bar + visit history
  - `ProceduresDoneTab.tsx` — Procedure list with quick-add buttons (Access opening, BMP, Crown prep, etc.)
  - `MaterialsUsedTab.tsx` — Material/instrument entry
  - `ClinicalNotesTab.tsx` — Notes + complications textarea
  - `NextVisitPlanTab.tsx` — Plan text + date picker
  - `HealingStatusTab.tsx` — 5 healing options (normal/delayed/complication/failure/new issue)
  - `OutcomeEvaluationTab.tsx` — Success/partial/failure selector
  - `QuickExamTab.tsx` — Pain scale + clinical flags + findings
  - `ImmediateTreatmentTab.tsx` — Emergency treatment recording

- **`app/dentist/page.tsx`** — Updated to render V5 in Clinical mode

#### Phase 5: Enhanced Patient Profile (Revised to 5-Tab Layout)

**Original 8 tabs → 5 tabs:**

| Old Tab | New Location |
|---------|-------------|
| Overview | **Overview** (kept, enhanced) |
| Episodes | **Journey** (merged) |
| Treatments | **Journey** (merged — old flat records replaced by episode view) |
| Diagnosis | **Dental Chart** (merged — click tooth for diagnosis) |
| Timeline | **Journey** (merged) |
| Follow-ups | **Rx & Appt** (merged) |
| X-rays & Photos | **Files** (renamed) |
| Dental Chart | **Dental Chart** (kept, enhanced with side panel) |

**New components:**
- **`components/dentist/patient-journey-tab.tsx`** — Unified longitudinal view. Episodes as primary grouping with inline expandable visit timelines. Standalone events (consultations, appointments not tied to episodes) shown separately. Search, status filter, tooth filter.
- **`components/dentist/patient-rx-appointments-tab.tsx`** — Upcoming/past appointments + active/past medications.
- **`components/dentist/enhanced-dental-chart-tab.tsx`** — FDI chart + side panel on tooth click showing episodes and timeline for that tooth.

**Modified:** `components/dentist/enhanced-patients-interface.tsx` — 5-tab layout, added appointments/prescriptions state loading.

#### Phase 6: AI Tracking Pipeline

- **`lib/services/tracking-pipeline.ts`** — Separate from the diagnostic pipeline. Uses `aiChatCompletion` (Claude/Gemini router). Input: episode context + visit history + current transcript/findings. Output: progress assessment, healing evaluation (follow-up only), new findings detection, recommended next steps. Includes safe fallback if AI fails.

- **`lib/actions/tracking-pipeline.ts`** — `runTrackingPipelineAction()` — fetches episode, runs pipeline, returns assessment (does NOT auto-apply).

- **`components/consultation/TrackingAssessmentPanel.tsx`** — Renders AI output with progress bar, healing evaluation, new findings, next steps. **Two buttons: "Confirm & Apply" / "Dismiss"** — human-in-the-loop gate. Nothing persisted without dentist confirmation.

- Integrated into V5: In treatment_visit and follow_up modes, "Run AI Treatment Assessment" button appears when episode is selected.

### Additional Fix: Wake Word Crash Prevention

- **`components/dentist/endoflow-voice-controller.tsx`** — Added `micPermissionDeniedRef` flag to prevent infinite retry loop when microphone permission is denied. Previously, the wake word system would spam-retry after denial, crashing the page in environments without mic access.

---

## End-to-End Test Results

**Test script:** `scripts/test-e2e-longitudinal.mjs`
**Result:** 43/43 tests passed

Test data inserted for patient **Goli Hathi** (ID: `9f5bcf05-c3d5-48f0-867f-f91a45befc2e`):
- 1 treatment episode: "Irreversible Pulpitis" → "RCT + Crown" on tooth 36, 4 planned visits, status=completed, outcome=success
- 5 episode visits: Access opening → BMP → Obturation → Crown delivery → Follow-up (healing normal)
- 5 tooth timeline entries: diagnosis → treatment_start → treatment_visit → treatment_complete → follow_up

**Database tables confirmed existing via direct Supabase query.**

---

## What's NOT Connected (Remaining Gaps)

### Gap 1: FDI Chart Colors Don't Reflect Episode Data
**Problem:** The `InteractiveDentalChart` reads tooth colors from `api.tooth_diagnoses` table (the old system). The sync engine writes to `api.tooth_timeline` and `api.treatment_episodes` (the new system) but does NOT update `tooth_diagnoses` status/color_code.

**Result:** Tooth 36 has an RCT episode in the journey tab, but shows as default/healthy on the FDI chart.

**Fix:** In `consultation-sync-engine.ts`, after creating a timeline event with `new_status`, also upsert into `tooth_diagnoses`:
```typescript
// After creating timeline event with status change
await supabase.schema('api').from('tooth_diagnoses').upsert({
  patient_id: patientId,
  consultation_id: consultationId,
  tooth_number: toothNumber,
  status: newStatus,
  color_code: getStatusColorCode(newStatus),
  primary_diagnosis: diagnosis,
  recommended_treatment: treatmentPlan,
}, { onConflict: 'consultation_id,tooth_number' })
```
This bridges the old and new systems — the chart reads from tooth_diagnoses, the sync engine keeps it updated.

### Gap 2: Dental Chart Tooth Click Conflict
**Problem:** When you click a tooth in the enhanced dental chart tab, TWO things happen:
1. The `InteractiveDentalChart` opens its own `ToothDiagnosisDialogV2` (old behavior)
2. The `EnhancedDentalChartTab` opens the history side panel (new behavior)

They compete visually.

**Fix:** In `EnhancedDentalChartTab`, pass a prop to `InteractiveDentalChart` to suppress the dialog and only fire the `onToothSelect` callback. OR: Modify the chart's click handler to check if `onToothSelect` is provided and skip the dialog in that case.

### Gap 3: Overview Tab "Active Treatments" Stat
**Problem:** The Overview tab counts "Active Treatments" from the old `treatments` table, not from `treatment_episodes`.

**Fix:** In `patient-overview-tab.tsx`, replace the treatments count with a count from `getActiveEpisodesForPatientAction` (already called in the component — just use its result for the stat card).

### Gap 4: Episode → Consultation Navigation
**Problem:** Clicking an episode or timeline entry in the Journey tab doesn't navigate to the related consultation. No "Open Consultation" button.

**Fix:** Add a button to each episode card and visit entry that navigates to the consultation view. Use the `consultation_id` from `episode_visits` or `consultations.appointment_id` link to open the correct consultation in Clinical mode.

### Gap 5: Consultation Save → Episode Visit Auto-Creation
**Problem:** The sync engine auto-creates episodes and timeline entries, but when saving a Treatment Visit or Follow-Up consultation in V5, the `episodeId` and `consultationMode` need to be correctly passed through to `finalizeConsultationFromDraftAction`. Currently the V5 save handler packs them into `consultationData`, and the finalize action reads them — but this path hasn't been tested end-to-end through the UI (only the test script verified direct database operations).

**Fix:** Test the complete flow: Open Treatment Visit mode → select patient → select episode → fill tabs → click Complete → verify episode_visit created, completed_visits incremented, tooth_timeline entry added.

### Gap 6: Old System Data Migration
**Problem:** Existing data in `treatments` and `tooth_diagnoses` tables from before this session has no corresponding `treatment_episodes` or `tooth_timeline` entries.

**Fix:** Write a one-time migration script that:
1. Reads all existing `tooth_diagnoses` with `recommended_treatment`
2. Creates `treatment_episodes` for each
3. Reads all existing `treatments` with `consultation_id`
4. Creates `episode_visits` and `tooth_timeline` entries
This backfills the longitudinal data for existing patients.

---

## Files Created This Session

### SQL Migrations (run in Supabase)
- `sql/001_treatment_episodes.sql`
- `sql/002_add_consultation_linkage_columns.sql`
- `sql/003_episodes_rls_policies.sql`

### Server Actions
- `lib/actions/treatment-episodes.ts`
- `lib/actions/episode-visits.ts`
- `lib/actions/tooth-timeline.ts`
- `lib/actions/tracking-pipeline.ts`

### Services
- `lib/services/consultation-sync-engine.ts`
- `lib/services/tracking-pipeline.ts`

### Types
- `lib/types/consultation-modes.ts`

### Components — Consultation Modes
- `components/consultation/ConsultationModeSelector.tsx`
- `components/consultation/TrackingAssessmentPanel.tsx`
- `components/consultation/tabs/TreatmentProgressTab.tsx`
- `components/consultation/tabs/ProceduresDoneTab.tsx`
- `components/consultation/tabs/MaterialsUsedTab.tsx`
- `components/consultation/tabs/ClinicalNotesTab.tsx`
- `components/consultation/tabs/NextVisitPlanTab.tsx`
- `components/consultation/tabs/HealingStatusTab.tsx`
- `components/consultation/tabs/OutcomeEvaluationTab.tsx`
- `components/consultation/tabs/QuickExamTab.tsx`
- `components/consultation/tabs/ImmediateTreatmentTab.tsx`

### Components — Patient Profile
- `components/dentist/patient-journey-tab.tsx`
- `components/dentist/patient-rx-appointments-tab.tsx`
- `components/dentist/enhanced-dental-chart-tab.tsx`
- `components/dentist/patient-overview-tab.tsx` (modified)
- `components/dentist/patient-episodes-tab.tsx` (created, now merged into journey)

### Components — Consultation V5
- `components/dentist/enhanced-new-consultation-v5.tsx`

### Test Script
- `scripts/test-e2e-longitudinal.mjs`

## Files Modified This Session

| File | Change |
|------|--------|
| `lib/db/schema.ts` | 3 new table defs + columns on appointments/consultations |
| `lib/actions/consultation.ts` | ~25 lines: bidirectional linking + sync engine hook |
| `app/dentist/page.tsx` | V5 consultation tab rendering |
| `components/dentist/enhanced-patients-interface.tsx` | 8→5 tab layout, appointments/prescriptions loading |
| `components/dentist/endoflow-voice-controller.tsx` | Wake word retry prevention |

---

## Priority Order for Next Session

1. **Fix Gap 1** (FDI chart colors) — Most visible issue, breaks the visual feedback loop
2. **Fix Gap 2** (chart click conflict) — UX confusion
3. **Fix Gap 5** (UI save flow test) — Must verify the full chain works through the browser
4. **Fix Gap 3** (overview stat) — Quick fix
5. **Fix Gap 4** (navigation links) — Quality of life
6. **Fix Gap 6** (data migration) — Backfill for existing patients

---

## Architecture Diagram

```
PATIENT ENTERS CLINIC
         ↓
    Registration (existing)
         ↓
    First Consultation (New Consultation mode — V4 unchanged)
    ├── Voice recording → AI diagnostic pipeline
    ├── FDI Chart → tooth diagnoses
    ├── Case history tabs (CC, HOPI, Medical Hx, etc.)
    └── Save → Sync Engine triggers:
        ├── tooth_timeline entries created
        ├── treatment_episodes auto-created
        └── tooth_diagnoses updated (GAP — not yet)
         ↓
    Treatment Visit (Treatment Visit mode — V5)
    ├── Episode context shown (original diagnosis, plan, progress)
    ├── Procedures Done, Materials Used, Clinical Notes tabs
    ├── AI Tracking Pipeline → progress assessment
    ├── Dentist confirms assessment
    └── Save → Sync Engine:
        ├── episode_visit logged
        ├── completed_visits incremented
        ├── tooth_timeline event added
        └── Episode status: in_progress → completed (if visits done)
         ↓
    Follow-Up (Follow-Up mode — V5)
    ├── Healing Status assessment
    ├── Outcome Evaluation
    ├── AI Tracking Pipeline → healing evaluation
    └── Save → episode outcome set (success/failure)
         ↓
    Patient Profile (PMS — 5 tabs)
    ├── Overview: active episodes, medications, upcoming appointments
    ├── Dental Chart: FDI with tooth history side panel
    ├── Journey: episodes + visit timelines + standalone events
    ├── Files: X-rays, photos, documents
    └── Rx & Appt: medications + appointment history
```
