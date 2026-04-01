# Session 16 Handoff

**Date**: 2026-03-31
**Focus**: Voice pipeline fixes, consultation UI redesign vision, full status audit

---

## What Was Done This Session

### Fix 1: Transcript Accumulation Across Deepgram Segments
**File**: `components/consultation/GlobalVoiceRecorder.tsx`
- Previously, when Deepgram auto-reconnected (segment boundary) or user paused/resumed, the displayed transcript would reset to only the current segment
- Now shows ALL accumulated segments + current segment in real-time
- Both final and interim transcript displays merge `accumulatedTranscriptsRef` with `finalTranscriptRef`

### Fix 2: Recording Start Timing Race (Critical)
**File**: `components/consultation/GlobalVoiceRecorder.tsx`
- Root cause: When sidebar AI says "Start consultation with Dipti", the `endoflow:start_recording` event fires before the consultation draft is created in Supabase
- `GlobalVoiceRecorder.isEnabled` was still false (no `consultationId` yet), so recording silently failed
- Fix: Added `isEnabledRef` and `consultationIdRef` that track prop changes in real-time
- Event handler now polls up to 5 seconds (25 x 200ms) waiting for draft creation before starting recording
- `processRecording()` also uses `consultationIdRef` to always have the latest ID

### Fix 3: Ambient Speech Auto-Submission Sensitivity
**File**: `components/dentist/sidebar-chat-panel.tsx`
- Silence threshold: 3s → 5s (final transcript timer)
- Utterance end threshold: 1.5s → 3.5s
- Added minimum word count: 3 words for final timer, 4 words for utterance end
- Total effective silence before submit: ~5.5s (Deepgram 2s utteranceEndMs + 3.5s timer)

### Fix 4: Sidebar Resize Handle Visibility
**Files**: `components/dentist/app-sidebar.tsx`, `lib/contexts/sidebar-context.tsx`
- Handle width: 1px → 1.5px, grab area: ±1px → ±2px
- Added 3-dot teal grip indicator on hover
- Max sidebar width: 600px → 800px

### Fix 5: Defensive Mic Handoff in GlobalVoiceRecorder
**File**: `components/consultation/GlobalVoiceRecorder.tsx`
- `startRecording()` now dispatches `endoflow:mic_deactivate` as first action
- Waits 300ms for sidebar Deepgram to disconnect before claiming mic
- Defense-in-depth: works even if page-level mic deactivation didn't fire

---

## Full System Status Audit

### End-to-End Working Pipelines (Voice → Supabase)

| # | Pipeline | Voice Command | Data Saved To |
|---|----------|--------------|---------------|
| 1 | **Consultation Start** | "Start consultation with [name]" | `endoflow_sessions`, `consultations` (draft), `ai_synthesis_results` |
| 2 | **Consultation Recording** | Manual start + "Process" | `consultations`, `ai_synthesis_results`, `consultation_evidence`, `gap_analysis_answers` |
| 3 | **Appointment Booking** | "Book appointment for [name]" | `appointments` |
| 4 | **Task Creation** | "Create task: [description]" | `assistant_tasks` |
| 5 | **Patient Lookup** | "Tell me about [name]" | `endoflow_sessions` (context) |
| 6 | **Appointment View** | "Show today's appointments" | `endoflow_sessions` (context) |

### MCP Conductor Multi-Step Pipelines

| Pipeline | Steps | Status |
|----------|-------|--------|
| `consultation_start` | Search Patient → Check Appointment → Navigate Clinical → Start Consultation | Working (4 steps, SSE streaming) |
| `appointment_book` | Search Patient → Navigate Booking → Prefill Form | Partial (prefill is UI-only) |

### Session Management (3-Tier Persistence)

| Tier | Storage | Scope | Retention |
|------|---------|-------|-----------|
| Client | `sessionStorage` | Tab-scoped | Until tab close |
| Server Session | `endoflow_sessions` table | Per-dentist | 20 messages, 30min TTL |
| Conversation DB | `endoflow_conversations` table | Per conversation ID | Unlimited |

### AI Persistence Tables (All in Supabase `api` schema)

