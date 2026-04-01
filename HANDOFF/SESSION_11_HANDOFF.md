# Session 11 Handoff — MCP Agentic Backbone Implementation

**Date:** 2026-03-29
**Previous:** Session 10 (Longitudinal Tracking System)

---

## What Was Built This Session

### The Vision (Nisarg's Clarified Intent)
EndoFlow's MCP backbone should work as a **unified context-gathering and function-routing architecture** that serves both voice AND UI equally. Voice is one access layer on top of the same agentic pipeline that button clicks use. The N-track diagnostic pipeline is the crown jewel — never override, only integrate around it.

### 6 Phases Completed

---

#### Phase 1: Patient Context → AI Pipeline ✅

**Problem:** The AI diagnostic pipeline only saw the current transcript — no longitudinal patient history.

**Built:** `lib/services/patient-context-assembler.ts`
- Assembles full patient context from 5 Supabase tables in parallel (~300ms):
  - `patients` → demographics, DOB, age, gender
  - `consultations` → previous visits (chief complaint, diagnoses, treatments)
  - `tooth_diagnoses` → all teeth status map
  - `treatment_episodes` → active/completed episodes with visit counts
  - `tooth_timeline` → chronological event history
- Exports `FullPatientContext` interface and `formatPatientContextForPrompt()` for injection into AI prompts
- Handles optional tooth-specific context (emphasizes a specific tooth's history)

**Injected into:**
- `lib/agents/diagnostic-synthesis-agent.ts` — added `fullPatientContext` to `SynthesisInput`, prompt now includes "PATIENT LONGITUDINAL CONTEXT" section
- `lib/agents/consultation-ai-orchestrator.ts` — passes `fullPatientContext` through pipeline
- `lib/actions/consultation-pipeline.ts` — calls `assemblePatientContext()` before running orchestrator

**Result:** When the AI diagnosis pipeline runs, it now knows the patient's full history — previous visits, active treatment episodes, tooth timeline, medications, allergies — alongside the current transcript.

---

#### Phase 2: Master AI as Function Caller ✅

**Problem:** The EndoFlow Master AI ("Hey EndoFlow") had 7 hardcoded intent types with no ability to navigate the dashboard or control consultations.

**Built:** 5 new intent types added to the LLM-powered intent classification:

| Intent | Example Phrases | Handler |
|--------|-----------------|---------|
| `navigation` | "Go to clinical", "open patients" | `delegateToNavigation()` → switchMode on frontend |
| `consultation_start` | "Start consultation with Sharma" | `delegateToConsultationStart()` → lookup patient, detect mode, navigate, store in sessionStorage |
| `consultation_stop` | "Stop recording", "done" | `delegateToConsultationStop()` → dispatch custom event |
| `patient_status` | "What's Sharma's status?" | `delegateToPatientStatus()` → assemblePatientContext → format summary |
| `generate_report` | "Generate report", "create PDF" | Returns action command → dispatch custom event → V5 generates PDF |

**Files modified:**
- `lib/services/endoflow-master-ai.ts` — Added 5 new intents to `IntentType`, expanded classification prompt with voice garble examples, added 4 delegate handler functions, updated response synthesis and suggestions
- `lib/actions/endoflow-master.ts` — Added `actionCommand` to `ProcessQueryResult`
- `components/dentist/endoflow-voice-controller.tsx` — Added `onActionCommand` callback prop, `ActionCommand` type export, wires action commands to parent
- `app/dentist/page.tsx` — Added `handleActionCommand()` that executes navigation, consultation start/stop, patient status, report generation

**Architecture:** Voice → Prompt Refinement → Intent Classification (Claude LLM, handles dental shorthand + voice garbles) → Route to handler → Return actionCommand → Frontend executes

---

#### Phase 3: Appointment ↔ Diagnosis Chain ✅

**Problem:** Appointments were linked to consultations but didn't carry the WHY — which tooth, which diagnosis, which treatment step.

**Built:**

**Schema:** 4 new columns on `api.appointments`:
- `linked_episode_id` (UUID) — treatment episode FK
- `linked_tooth_numbers` (TEXT) — JSON array: `["46", "14"]`
- `linked_diagnosis` (TEXT) — "Irreversible pulpitis"
- `linked_treatment_plan` (TEXT) — "RCT - Visit 2: Obturation"

**Migration:** `sql/004_appointment_diagnosis_chain.sql` — ✅ RUN IN SUPABASE

**Files modified:**
- `lib/db/schema.ts` — 4 new columns on appointments table
- `lib/actions/consultation.ts` — `createAppointment` helper now accepts + stores `diagnosisContext` (diagnosis, treatment plan, episode ID, tooth numbers)
- `lib/services/consultation-sync-engine.ts` — After auto-creating a treatment episode, retroactively links scheduled appointments for that patient+tooth
- `components/dentist/enhanced-new-consultation-v5.tsx` — Loads linked context from appointment via useEffect, auto-selects linked episode, shows "Continuing From Previous Visit" banner

---

#### Gap 1 Fix: FDI Chart Colors ✅

**Problem:** The `InteractiveDentalChart` reads colors from `tooth_diagnoses` table, but the sync engine only wrote to `tooth_timeline` and `treatment_episodes`.

**Fix:** Added upsert into `tooth_diagnoses` in `consultation-sync-engine.ts` — after each status change or diagnosis event, the sync engine now also updates the tooth_diagnoses table with the correct status and color code. Added `getStatusColorCode()` helper mapping statuses to hex colors.

**Result:** FDI chart now reflects episode data — a tooth with an active RCT episode shows as yellow (root_canal), not green (healthy).

---

#### Phase 5: TTS Voice Response ✅

**Problem:** Browser TTS was basic — default voice, no dental abbreviation handling, long responses got cut off by browser limits.

**Built:** `lib/services/tts-service.ts`
- **Smart voice selection** — ranks premium/natural voices per platform (Google US English, Samantha, Microsoft Zira), falls back to language-matched voices
- **Dental abbreviation expansion** — RCT → "root canal treatment", IOPA → "I O P A", Tx → "treatment", etc.
- **Chunked speaking** — splits text at sentence boundaries (max 200 chars per chunk) to prevent browser's ~15 second cutoff
- **Markdown → speech conversion** — strips formatting, converts bullets to natural speech, removes emoji
- **Language-aware** — voice selection for en-US, en-IN, hi-IN
- **Response formatters** — `formatScheduleForSpeech()`, `formatPatientStatusForSpeech()`

**Integrated into:** `components/dentist/endoflow-voice-controller.tsx` — replaced basic `speak()` function with `speakWithTTS()` from the new service. Uses `activeTTSRef` for cancellation control.

---

#### Phase 4: PDF Report Generation ✅

**Built:** `lib/services/report-generator.ts` — Server-side PDF using `pdf-lib`:
- EndoFlow-branded A4 PDF with teal header bar
- Patient info section (name, age, gender, UHID, dentist)
- Clinical findings (chief complaint, HOPI, medical history, exam, investigations)
- AI diagnosis & treatment plan (primary diagnosis, confidence, differentials, treatment, prognosis, evidence citations)
- Per-tooth findings table (tooth number, diagnosis, treatment, priority)
- Prescriptions section (name, dosage, frequency, duration, instructions)
- Follow-up plan
- Optional conversation transcript (on separate page)
- Dentist signature line
- Page numbers + "Generated by EndoFlow AI" footer
- Automatic word wrapping and page breaks

**Built:** `lib/actions/consultation-report.ts` — Two server actions:
- `generateConsultationReportAction(consultationId)` — Fetches from 4 tables (consultations, patients, profiles, tooth_diagnoses), parses clinical_data JSONB, generates PDF, returns base64
- `saveReportToProfileAction(consultationId, patientId, pdfBase64, fileName)` — Uploads to Supabase Storage (`medical-files/patient-reports/`), saves metadata to `patient_files`

**UI:** `components/dentist/enhanced-new-consultation-v5.tsx` — "Generate Report" button appears after consultation is saved. Downloads PDF AND saves to patient profile. Button states: loading → "Report Saved" ✓

**Voice:** "Generate report" / "Create PDF" / "Download report" → triggers report generation via custom event

---

#### Phase 6: UI Research & Recommendations ✅

Full audit documented in `HANDOFF/PHASE_6_UI_RECOMMENDATIONS.md`. 5 areas assessed, 10 prioritized UI changes identified:

| Priority | Change | Est. Time |
|----------|--------|-----------|
| 1 | Today's View: show linked diagnosis on appointment cards | 2-3 hrs |
| 2 | Consultation: drag & drop image/file zone | 3-4 hrs |
| 3 | Consultation: Patient Context panel (before recording) | 2-3 hrs |
| 4 | Consultation: prominent voice recorder positioning | 1 hr |
| 5 | Tooth Dialog: unified AI panel (replace 3 tabs with single scroll) | 4-6 hrs |
| 6 | Patient Profile: episode progress bars | 2-3 hrs |
| 7 | Today's View: "Start Consultation" button with context | 1-2 hrs |
| 8 | Magenta accent for AI features (Nisarg's preference) | 1-2 hrs |
| 9 | Patient Profile: AI Intelligence summary card | 3-4 hrs |
| 10 | Consultation: multi-tooth AI summary card | 2-3 hrs |

**Color decision:** Teal stays as primary brand. Magenta (#D946EF or #EC407A) as secondary accent for AI-generated content. This creates visual language: teal = user controls, magenta = AI intelligence.

---

## Architecture Diagram

Full visual map saved to `HANDOFF/MCP_ARCHITECTURE_VISUAL.md` showing:
- Master AI → 13 intent types → specialized handlers → actionCommand to frontend
- N-track diagnostic pipeline (7 agents, all connections)
- Synchronized loop (consultation → sync → profile → appointment → loop)
- AI model distribution (Claude/Gemini/OpenAI/Browser TTS)
- Built vs. remaining checklist

---

## Test Results

**Test script:** `scripts/test-mcp-backbone.mjs`
**Result:** 67/67 passed, 0 failed, 0 skipped

| Phase | Tests | Key Results |
|-------|-------|-------------|
| Phase 1 | 14 | Parallel fetch 301ms, all 5 tables queryable, age computed |
| Phase 2 | 22 | All 13 intent types defined, 4 handlers exist, actionCommand wired |
| Phase 3 | 13 | Appointment chain columns work, read/write verified, V5 loads context |
| Integration | 18 | Context assembler exports all interfaces, prompt formatter complete |

---

## Files Created This Session

| File | Purpose |
|------|---------|
| `lib/services/patient-context-assembler.ts` | Full patient longitudinal context assembly |
| `lib/services/tts-service.ts` | Enhanced TTS with chunking, voice selection, dental abbreviations |
| `lib/services/report-generator.ts` | PDF report generation using pdf-lib |
| `lib/actions/consultation-report.ts` | Server actions for report generation + storage |
| `sql/004_appointment_diagnosis_chain.sql` | Migration for appointment linkage columns |
| `scripts/test-mcp-backbone.mjs` | Test suite for Phases 1-3 (67 tests) |
| `HANDOFF/SESSION_10_PLAN.md` | Implementation plan for MCP backbone |
| `HANDOFF/MCP_ARCHITECTURE_VISUAL.md` | Complete visual architecture diagram |
| `HANDOFF/PHASE_6_UI_RECOMMENDATIONS.md` | UI research and 10 prioritized changes |

## Files Modified This Session

| File | Change |
|------|--------|
| `lib/services/endoflow-master-ai.ts` | 5 new intents, expanded classification prompt, 4 delegate handlers, response synthesis |
| `lib/actions/endoflow-master.ts` | Added actionCommand to ProcessQueryResult |
| `lib/db/schema.ts` | 4 new columns on appointments |
| `lib/actions/consultation.ts` | Enriched follow-up appointment creation with diagnosis context |
| `lib/services/consultation-sync-engine.ts` | Gap 1 fix (tooth_diagnoses upsert) + appointment-episode linking |
| `lib/agents/diagnostic-synthesis-agent.ts` | Added fullPatientContext to SynthesisInput + prompt |
| `lib/agents/consultation-ai-orchestrator.ts` | Passes fullPatientContext through pipeline |
| `lib/actions/consultation-pipeline.ts` | Calls assemblePatientContext before orchestrator |
| `components/dentist/endoflow-voice-controller.tsx` | onActionCommand prop, TTS integration |
| `components/dentist/enhanced-new-consultation-v5.tsx` | Appointment context loading, report buttons, generate_report event listener |
| `app/dentist/page.tsx` | handleActionCommand for navigation/consultation/report |
| `memory/project_mcp_vision.md` | Updated with clarified MCP backbone vision |
| `memory/MEMORY.md` | Updated index |

---

## What's Remaining (Priority Order)

### HIGH PRIORITY — Core Integration
1. **End-to-end pipeline test** with real patient consultation (needs browser testing)
2. **Today's View: linked diagnosis on appointment cards** (2-3 hrs)
3. **Consultation: drag & drop image/file zone** (3-4 hrs — Nisarg's request)
4. **Consultation: Patient Context panel** before recording (2-3 hrs)
5. **Dark theme: 12 remaining components** (2-3 hrs — mechanical bulk replace)

### MEDIUM PRIORITY — Quality
6. Fix Gap 2: dental chart tooth click conflict (1-2 hrs)
7. Fix Gap 3: overview tab active treatments stat (30 min)
8. Fix Gap 4: episode → consultation navigation (1-2 hrs)
9. Fix Gap 5: UI save flow end-to-end test (1 hr)
10. Consultation: prominent voice recorder positioning (1 hr)
11. Patient Profile: episode progress bars (2-3 hrs)

### LOWER PRIORITY — Enhancement
12. Tooth Dialog: unified AI panel replacing 3-tab switcher (4-6 hrs)
13. Magenta accent for AI features (1-2 hrs)
14. Knowledge base subspecialty tagging + section-aware chunking (4-6 hrs)
15. Pre-compute AI results for extracted teeth (latency fix) (2-3 hrs)
16. Auto-fill remaining 5 consultation tabs from voice (4-6 hrs)
17. Patient/Assistant dashboard dark theme (3-4 hrs)
18. Old system data migration script (2-3 hrs)
19. Patient Profile: AI Intelligence summary card (3-4 hrs)
20. Deepgram TTS upgrade from browser SpeechSynthesis (3-4 hrs)

### PRODUCTION
21. Remove `?preview=1` middleware bypass
22. Remove dev fallback dentist data
23. HIPAA compliance review
24. CI/CD pipeline
25. Production deployment

**Overall completion: ~70-75%**
The core architecture, agents, pipelines, sync engine, voice control, longitudinal tracking, PDF reports, and TTS are all built. What remains is mostly integration testing, UI polish, and production hardening.

---

## LIVE TESTING RESULTS & ISSUES FOUND

### Test Scenario
Dr. Nisarg conducted a real patient consultation with Popatlal Pandey (52 years). Conversation covered tooth 46 with pain, sensitivity, cold/hot sensitivity, negative cold test, MOD caries with 50% structure loss. The N-track diagnostic pipeline ran successfully through Agent A (checklist), Agent B (subspecialty classifier → pulp_pathology 35%), Agent C (gap finder → 93 gaps, 62 diagnosis-changing), and Diagnostic Synthesis (persistent session, 6 turns).

**Pipeline completed successfully:** Final diagnosis was "Pulp Necrosis with Symptomatic Apical Periodontitis secondary to carious pulp involvement — Tooth 46" at 79% confidence after 6 gap-filling turns.

### Issue 1: PDF "Generate Report" Button Not Visible
**Problem:** After completing the consultation and clicking "Complete Consultation," the "Generate Report" button did not appear. The dentist expected to see it after saving.

**Root Cause:** The "Generate Report" button was added to V5's header (line ~530 of enhanced-new-consultation-v5.tsx). But `new_consultation` mode renders V4 entirely — V5 only adds the mode selector, patient context, and action buttons around V4. The V4 component has its own "Complete" button that saves the consultation, but the V5 report button requires `savedConsultationId` which only gets set when V5's own `handleSave` runs (not V4's).

**Fix Required:** Either:
- Add report generation button to V4's completion flow (after `saveCompleteConsultationAction` succeeds)
- OR make V5 detect when V4 has saved (listen for revalidation or a callback) and show the report button
- Simplest approach: Add an `onConsultationSaved` callback prop to V4, fire it with the consultationId, V5 catches it and shows the report button

**Estimated effort:** 2-3 hours

---

### Issue 2: Transcript Overwrite / Recording Stops Mid-Conversation
**Problem:** During the consultation recording, the transcript stopped mid-conversation and parts were overwritten. The dentist expected continuous recording for the entire 5-10 minute conversation.

**Root Cause:** Known issue from Session 5. The GlobalVoiceRecorder was rewritten with multi-segment accumulation, but:
- Browser Web Speech API has a hard ~60-90 second timeout in Chrome
- When the API auto-restarts, there may be a gap or overwrite if the segment merge doesn't work correctly
- Deepgram was added as primary STT with 10-second silence tolerance, but this hasn't been browser-tested
- The `DEEPGRAM_API_KEY` may not be configured, causing fallback to browser STT

**Fix Required:**
1. Verify Deepgram API key is configured and working
2. Test multi-segment accumulation in browser (Deepgram mode)
3. If browser STT fallback: fix the segment merge to append, never overwrite
4. Add visible segment count indicator so dentist knows recording is accumulating

**Estimated effort:** 3-4 hours (mostly testing and debugging)

---

### Issue 3: Voice Command "Start Recording" Not Working From Consultation
**Problem:** After saying "Hey EndoFlow, open consultation" (which worked — navigated to clinical mode), the dentist then tried:
- Using hands-free mode on the consultation page for "start recording" wake word
- Saying "Hey EndoFlow, start recording"
Neither triggered the GlobalVoiceRecorder to start.

**Root Cause:** Two separate issues:
1. **Master AI → GlobalVoiceRecorder not wired:** The `consultation_start` and `consultation_stop` handlers dispatch custom events (`endoflow:stop_recording`), but there's no `endoflow:start_recording` event, and GlobalVoiceRecorder doesn't listen for any custom events.
2. **Wake word conflict:** The consultation page's hands-free wake word listener and the Master AI's wake word listener compete for the microphone. The VoiceManagerContext has priority arbitration, but the two systems don't coordinate — if Master AI holds the mic, the consultation wake word can't listen.

**Fix Required:**
1. Add `endoflow:start_recording` custom event dispatch in `handleActionCommand`
2. Add event listener in GlobalVoiceRecorder for `endoflow:start_recording`
3. Ensure VoiceManagerContext properly releases mic after Master AI query completes, allowing consultation wake word to resume
4. Test the full flow: "Hey EndoFlow, start consultation with X" → auto-navigate → auto-start recording

**Estimated effort:** 2-3 hours

---

### Issue 4: Patient Not Found in PMS Patient List ✅ FIXED
**Problem:** Popatlal Pandey was visible in the consultation patient search but not in the PMS (Patient Management) patient list.

**Root Cause:** His profile `status` was `pending` instead of `active`. The PMS patient list query in `getActivePatients()` filters by `profiles.status = 'active'`. The consultation patient search uses a different query that doesn't filter by status.

**Fix Applied:** Updated Popatlal's profile status to `active` via database update.

**Broader Issue:** Patients who are created via consultation but haven't gone through the formal verification workflow may have `pending` status. The system should either:
- Auto-activate patients when a dentist creates a consultation for them
- Or show `pending` patients in the PMS list with a visual indicator

---

### Issue 5: Sync Engine Crash — `statusChanged is not defined` ✅ FIXED
**Problem:** When saving the completed consultation, the sync engine crashed with `ReferenceError: statusChanged is not defined` at line 134 of consultation-sync-engine.ts.

**Root Cause:** The Gap 1 fix added `if (statusChanged || hasDiagnosis)` but `statusChanged` was never declared as a variable — the original code used the raw condition `previousStatus && previousStatus !== currentStatus` inline.

**Fix Applied:** Added `const statusChanged = previousStatus && previousStatus !== currentStatus` declaration before the condition. Build verified.

---

### Issue 6: Gap-Filling Latency — 482 Seconds for 5 Answers (CRITICAL)

**Problem:** The most time-consuming part of the entire workflow was the gap-filling conversation. Answering 5 gap questions took ~8 minutes total. Each answer required a full Claude re-synthesis call that grew slower with each turn as the context window expanded.

**Observed Latency:**

| Turn | Answer | Claude Time | Input Tokens | Output Tokens |
|------|--------|-------------|-------------|---------------|
| 1 (initial synthesis) | — | 43s | 1,955 | 2,571 |
| 2 | "yes" (periapical radiolucency) | 71s | 4,626 | 3,514 |
| 3 | "no, lingering pain, spontaneous" | 71s | 8,199 | 4,133 |
| 4 | "no crack, carious breakdown" | 101s | 12,391 | 5,930 |
| 5 | "no resorption" | 117s | 18,379 | 6,394 |
| 6 | "no, its not resorption" | 120s | 24,833 | 6,806 |
| **TOTAL** | | **~523s** | | |

**Root Cause Analysis:**

The `incrementalReSynthesis` function uses a persistent chat session (`AIChatSession` in ai-provider.ts). On each turn:
1. The ~50-token follow-up answer is appended to the session messages
2. **ALL accumulated messages** are sent to Claude (the full history)
3. Claude generates a complete ~4-6K token synthesis JSON response
4. That response is also appended to the history for the NEXT turn

This means input tokens grow linearly: 2K → 5K → 8K → 12K → 18K → 25K. Each subsequent turn is slower because Claude must re-read the entire growing history. The output also grows because the diagnosis gets more detailed with each answer.

**Why Only Endo Questions (Not Restorative):**
- Track activation threshold: endodontic = 0.05 (almost always active), restorative = 0.10
- The conversation about tooth 46 pain/sensitivity activated only the endodontic track
- Scoring formula gives `relevance = 2.0` to the primary (endo) track, `relevance = 0.1` to inactive tracks
- All top-5 questions were endo because they massively outscored any restorative questions
- **Even though tooth 46 had MOD caries with 50% structure loss**, the restorative track didn't activate because the checklist matcher didn't find enough restorative keyword matches in the parsed conversation

**Why 11 Gaps But Only 5 Asked:**
- Agent C formula: `min(20, 8 + activeTracks * 3)` = 11 for 1 active track
- UI cap: `MAX_QUESTIONS = 5` hardcoded in `diagnostic-gap-dialog.tsx`
- Also stops early if confidence reaches 85% threshold

---

## GAP-FILLING OPTIMIZATION PLAN (For Next Session)

### Strategy: Option B + Option C Combined

**Goal:** Reduce gap-filling from ~482 seconds to ~100 seconds (80% reduction)

### Architecture Change

```
CURRENT FLOW (5 serial Claude calls, growing context):
═══════════════════════════════════════════════════════
Question 1 → Answer → Claude re-synthesis (71s) → show diagnosis
Question 2 → Answer → Claude re-synthesis (71s) → show diagnosis
Question 3 → Answer → Claude re-synthesis (101s) → show diagnosis
Question 4 → Answer → Claude re-synthesis (117s) → show diagnosis
Question 5 → Answer → Claude re-synthesis (120s) → show diagnosis
                                          TOTAL: ~482 seconds

PROPOSED FLOW (5 Gemini calls + 1 Claude call, compressed context):
════════════════════════════════════════════════════════════════════
Question 1 → Answer → Gemini parse (3s) → rough confidence delta → show estimate
Question 2 → Answer → Gemini parse (3s) → rough confidence delta → show estimate
Question 3 → Answer → Gemini parse (3s) → rough confidence delta → show estimate
Question 4 → Answer → Gemini parse (3s) → rough confidence delta → show estimate
Question 5 → Answer → Gemini parse (3s) → rough confidence delta → show estimate
    ↓
ALL 5 answers collected (~15 seconds total for all Q&A)
    ↓
Single Claude re-synthesis with compressed context (~80 seconds)
    ↓
Final diagnosis shown with accurate confidence
                                          TOTAL: ~95-110 seconds
```

### Implementation Plan

#### Step 1: Create Gap Interviewer Agent (NEW FILE)
**File:** `lib/agents/gap-interviewer-agent.ts`

```typescript
export interface InterviewerState {
  questions: GapQuestion[]
  answers: { questionId: string; rawAnswer: string; parsedValue: string; confidence: number }[]
  currentIndex: number
  estimatedConfidence: number  // rough estimate, not from Claude
  isComplete: boolean
}

/**
 * Lightweight agent that manages the gap Q&A loop WITHOUT calling Claude.
 * Uses Gemini for fast answer parsing and deterministic confidence estimation.
 */
export async function parseAnswerFast(
  question: GapQuestion,
  rawAnswer: string
): Promise<{ parsedValue: string; confidence: number; confidenceDelta: number }>

/**
 * Estimate how much an answer changes diagnostic confidence.
 * Pure deterministic calculation based on question's diagnostic_weight.
 * No LLM call needed.
 */
export function estimateConfidenceDelta(
  question: GapQuestion,
  parsedValue: string,
  currentConfidence: number
): number
```

**Logic for `estimateConfidenceDelta`:**
- Each question has a `diagnostic_weight` (0-1) from the questionnaire template
- If the answer is clinically significant (positive finding): `delta = weight * (100 - currentConfidence) * 0.3`
- If the answer is negative/normal: `delta = weight * (100 - currentConfidence) * 0.1`
- Cap maximum delta at 15% per answer
- This is an ESTIMATE shown to the dentist — the final Claude call computes the real confidence

#### Step 2: Create Batch Re-Synthesis Function (MODIFY EXISTING FILE)
**File:** `lib/agents/diagnostic-synthesis-agent.ts`

Add new function alongside existing `incrementalReSynthesis`:

```typescript
/**
 * Re-synthesize diagnosis with ALL gap answers at once.
 * Uses compressed context (no full session history).
 * Called ONCE after all gap questions are answered.
 */
export async function batchReSynthesis(params: {
  previousSynthesis: SynthesisOutput    // latest diagnosis before gaps
  gapAnswers: { questionId: string; questionText: string; answer: string }[]
  conversationContext: ConversationContext
  toothNumber: string
  fullPatientContext?: FullPatientContext
}): Promise<SynthesisOutput>
```

**Prompt structure (compressed — no growing history):**
```
You are an endodontic diagnostic AI. You previously analyzed tooth {toothNumber}
and produced this preliminary diagnosis:

PREVIOUS DIAGNOSIS: {previousSynthesis.primary_diagnosis} ({confidence}%)

The dentist has now answered {N} additional clinical questions:

1. Q: "What was the cold test response?" → A: "negative"
2. Q: "Is there periapical radiolucency?" → A: "yes, well-defined"
3. Q: "Is there spontaneous pain?" → A: "yes, lingering, elevated by chewing"
4. Q: "Is there a crack?" → A: "no crack, carious breakdown"
5. Q: "Is there resorption?" → A: "no resorption"

PATIENT CONTEXT: {compressed patient history}

Based on ALL this new information together, provide your updated diagnosis.
```

This keeps input at ~3-4K tokens regardless of how many questions were asked.

#### Step 3: Update Pipeline Action (MODIFY EXISTING FILE)
**File:** `lib/actions/consultation-pipeline.ts`

Add new action:

```typescript
/**
 * Process ALL gap answers at once (batch mode).
 * Replaces per-turn processGapAnswerAction for the optimized flow.
 */
export async function processAllGapAnswersAction(params: {
  answers: { questionId: string; questionText: string; rawAnswer: string }[]
  previousSynthesis: SynthesisOutput
  conversationContext: ConversationContext
  toothNumber: string
  patientId: string
}): Promise<{ success: boolean; synthesis?: SynthesisOutput; error?: string }>
```

Implementation:
1. Parse ALL answers in parallel using Gemini (5 parallel calls, ~3s total)
2. Merge all parsed answers into conversation context
3. Call `batchReSynthesis` with compressed context (1 Claude call, ~80s)
4. Return updated synthesis

#### Step 4: Update Gap Dialog UI (MODIFY EXISTING FILE)
**File:** `components/dentist/diagnostic-gap-dialog.tsx`

Changes:
1. **Remove per-turn `processGapAnswerAction` call** — currently called after each answer (line ~393)
2. **Add local answer collection:** Store answers in state array instead of sending to Claude each time
3. **Show estimated confidence:** After each answer, call `estimateConfidenceDelta` (deterministic, instant) and update a local confidence estimate bar
4. **"Processing..." phase at the end:** After all questions answered OR dentist says "done," show "Analyzing all responses..." spinner and call `processAllGapAnswersAction`
5. **Final diagnosis display:** Show the accurate Claude diagnosis once the batch call completes

**New UI flow:**
```
Phase: asking_question
┌─────────────────────────────────────────────┐
│ Question 3 of 5                              │
│ "Is there a crack visible on the tooth?"     │
│                                              │
│ [text input] [🎤 voice] [Skip]               │
│                                              │
│ Estimated confidence: ████████░░ 52%         │
│ (based on answers so far)                    │
│                                              │
│ Previous answers:                            │
│ ✓ Periapical radiolucency: yes               │
│ ✓ Bite pain: no, lingering, spontaneous      │
└─────────────────────────────────────────────┘

Phase: batch_processing (NEW — replaces per-turn synthesis)
┌─────────────────────────────────────────────┐
│ 🧠 Analyzing all 5 responses...             │
│                                              │
│ ████████████████░░░░░░░░░ 65%               │
│ Running final diagnostic synthesis           │
│                                              │
│ This takes about 60-90 seconds               │
└─────────────────────────────────────────────┘

Phase: complete
┌─────────────────────────────────────────────┐
│ ✅ Diagnosis Complete                        │
│                                              │
│ Pulp Necrosis with Symptomatic Apical       │
│ Periodontitis — Tooth 46                     │
│ Confidence: 79%                              │
│                                              │
│ [Accept] [Run More Questions]                │
└─────────────────────────────────────────────┘
```

#### Step 5: Fix Track Activation for Restorative
**File:** `lib/agents/gap-finder-agent.ts`

The restorative track didn't activate despite obvious caries. Two fixes:
1. **Lower restorative activation threshold** from 0.10 to 0.03 (same as endo)
2. **Cross-reference tooth data:** If `toothData.selectedDiagnoses` or `toothData.status` contains caries-related keywords, force-activate the restorative track regardless of checklist match score

```typescript
// In gap-finder-agent.ts, after track activation:
if (toothData?.status === 'caries' ||
    toothData?.selectedDiagnoses?.some(d => d.toLowerCase().includes('caries'))) {
  // Force-activate restorative track
  activeTrackIds.add('restorative')
}
```

#### Step 6: Increase MAX_QUESTIONS or Make Dynamic
**File:** `components/dentist/diagnostic-gap-dialog.tsx`

Change `MAX_QUESTIONS` from hardcoded 5 to dynamic based on active tracks:
```typescript
const MAX_QUESTIONS = Math.min(8, 3 + activeTrackCount * 2)
// 1 track: 5 questions, 2 tracks: 7, 3 tracks: 8 (capped)
```

### Expected Results After Optimization

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Gap Q&A total time | ~482s (8 min) | ~95-110s (1.5 min) | **~80% faster** |
| Per-answer latency | 71-120s | 3s (Gemini parse) | **~97% faster** |
| Final synthesis | grows each turn | single call, fixed ~80s | **Predictable** |
| Claude API calls | 6 (initial + 5 turns) | 2 (initial + 1 batch) | **67% fewer** |
| Input tokens total | ~72K across 6 calls | ~6K across 2 calls | **~92% fewer tokens** |
| Tracks activated | 1 (endo only) | 2+ (endo + restorative) | **More complete** |
| Questions asked | 5 (hardcoded) | 5-8 (dynamic) | **Adaptive** |

### Implementation Order
1. Step 1: Gap Interviewer Agent (new file) — 2 hours
2. Step 2: Batch Re-Synthesis function — 2 hours
3. Step 3: Pipeline action update — 1 hour
4. Step 4: Gap Dialog UI update — 3-4 hours
5. Step 5: Fix restorative track activation — 1 hour
6. Step 6: Dynamic MAX_QUESTIONS — 30 min

**Total estimated: 9-10 hours (1 full session)**
