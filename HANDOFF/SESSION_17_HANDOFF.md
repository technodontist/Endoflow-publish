# Session 17 Handoff

**Date**: 2026-03-31
**Focus**: Voice-first consultation UI redesign, sidebar Co-Pilot mode transformation, pipeline integration

---

## What Was Done This Session

### Phase 1: Main Consultation Area Restructure
**File**: `components/dentist/enhanced-new-consultation-v4.tsx`
- Replaced the old layout (patient card, progress card, section grid) with voice-first layout
- **Live Transcript Card** at top — shows real-time Deepgram transcript with word count, section-fill badges
- **Compact FDI Chart** directly below — inline legend, no duplicated tooth data grid
- **Upload blocks** — ConsultationImageUploader unchanged
- **Collapsed Case History** — all 12 sections compressed into ONE collapsible block with progress pills
- **Export PDF button** added to header — visible after any save, downloads PDF with transcript
- Old progress card and 4-column section grid deleted (code removed, not commented out)

### Phase 2: GlobalVoiceRecorder Headless Mode
**File**: `components/consultation/GlobalVoiceRecorder.tsx`
- Added `headless` prop — when true, renders no UI (logic still runs)
- Added `onTranscriptUpdate` callback — fires on every transcript change for parent display
- Added `onRecordingStateChange` callback — fires on recording state changes
- Added `RecordingState` interface for typed callbacks
- Dispatches `endoflow:ai_results_ready` CustomEvent after processing with processedContent + toothDiagnoses
- Force-start recording with `force=true` parameter — bypasses `isEnabled` guard when event handler already waited 10s
- Increased draft polling timeout from 5s to 10s