| Table | Purpose | Auto-Populated? |
|-------|---------|----------------|
| `endoflow_sessions` | Conversation memory, patient context, intent log | Yes, on every query |
| `ai_synthesis_results` | Diagnosis suggestions, AAE classification, treatment options | Yes, after consultation pipeline |
| `gap_analysis_answers` | Q&A pairs with confidence deltas | Yes, during gap analysis |
| `consultation_evidence` | RAG retrieval logs with similarity scores | Yes, during consultation pipeline |

### Voice Intent Classification (12 Intents)

| Intent | Delegate | Works? |
|--------|----------|--------|
| `navigation` | `delegateToNavigation()` | Yes |
| `consultation_start` | MCP Conductor (4 steps) | Yes |
| `consultation_stop` | Direct (stop recording) | Yes |
| `recording_control` | Direct (pause/resume/read-back) | Yes |
| `patient_lookup` | `delegateToPatientInquiry()` + fuzzy search | Yes |
| `appointment_view` | `delegateToAppointmentInquiry()` | Yes |
| `appointment_book` | MCP Conductor (3 steps) | Partial |
| `clinical_question` | `delegateToClinicalResearch()` + RAG | Yes |
| `task_command` | `delegateToTaskManagement()` | Yes |
| `report_command` | Direct (frontend event) | Yes |
| `tooth_command` | Direct (select/diagnose tooth) | Yes |
| `general_question` | `delegateToGeneralAI()` + Gemini | Yes |

### Key Components Status

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Master AI Orchestrator | `lib/services/endoflow-master-ai.ts` | ~2900 | Working, 12 intents |
| MCP Conductor | `lib/agents/mcp-conductor.ts` | ~400 | Working, 2 pipelines |
| Sidebar Chat Panel | `components/dentist/sidebar-chat-panel.tsx` | ~550 | Working, voice+text |
| GlobalVoiceRecorder | `components/consultation/GlobalVoiceRecorder.tsx` | ~950 | Fixed this session |
| Fuzzy Patient Search | `lib/utils/fuzzy-patient-search.ts` | ~200 | Working |
| AI Persistence | `lib/services/ai-persistence-service.ts` | ~300 | Working |
| Session Manager | `lib/services/master-ai-session.ts` | ~400 | Working, Supabase-backed |
| Deepgram STT | `lib/services/deepgram-stt.ts` | ~200 | Working |
| TTS Service | `lib/services/tts-service.ts` | ~100 | Working |

---

## Next Phase: Consultation UI Redesign (Voice-First)

### Vision
Transform the consultation page from a scroll-heavy form into a voice-first interface optimized for gloved-hand operation. The dentist is gloved and cannot scroll/type — everything must be voice-controllable or minimal-touch.

### Mockup
File: `mockups/consultation-voice-ui-v2.html` (interactive, click "Master AI Mode" / "Co-Pilot Mode" to toggle)

### Main Area Layout (Top to Bottom — NO action buttons here)

1. **Live Transcript Area** (PRIMARY FOCUS) — Clean formatted conversation with speaker labels (Dr. / Patient), real-time interim text in italic. This is the "text screen" where the conversation is displayed in a nicer readable format as it happens. The raw transcript gets cleaned/formatted by AI.
2. **Compact FDI Chart** — Clickable teeth with color-coded status (caries, RCT, filled, attention). Auto-highlights teeth mentioned in conversation.
3. **Upload Blocks** — X-Ray + Clinical Photos (2-column grid, drag-drop + voice trigger: "Upload X-ray", "Take photo")
4. **Collapsed Case History** — All 12 sections compressed into ONE expandable block with progress pills showing auto-fill status from voice. Click to expand and see individual sections.

### LEFT Sidebar Transformation (Critical Design Decision)

The existing LEFT sidebar (EndoFlow Master AI) **transforms in-place** into a Clinical Diagnosis Co-pilot when recording starts. Action buttons live HERE, not in the main area.

