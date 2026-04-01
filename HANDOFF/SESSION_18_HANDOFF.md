# Session 18 Handoff

**Date**: 2026-03-31
**Focus**: Co-Pilot sidebar completion — evidence tab, accept auto-save, multi-tooth workflow, copilot input wiring + Phase 2: sidebar persistence, pipeline context, multi-recording

---

## What Was Done This Session

### Task 1: Evidence Tab Wired
**Files**: `sidebar-chat-panel.tsx`, `app/api/endoflow/consultation-evidence/route.ts` (NEW)
- Created GET API route that calls `getEvidenceForConsultation()` from `ai-persistence-service.ts`
- Evidence auto-fetches when `synthesis_complete` event fires and `copilotConsultationId` is available
- Displays each citation with: rank number, title, authors, journal, year, DOI, similarity score badge
- Loading spinner during fetch, empty state with manual "Fetch Evidence" button fallback
- Falls back to "No evidence found" if RAG returned no results for that consultation

### Task 2: Pause/Resume Auto-Hidden When Recording Stopped
**File**: `sidebar-chat-panel.tsx`
- Recording controls strip already had correct branching (`isConsultationRecording ? ... : ...`)
- Active recording shows: Stop / Pause / Resume / Process / Discard
- Stopped state shows: "Recording processed" badge + Pipeline button + "Back to Master AI"
- Added "Pipeline" shortcut button in stopped controls to run diagnosis pipeline without switching tabs

### Task 3: Accept Diagnosis Auto-Save
**Files**: `sidebar-chat-panel.tsx`, `app/api/endoflow/save-tooth-diagnosis/route.ts` (NEW)
- Created POST API route for tooth diagnosis upsert (checks for existing, updates or inserts)
- "Accept & Save" button appears in copilot Diagnosis tab after synthesis result displays
- Auto-maps primary diagnosis keywords to tooth status: caries → `caries`, pulpitis/necrosis → `root_canal`, fracture → `extraction_needed`, crown → `crown`
- Saves full synthesis data: primary diagnosis, details, treatment, AAE classification, confidence, restorative diagnosis, combined treatment sequence
- Dispatches `endoflow:tooth_diagnosis_saved` → V4 listens and reloads FDI chart data
- Shows green "Saved to #XX" confirmation after successful save

### Task 4: Multiple Teeth Workflow
**Files**: `sidebar-chat-panel.tsx`, `enhanced-new-consultation-v4.tsx`
- "Next Tooth" button in copilot Diagnosis tab (next to Accept & Save)
- Dispatches `endoflow:copilot_select_tooth` event
- V4 listens: resets `selectedTooth`, closes tooth dialog, scrolls FDI chart into view
- Copilot resets synthesis state, accept state, evidence citations for the new tooth
- Stays in Co-Pilot mode throughout — no mode switch needed
- V4 now dispatches `endoflow:tooth_selected` when FDI chart tooth is clicked, copilot tracks it

### Task 5: Copilot Input Wired
**File**: `sidebar-chat-panel.tsx`
- Text input at bottom of copilot mode now connected to `processQuery` (same Master AI pipeline)
- Enter key submits, loading spinner during processing
- Disabled state while processing
- Can be used to ask co-pilot questions or type gap answers

### Task 6: State Cleanup on Back to Master AI
**File**: `sidebar-chat-panel.tsx`
- "Back to Master AI" button now resets all Session 18 state: synthesis, evidence, accept, tooth/patient context

---

## Files Changed This Session

| File | Changes |
|------|---------|
| `components/dentist/sidebar-chat-panel.tsx` | Evidence fetch+display, accept save handler, next tooth handler, copilot input wiring, 8 new state variables, 3 new callbacks, evidence auto-fetch effect, tooth_selected listener |
| `components/dentist/enhanced-new-consultation-v4.tsx` | `copilot_select_tooth` listener, `tooth_diagnosis_saved` listener, `tooth_selected` dispatch on FDI click, `data-fdi-chart` attribute |
| `app/api/endoflow/consultation-evidence/route.ts` | **NEW**: GET route for evidence citations |
| `app/api/endoflow/save-tooth-diagnosis/route.ts` | **NEW**: POST route for tooth diagnosis upsert from copilot |

---

## CustomEvent Bus (Complete Map After Session 18)

| Event | Dispatched By | Listened By | Payload |
|-------|---------------|-------------|---------|
| `endoflow:start_recording` | page.tsx | sidebar, GlobalVoiceRecorder | — |
| `endoflow:recording_started` | GlobalVoiceRecorder | sidebar | — |
| `endoflow:recording_stopped` | GlobalVoiceRecorder | sidebar | — |
| `endoflow:stop_recording` | sidebar buttons | GlobalVoiceRecorder | — |
| `endoflow:pause_recording` | sidebar buttons | GlobalVoiceRecorder | — |
| `endoflow:resume_recording` | sidebar buttons | GlobalVoiceRecorder | — |
| `endoflow:process_recording` | sidebar buttons | GlobalVoiceRecorder | — |
| `endoflow:mic_deactivate` | page.tsx, GlobalVoiceRecorder | sidebar | — |
| `endoflow:ai_results_ready` | GlobalVoiceRecorder | sidebar | processedContent, toothDiagnoses, consultationId |
| `endoflow:synthesis_complete` | diagnostic-gap-dialog | sidebar | synthesis, toothNumber, patientId, batchTimeMs |
| `endoflow:run_diagnosis_pipeline` | sidebar | V4 | — |
| `endoflow:tooth_selected` | V4 (FDI chart click) | sidebar | toothNumber, patientId |
| `endoflow:copilot_select_tooth` | sidebar (Next Tooth) | V4 | — |
| `endoflow:tooth_diagnosis_saved` | sidebar (Accept) | V4 | toothNumber, patientId |
| `endoflow:mic_started` | MicPod | sidebar, app-sidebar | — |
| `endoflow:mic_stopped` | MicPod | sidebar | — |
| `endoflow:mic_transcript` | MicPod | sidebar | text, isFinal |