### Phase 3: Sidebar Mode Transformation (Master AI <-> Co-Pilot)
**File**: `components/dentist/sidebar-chat-panel.tsx`
- `panelMode: 'master' | 'copilot'` state with visual transition animation
- Listens for `endoflow:start_recording` (early signal) AND `endoflow:recording_started` (confirmation) to switch to Co-Pilot
- Co-Pilot shows red pulsing indicator with timer; Master AI shows teal indicator
- Recording controls strip: Stop / Pause / Resume / Process / Discard buttons
- After recording stops: stays in Co-Pilot mode with "Back to Master AI" button (doesn't auto-collapse)
- Added `endoflow:mic_deactivate` listener — immediately stops sidebar mic on handoff

### Phase 4: Co-Pilot Tabs with Real Data
**File**: `components/dentist/sidebar-chat-panel.tsx`
- **Diagnosis tab**: Shows full synthesis result (primary diagnosis, confidence %, differentials, restorative diagnosis if dual-track)
- **Treatment tab**: Treatment options ranked with rationale, prognosis, combined treatment sequence
- **Gaps tab**: Dynamic gap detection from processedContent with TTS "Speak" buttons
- **Evidence tab**: Placeholder for RAG citations
- Listens for `endoflow:synthesis_complete` CustomEvent from diagnostic-gap-dialog.tsx
- "Run AI Diagnosis Pipeline" button dispatches `endoflow:run_diagnosis_pipeline` event

### Phase 5: Pipeline Button in Co-Pilot
**Files**: `sidebar-chat-panel.tsx`, `enhanced-new-consultation-v4.tsx`
- Co-Pilot sidebar has "Run AI Diagnosis Pipeline" button
- V4 listens for `endoflow:run_diagnosis_pipeline` event
- Auto-selects tooth from transcript if none selected manually
- Opens ToothDiagnosisDialogV2 which runs the full gap-filling + synthesis pipeline

### Phase 6: Synthesis Event Dispatch
**File**: `components/dentist/diagnostic-gap-dialog.tsx`
- After `processAllGapAnswersAction` completes, dispatches `endoflow:synthesis_complete` CustomEvent
- Carries synthesis output, tooth number, patient ID, timing data
- Copilot sidebar listens and populates Diagnosis/Treatment tabs

---

## Files Changed This Session

| File | Changes |
|------|---------|
| `components/dentist/enhanced-new-consultation-v4.tsx` | Major restructure: transcript top, compact FDI, collapsed case history, headless recorder, PDF export button, pipeline event listener |
| `components/consultation/GlobalVoiceRecorder.tsx` | headless mode, onTranscriptUpdate, onRecordingStateChange callbacks, ai_results_ready event, force-start, 10s timeout |
| `components/dentist/sidebar-chat-panel.tsx` | panelMode master/copilot, recording controls strip, 4 copilot tabs, gap TTS, AI results listener, synthesis listener, mic_deactivate handler, pipeline button |
| `components/dentist/diagnostic-gap-dialog.tsx` | endoflow:synthesis_complete event dispatch after batch synthesis |
| `components/dentist/app-sidebar.tsx` | No changes (existing recording state tracking sufficient) |
| `lib/contexts/sidebar-context.tsx` | No changes |

---

## Full System Status After Session 17

### Working Pipelines

| Pipeline | Status | Notes |
|----------|--------|-------|
| Voice → Live Transcript | ✅ Working | Deepgram nova-2-medical, 10s utteranceEndMs, segment accumulation |
| Transcript → Tab Auto-Fill | ✅ Working | Gemini extraction, 3 sections filled / 5 partial in testing |
| Tooth Diagnosis Pipeline | ✅ Working | Gap-filling + Claude synthesis, saved to Supabase |
| Restorative Dual-Track | ✅ Implemented | N-track system, force-activated on caries evidence |
| PDF Export | ✅ Working | Button in header, downloads with transcript |
| Sidebar Mode Transform | ✅ Working | Master AI <-> Co-Pilot on recording start/stop |
| Co-Pilot Tabs | ✅ Working | Shows synthesis results after pipeline completes |

### Known Issues (Carried Forward)

1. **Pause button in copilot controls** — doesn't work after recording stops (UX: should be hidden when not recording)
2. **Gap questions are static** — come from questionnaire templates, not transcript-aware. Needs LLM-based question generation from actual conversation content
3. **RAG references not displayed** — the Evidence tab shows placeholder. Need to fetch from `consultation_evidence` table after synthesis and display citations
4. **Accept diagnosis doesn't auto-save** — copilot "Accept" fills the dialog form, user must manually click "Save" to persist to DB
5. **Wake word "EndoFlow"** — still inconsistent with Deepgram transcription
6. **Pre-existing TS errors** — ~40 errors in V4 (type narrowing on ConsultationData), none from session 17 changes
7. **Deepgram segment breaks** — occasional brief transcript resets during Deepgram reconnects between segments
8. **Mic stays listening after all mics closed** — possible race condition in mic manager cleanup

---

## Architecture: Voice-First Consultation Flow

```
1. Dentist says "Start consultation with [patient]"
   ↓
2. Master AI → MCPConductor → Navigate to clinical → Select patient
   ↓
3. page.tsx dispatches endoflow:mic_deactivate (sidebar mic stops)
   ↓ 500ms
4. page.tsx dispatches endoflow:start_recording
   ↓
5. Sidebar hears start_recording → switches to Co-Pilot mode (red indicator)
   ↓
6. GlobalVoiceRecorder polls for consultationId (up to 10s)
   → Force-starts if timeout
   ↓
7. Deepgram nova-2-medical connects → STT streaming starts
   → onTranscriptUpdate fires → V4 Live Transcript card updates
   → Sidebar shows recording controls
   ↓
8. Dentist speaks... transcript accumulates across segments
   ↓
9. Dentist says "Stop recording" or clicks Stop button
   → endoflow:recording_stopped fires
   → Sidebar stays in Co-Pilot (shows "Recording processed" + "Back to Master AI")
   ↓
10. Transcript sent to /api/voice/process-global-transcript
    → Gemini extracts structured data → auto-fills consultation tabs
    → Tooth diagnoses extracted → FDI chart updated
    → endoflow:ai_results_ready dispatched → copilot tabs update
   ↓
11. Dentist clicks tooth in FDI chart → opens ToothDiagnosisDialogV2
    OR clicks "Run AI Diagnosis Pipeline" in copilot sidebar
    ↓
12. Gap-filling pipeline runs (6 questions, Claude synthesis)
    → endoflow:synthesis_complete dispatched
    → Copilot Diagnosis/Treatment tabs show results
    ↓
13. Dentist accepts → saves to tooth_diagnoses + ai_synthesis_results
    ↓
14. Dentist clicks "Export PDF" → downloads complete consultation report
    ↓
15. Dentist clicks "Back to Master AI" → sidebar returns to teal mode
```

---

## Database Tables Used

| Table | Purpose | Populated By |
|-------|---------|-------------|
| `api.consultations` | Full consultation record + clinical_data JSON | finalizeConsultationFromDraftAction |
| `api.tooth_diagnoses` | Per-tooth status, diagnosis, treatment, color | saveToothDiagnosis |
| `api.ai_synthesis_results` | AI diagnosis/treatment per tooth with confidence | saveSynthesisResult (after gap-filling) |
| `api.gap_analysis_answers` | Q&A pairs from gap-filling interview | saveGapAnalysisAnswers |
| `api.consultation_evidence` | RAG retrieval logs with citations | saveConsultationEvidence |
| `api.endoflow_sessions` | Per-dentist session state, chat history | On every Master AI query |

---

## What To Do Next Session (Session 18)

### Priority 1: Co-Pilot Completion
1. **Wire Evidence tab** — Fetch from `consultation_evidence` table after synthesis and display RAG citations with titles, journals, DOIs
2. **Auto-hide pause/resume buttons** when recording is stopped (only show "Back to Master AI" + "Run Pipeline")
3. **Accept diagnosis auto-save** — Wire copilot "Accept" button to trigger `saveToothDiagnosis()` directly
4. **Multiple teeth workflow** — After completing one tooth's pipeline, allow selecting next tooth without leaving Co-Pilot mode

### Priority 2: Transcript Quality
1. **Upgrade to nova-3-medical** if available on Deepgram plan (63% WER improvement)
2. **Enable diarization** (`diarize=true`) for speaker labels (Dr. / Patient)
3. **Add endpointing=400** to prevent mid-sentence splits (currently using default 10ms)
4. **Fix mic cleanup race condition** — investigate why mic stays listening after all close

### Priority 3: Gap Questions
1. **Make transcript-aware** — Add LLM step to analyze actual conversation content and generate custom questions instead of static templates
2. **Pass full transcript to gap-finder** so it knows what information was already provided

### Priority 4: Data Verification
1. **Check ai_synthesis_results** table has records for the consultations run this session
2. **Verify RAG retrieval** — check if medical_knowledge table has embeddings and similarity search works
3. **Check consultation_evidence** table for citations
4. **Verify tooth_diagnoses** table has correct color codes for FDI chart display

### Key Files to Read First
| File | Why |
|------|-----|
| `HANDOFF/SESSION_17_HANDOFF.md` | This document |
| `components/dentist/sidebar-chat-panel.tsx` | Co-Pilot sidebar (master/copilot mode, tabs) |
| `components/dentist/enhanced-new-consultation-v4.tsx` | Main consultation layout (voice-first) |
| `components/consultation/GlobalVoiceRecorder.tsx` | Recording engine (headless mode) |
| `components/dentist/diagnostic-gap-dialog.tsx` | Gap-filling + synthesis pipeline |
| `lib/services/deepgram-stt.ts` | Deepgram configuration |
| `mockups/consultation-voice-ui-v2.html` | Original design mockup for reference |