**Transformation flow:**
1. Dentist says "Start consultation with Dipti Tomar"
2. Master AI navigates to clinical mode, finds patient, starts recording
3. **LEFT sidebar visually transforms** → mode indicator changes from "EndoFlow Master AI" (teal) to "Clinical Co-Pilot (Recording)" (red pulsing)
4. Master AI goes **completely silent** — no ambient listening, no auto-submit
5. Mic ownership transfers to GlobalVoiceRecorder for clinical dictation
6. Sidebar now shows:
   - **Recording controls strip** at top: Stop / Pause / Process / Discard + timer + segment count
   - **Tabs**: Diagnosis | Treatment | Gaps | Evidence
   - **Diagnosis tab**: Real-time AI diagnosis suggestions with confidence scores, AAE classification, differentials
   - **Treatment tab**: Treatment options based on extracted entities from conversation
   - **Gaps tab**: Gap analyzer questions — AI asks questions via TTS (speaks them aloud), dentist answers verbally, answers feed back into diagnosis pipeline
   - **Evidence tab**: Clinical literature citations from RAG retrieval
   - **Input field** at bottom: Type answers to gap questions or ask the co-pilot anything
7. Dentist says "Stop and process" → recording stops, AI pipeline runs, results populate the tabs
8. Dentist says "Save consultation" or "Generate PDF" → consultation saved
9. **Sidebar transforms BACK** → mode indicator returns to "EndoFlow Master AI" (teal), Master AI resumes listening for commands

### AI Pipeline During Recording

The voice transcript captured by GlobalVoiceRecorder goes through this pipeline:
1. **STT**: Deepgram nova-2-medical transcribes the conversation
2. **Transcript Processing**: AI parses the conversation and writes it into the **complete case history tree format** (Chief Complaint, HOPI, Medical History, Personal History, Clinical Exam, Investigations, Diagnosis, Treatment Plan, Prognosis, Follow-Up, Prescription, Consent)
3. **Auto-Fill**: Each case history section is auto-populated from voice extraction
4. **Diagnosis Suggestions**: AI generates diagnosis with confidence scores based on extracted entities
5. **Gap Analysis**: AI identifies missing information and generates questions (spoken via TTS)
6. **Evidence Retrieval**: RAG retrieves relevant clinical literature
7. **All saved to Supabase**: `consultations`, `ai_synthesis_results`, `gap_analysis_answers`, `consultation_evidence`

### Implementation Phases (For Next Session)

| Phase | Task | Complexity | Priority |
|-------|------|-----------|----------|
| 1 | Restructure consultation main area (transcript at top, FDI below, uploads, collapsed case history) | Medium | P0 |
| 2 | Move action buttons (Stop/Pause/Process) into LEFT sidebar co-pilot panel | Medium | P0 |
| 3 | Implement sidebar mode transformation (Master AI ↔ Co-Pilot with animation) | Medium | P0 |
| 4 | Add co-pilot tabs (Diagnosis/Treatment/Gaps/Evidence) to sidebar panel | Medium | P1 |
| 5 | Wire gap analyzer to co-pilot panel with TTS questions + voice capture answers | High | P1 |
| 6 | Auto-populate diagnosis/treatment tabs from AI pipeline results | Medium | P1 |
| 7 | Auto-highlight teeth in FDI chart from transcript entity extraction | Medium | P2 |
| 8 | Voice-triggered upload blocks ("Upload X-ray") | Low | P2 |
| 9 | Sidebar transform-back on "Save consultation" / "Generate PDF" | Low | P2 |

---

## Known Issues (Carried Forward)

1. **Wake word "EndoFlow"** — Deepgram still transcribes as "endo flow", "endo flu" etc. Keyword boosting helps but not perfect
2. **Pre-existing TS errors** — ~12 errors in `process-global-transcript/route.ts` (type narrowing) and `research/` routes (params typing). None from session 16 changes
3. **Appointment prefill** — MCP conductor's appointment_book step 3 only returns UI action, doesn't auto-create appointment
4. **V2/V1 consultation files** — Have stale prop `onToothDiagnosisSaved` that was renamed. Non-blocking (V4/V5 are active)

---

## Files Changed This Session

| File | Changes |
|------|---------|
| `components/consultation/GlobalVoiceRecorder.tsx` | Transcript accumulation fix, timing race fix (isEnabledRef + polling), defensive mic_deactivate |
| `components/dentist/sidebar-chat-panel.tsx` | Auto-submit threshold 3s→5s, utterance end 1.5s→3.5s, word count minimums |
| `components/dentist/app-sidebar.tsx` | Resize handle visibility (grip dots), wider grab area |
| `lib/contexts/sidebar-context.tsx` | Max sidebar width 600→800 |
| `mockups/consultation-voice-ui-v2.html` | NEW: Interactive HTML mockup of voice-first consultation UI |
| `HANDOFF/SESSION_16_HANDOFF.md` | NEW: This document |