---

## Full Copilot Workflow After Session 18

```
1. Recording starts → sidebar switches to Co-Pilot mode
2. Active recording: Stop / Pause / Resume / Process / Discard buttons visible
3. Recording stops → "Recording processed" badge + Pipeline + Back to Master AI
4. AI processes transcript → ai_results_ready fills Diagnosis/Treatment/Gaps tabs
5. Dentist clicks tooth in FDI → tooth_selected updates copilot context
6. Dentist clicks "Run Pipeline" → opens ToothDiagnosisDialogV2 with gap-filling
7. Gap-filling completes → synthesis_complete fills Diagnosis/Treatment with full results
8. Evidence auto-fetches → Evidence tab shows RAG citations
9. Dentist clicks "Accept & Save" → diagnosis saved to tooth_diagnoses, FDI chart refreshes
10. Dentist clicks "Next Tooth" → copilot resets, FDI chart scrolls into view, ready for next
11. Repeat 5-10 for each tooth
12. Dentist clicks "Back to Master AI" → all copilot state resets, sidebar returns to teal mode
```

---

## Known Issues (Carried Forward from Session 17)

1. **Wake word "EndoFlow"** — still inconsistent with Deepgram transcription
2. **Pre-existing TS errors** — ~40 errors in V4 (type narrowing on ConsultationData), none from session 18
3. **Gap questions are static** — from templates, not transcript-aware (needs LLM-based generation)
4. **Deepgram segment breaks** — occasional brief transcript resets during reconnects
5. **Mic cleanup race condition** — possible mic stays listening after all close

---

## What To Do Next Session (Session 19)

### Priority 1: Transcript Quality
1. Upgrade to Deepgram nova-3-medical if available
2. Enable diarization (`diarize=true`) for speaker labels (Dr./Patient)
3. Add `endpointing=400` to prevent mid-sentence splits
4. Fix mic cleanup race condition

### Priority 2: Gap Questions Intelligence
1. Make transcript-aware — LLM step to analyze conversation and generate custom questions
2. Pass full transcript to gap-finder so it knows what info was already provided

### Priority 3: Data Verification
1. Check `ai_synthesis_results` table has records for consultations
2. Verify RAG retrieval — check `medical_knowledge` table embeddings and similarity search
3. Check `consultation_evidence` table for citations
4. Verify `tooth_diagnoses` table has correct color codes for FDI chart

### Priority 4: Production Readiness
1. Remove dev fallback data and preview bypass
2. HIPAA compliance review
3. CI/CD pipeline setup
4. Patient/Assistant dashboard dark theme completion

---

## Session 18b: Additional Fixes (Workflow Polish)

### Fix 1: Sidebar State Persistence
**File:** `components/dentist/app-sidebar.tsx`
- Changed SidebarChatPanel from conditional render (`{!isCollapsed && ...}`) to CSS hidden (`className={cn(..., isCollapsed && "hidden")}`)
- Component stays always mounted → copilot mode, AI results, evidence, transcript context all survive collapse/expand
- Auto-expand sidebar when recording starts (if collapsed)

### Fix 2: Pipeline Gets Consultation Context
**File:** `components/dentist/enhanced-new-consultation-v4.tsx`
- Added `buildConversationContext()` helper that maps V4's flat `consultationData` to nested `ConversationContext` interface
- Maps: chiefComplaint, painLocation, painDuration, painTriggers, painCharacter, painIntensity, painRelief, medicalHistory, medications, allergies, clinical exam findings
- Passes `conversationContext` and `patientAge` props to `ToothDiagnosisDialogV2`
- Pipeline agents now receive real clinical data instead of empty `{}`

### Fix 3: Multi-Recording / Multi-Tooth Workflow
**Files:** `GlobalVoiceRecorder.tsx`, `sidebar-chat-panel.tsx`
- Added `skipProcessOnStopRef` flag and `stopRecordingNoProcess()` function
- New event: `endoflow:stop_recording_no_process` — stops recording, accumulates segment, but skips AI processing
- Copilot Stop button now uses this event (stop without process)
- Process button sends all accumulated segments to AI pipeline
- Stopped state shows: "Record More" (restart for another tooth), "Process All" (send all to AI), "Pipeline" (run per-tooth diagnosis)
- Process event handler also works when recording is already stopped but segments are accumulated

### Multi-Tooth Workflow
```
Record tooth #14 findings → Stop (segment saved)
Record tooth #36 findings → Stop (segment saved)
Click "Process All" → all segments merged → AI extracts findings for both teeth
Click tooth #14 in FDI chart → Run Pipeline → AI diagnosis with full context
Click "Next Tooth" → select #36 → Run Pipeline → AI diagnosis with full context
Accept & Save both → FDI chart updates
```

### Additional Files Modified (18b)
| File | Changes |
|------|---------|
| `components/dentist/app-sidebar.tsx` | CSS hidden instead of conditional render; auto-expand on recording |
| `components/dentist/enhanced-new-consultation-v4.tsx` | `buildConversationContext()` helper; pass to dialog; `useCallback` import; fixed JSX pattern for SWC |
| `components/consultation/GlobalVoiceRecorder.tsx` | `skipProcessOnStopRef`; `stopRecordingNoProcess()`; `stop_recording_no_process` event; enhanced `process_recording` for accumulated segments |
| `components/dentist/sidebar-chat-panel.tsx` | Stop → stop_recording_no_process; Record More + Process All buttons in stopped state |