---

## WHAT TO DO NEXT SESSION (Session 17)

### Pre-Requisites
1. Read this handoff fully
2. Open `mockups/consultation-voice-ui-v2.html` in browser — click "Master AI Mode" / "Co-Pilot Mode" to understand the sidebar transformation
3. Read the current consultation component: `components/dentist/enhanced-new-consultation-v4.tsx`
4. Read the current sidebar: `components/dentist/app-sidebar.tsx` + `components/dentist/sidebar-chat-panel.tsx`

### Execution Order

**Step 1: Restructure Main Consultation Area**
- File: `components/dentist/enhanced-new-consultation-v4.tsx`
- Move GlobalVoiceRecorder transcript display to be the PRIMARY top element
- Format transcript with speaker labels (Dr./Patient) using AI parsing
- Move FDI chart directly below transcript
- Add upload blocks (X-Ray + Clinical Photos) below FDI
- Compress all 12 case history tabs into ONE collapsible block with progress pills
- Remove the scattered action buttons from the main area (they move to sidebar)

**Step 2: Sidebar Mode Transformation**
- File: `components/dentist/sidebar-chat-panel.tsx`
- Add `panelMode: 'master' | 'copilot'` state
- When `endoflow:recording_started` fires → switch to copilot mode
- When `endoflow:recording_stopped` fires → switch back to master mode
- Copilot mode renders: controls strip + tabs (Diagnosis/Treatment/Gaps/Evidence) + input
- Master mode renders: existing chat (unchanged)
- Add visual transition animation (border flash, mode indicator color change)

**Step 3: Wire Recording Controls into Sidebar**
- Move Stop/Pause/Process/Discard buttons into the copilot panel's controls strip
- These dispatch the same CustomEvents: `endoflow:stop_recording`, `endoflow:pause_recording`, `endoflow:process_recording`
- Timer and segment count display in the controls strip
- Remove duplicate controls from GlobalVoiceRecorder UI (keep the component for recording logic, remove its render)

**Step 4: Populate Co-Pilot Tabs**
- Diagnosis tab: Read from `ai_synthesis_results` table or from the real-time AI pipeline output
- Treatment tab: Read treatment suggestions from synthesis results
- Gaps tab: Display gap analyzer questions, wire TTS to speak them, capture voice answers
- Evidence tab: Display RAG retrieval results from `consultation_evidence`

**Step 5: Gap Analyzer Voice Loop**
- When a gap question appears in the Gaps tab, trigger TTS to speak it aloud
- Dentist answers verbally → GlobalVoiceRecorder captures the answer text
- Answer is sent to gap analyzer endpoint → confidence updates → new questions generated
- Loop until all gaps are filled or dentist says "That's all"

**Step 6: Save & Transform Back**
- When dentist says "Save consultation" → save to Supabase, generate PDF
- Sidebar transforms back to Master AI mode
- Master AI resumes listening for new commands

### Key Files to Modify

| File | What to Change |
|------|---------------|
| `components/dentist/enhanced-new-consultation-v4.tsx` | Restructure layout: transcript top, FDI, uploads, collapsed case history |
| `components/dentist/sidebar-chat-panel.tsx` | Add copilot mode with tabs, controls strip, gap analyzer display |
| `components/dentist/app-sidebar.tsx` | Pass panelMode to sidebar, handle mode indicator visuals |
| `components/consultation/GlobalVoiceRecorder.tsx` | Strip down UI render (logic stays, render moves to sidebar) |
| `lib/contexts/sidebar-context.tsx` | Add `panelMode` to context if needed |

### Things to AVOID
- Do NOT use `cookies()` in server actions called from client components (deadlock)
- Do NOT create new Deepgram instances in the copilot — reuse GlobalVoiceRecorder's
- Do NOT break the existing 12-intent voice system — sidebar Master AI must work identically when not in recording mode
- Do NOT remove any working functionality — this is an additive UI restructure
- Test each phase before moving to the next
