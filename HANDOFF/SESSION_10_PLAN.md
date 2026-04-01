# Session 10 Plan — MCP Agentic Backbone + Synchronized Loop

## Date: 2026-03-29
## Previous Sessions: 5-9 (voice, agents, dark theme, longitudinal tracking)

---

## THE VISION (Nisarg's Clarified Intent)

EndoFlow's MCP backbone should work as a **unified context-gathering and function-routing architecture** that serves both voice AND UI equally. Voice is not the only interface — it's one access layer on top of the same agentic pipeline that button clicks use.

**The key insight:** It's not "voice-only, no touch." It's "the underlying system works this way regardless of trigger source."

### What This Means Concretely

1. **When the AI pipeline runs** (voice "stop recording" OR click "Save"), it **always** pulls full patient longitudinal context — not just the current transcript
2. **When a consultation completes** (voice-commanded OR button-pressed), output **always** flows through the sync loop — update profile, link appointment, offer report
3. **When someone queries patient status** (voice OR PMS tab), the system **assembles the full picture** from all interconnected data
4. **Voice adds hands-free access** to these same server actions and agents

---

## ARCHITECTURE: THE SYNCHRONIZED LOOP

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENDOFLOW MASTER AI                            │
│              (Central Router / Function Caller)                  │
│                                                                  │
│  Input: Voice command OR UI button click                         │
│  Output: Calls the SAME server actions either way                │
│                                                                  │
│  Can: Navigate modes, start/stop consultation, query data,       │
│       accept diagnosis, create appointment, generate report      │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────────────────────────────────────────┐
    │           INTENT CLASSIFICATION                      │
    │                                                      │
    │  QUERY: "What's my schedule?" → read & respond       │
    │  NAVIGATE: "Open patient XYZ" → navigate + load      │
    │  CLINICAL: "Start consultation" → mode detect + open │
    │  CONTROL: "Stop recording" → stop + send to pipeline │
    │  ACCEPT: "Accept diagnosis" → save + sync + link     │
    │  SCHEDULE: "Set appointment" → create linked appt    │
    │  REPORT: "Generate report" → PDF + save + send       │
    │  STATUS: "Patient status?" → assemble full picture   │
    └────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   CONSULTATION PAGE              PATIENT PROFILE (PMS)           │
│   (Data COLLECTION)              (Data DISPLAY)                  │
│                                                                  │
│   Records conversation    ←───── Provides patient context        │
│   Runs AI pipeline               (history, episodes, timeline)   │
│   Produces diagnosis      ─────→ Receives diagnosis output       │
│   Creates treatment plan  ─────→ Updates tooth status             │
│   Links to appointment    ─────→ Episode visits logged           │
│   Generates report        ─────→ PDF saved to profile            │
│                                                                  │
│        ↕ SYNC ENGINE ↕                                           │
│   (Bidirectional: write on save, read on pipeline start)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

THE LOOP:
  Consultation → AI Pipeline (with full history) → Accepted
      → Sync to Profile → Linked Appointment Created
      → Next Appointment Opens → Reads Full History
      → Auto-Detects Mode → New Consultation → LOOP CONTINUES
```

---

## IMPLEMENTATION PHASES

### Phase 1: Patient History Injection into AI Pipeline
**Priority: HIGHEST — This is the foundation everything else depends on**

**Problem:** The AI orchestrator (`consultation-ai-orchestrator.ts`) currently receives only `structuredConversation` and `patientHistory` (which is a thin object). It does NOT fetch:
- Previous consultation clinical_data
- Tooth timeline events
- Treatment episode status (what's done, what's remaining)
- Case history (age, medical conditions, allergies, habits, OPMD)

**What to build:**

#### 1.1: Patient Context Assembler
**New file:** `lib/services/patient-context-assembler.ts`

```typescript
export interface FullPatientContext {
  // Demographics & case history
  demographics: {
    age: number
    gender: string
    medicalConditions: string[]
    allergies: string[]
    medications: string[]
    habits: { smoking: boolean; tobacco: boolean; alcohol: boolean }
    oralHygieneStatus: string
  }

  // Longitudinal dental history
  toothHistory: {
    toothNumber: string
    timeline: ToothTimelineEvent[]  // all events for this tooth
    currentStatus: string
    activeEpisode?: {
      episodeId: string
      type: string
      status: string
      completedVisits: number
      plannedVisits: number
      lastVisitDate: string
      lastVisitSummary: string
    }
  }[]

  // Previous consultations (summarized, not full clinical_data)
  previousConsultations: {
    date: string
    mode: string  // new_consultation, treatment_visit, follow_up
    chiefComplaint: string
    diagnoses: string[]
    treatmentsPerformed: string[]
    toothNumbers: string[]
    prescriptions: string[]
    followUpNotes: string
  }[]

  // Active treatment episodes
  activeEpisodes: {
    episodeId: string
    toothNumber: string
    diagnosis: string
    treatmentPlan: string
    status: string
    completedVisits: number
    plannedVisits: number
    nextSteps: string
  }[]
}

export async function assemblePatientContext(
  patientId: string,
  currentToothNumber?: string  // if known, emphasize this tooth's history
): Promise<FullPatientContext>
```

**Implementation:** Calls existing server actions in parallel:
- `getPatientFullTimelineAction(patientId)` → timeline
- `getTreatmentEpisodesForPatientAction(patientId)` → episodes
- `getConsultationsAction({ patientId })` → previous consultations
- Patient record from `api.patients` → demographics
- Case history from `consultations.clinical_data` where section = medical-history → conditions, allergies

#### 1.2: Inject Context into Orchestrator
**File to modify:** `lib/agents/consultation-ai-orchestrator.ts`

Add `patientContext: FullPatientContext` to `runConsultationAIPipeline()` params. Pass it to:
- `runDiagnosticSynthesis()` — so the LLM knows full patient history
- `runGapFinder()` — so it knows what's already been asked in previous visits
- `runChecklistMatcher()` — so it can pre-fill answers from previous data

The synthesis prompt gets a new section:
```
PATIENT LONGITUDINAL CONTEXT:
- Age: 45, Male
- Medical: Hypertension (controlled), Diabetes Type 2
- Allergies: Penicillin
- Previous visits: 3 consultations over 6 months
- Tooth 46: Diagnosed reversible pulpitis (2 months ago), vital pulp therapy done,
  follow-up showed improvement, now presenting again with pain
- Active episodes: Tooth 46 (VPT, 2/3 visits done), Tooth 14 (crown, planned)
```

#### 1.3: Update Consultation UI to Pass Context
**File to modify:** `components/dentist/enhanced-new-consultation-v3.tsx` (and v4/v5)

When the AI pipeline is triggered (after voice recording stops OR when AI copilot fires):
1. Call `assemblePatientContext(patientId, toothNumber)`
2. Pass result to `runConsultationAIPipeline()`

This change is transparent to the user — same buttons, same voice commands, but AI now knows the full patient picture.

---

### Phase 2: Master AI as Function Caller
**Priority: HIGH — Makes voice a first-class interface**

**Problem:** EndoFlow Master AI (`endoflow-voice-controller.tsx`) currently has limited hardcoded commands. It needs to become a proper function-calling agent.

#### 2.1: Define Tool Registry
**New file:** `lib/agents/master-ai-tools.ts`

```typescript
export const ENDOFLOW_TOOLS = [
  {
    name: 'navigate_to_mode',
    description: 'Navigate to a dashboard mode',
    parameters: { mode: 'home | clinical | pms | research | management' }
  },
  {
    name: 'start_consultation',
    description: 'Start a consultation for a patient. Auto-detects mode (first visit, treatment, follow-up)',
    parameters: { patientName: 'string', patientId?: 'string' }
  },
  {
    name: 'stop_recording',
    description: 'Stop the voice recording and send transcript to AI pipeline',
    parameters: {}
  },
  {
    name: 'get_schedule',
    description: 'Get today\'s or upcoming schedule',
    parameters: { timeframe: 'today | tomorrow | this_week' }
  },
  {
    name: 'get_patient_status',
    description: 'Get full status of a patient including episodes, timeline, remaining treatments',
    parameters: { patientName: 'string' }
  },
  {
    name: 'accept_diagnosis',
    description: 'Accept the AI-suggested diagnosis and treatment plan',
    parameters: {}
  },
  {
    name: 'create_appointment',
    description: 'Create a follow-up appointment linked to current consultation',
    parameters: { timeframe: 'string', type: 'treatment | follow_up | review' }
  },
  {
    name: 'generate_report',
    description: 'Generate PDF report for current/specified consultation',
    parameters: { consultationId?: 'string', sendToPatient?: 'boolean' }
  },
  {
    name: 'query_knowledge',
    description: 'Ask a clinical/research question',
    parameters: { query: 'string' }
  }
]
```

#### 2.2: Tool Executor
**New file:** `lib/agents/master-ai-executor.ts`

Each tool maps to existing server actions:
- `navigate_to_mode` → updates React state via context/callback
- `start_consultation` → searches patient, detects mode, navigates
- `get_patient_status` → calls `assemblePatientContext()` + formats as speech
- `create_appointment` → calls `createAppointmentRequest()`
- `generate_report` → calls new report generation service (Phase 4)

#### 2.3: Update Master AI Controller
**File to modify:** `components/dentist/endoflow-voice-controller.tsx`

Replace hardcoded command matching with:
1. Send voice transcript to Claude with tool definitions
2. Claude returns tool call(s)
3. Execute tool(s) via executor
4. Return result to user (TTS or UI update)

**This makes voice and UI equivalent** — both call the same server actions through the same tool registry.

---

### Phase 3: Appointment ↔ Diagnosis Chain Enhancement
**Priority: MEDIUM — Strengthens the loop**

**Problem:** Appointments are linked to consultations but don't carry the specific diagnosis/treatment context. When a follow-up appointment opens, the system doesn't know "this appointment is for obturation on tooth 46 after access opening was done."

#### 3.1: Enrich Appointment Record
**File to modify:** `lib/db/schema.ts`

Add to appointments:
```typescript
linked_tooth_numbers: text('linked_tooth_numbers'),  // JSON array: ["46", "14"]
linked_diagnosis: text('linked_diagnosis'),           // "Irreversible pulpitis"
linked_treatment_plan: text('linked_treatment_plan'), // "RCT - Visit 2: Obturation"
linked_episode_id: uuid('linked_episode_id'),         // FK to treatment_episodes
```

#### 3.2: Auto-populate on appointment creation
**File to modify:** `lib/actions/appointments.ts`

When creating an appointment from a completed consultation:
- Copy diagnosis and treatment plan from the accepted AI output
- Link to the episode
- Store tooth numbers

#### 3.3: Auto-load context when appointment opens
**File to modify:** `components/dentist/enhanced-new-consultation-v5.tsx`

When V5 loads with an appointmentId:
- Read linked_diagnosis, linked_treatment_plan, linked_episode_id
- Pre-populate consultation context
- Show "Continuing: [treatment] on tooth [number], visit [X] of [Y]"

---

### Phase 4: PDF Report Generation
**Priority: MEDIUM — Completes the output loop**

#### 4.1: Report Data Assembler
**New file:** `lib/services/report-generator.ts`

```typescript
export interface ConsultationReport {
  patientInfo: { name, age, uhid }
  consultationDate: string
  consultationMode: string
  transcript: string           // verbatim conversation
  aiDiagnosis: SynthesisOutput // AI pipeline output
  toothChart: ToothData[]      // FDI chart state
  prescriptions: Prescription[]
  followUpPlan: string
  generatedAt: string
  dentistName: string
}

export async function generateConsultationReport(
  consultationId: string
): Promise<Buffer>  // PDF buffer
```

#### 4.2: PDF Generation
Use a library like `@react-pdf/renderer` or `pdfmake` to create a structured PDF with:
- Header: Clinic name, date, patient info
- Section 1: Conversation transcript (verbatim)
- Section 2: AI Diagnosis & Treatment Plan (formatted)
- Section 3: Tooth chart snapshot (rendered as table or image)
- Section 4: Prescriptions
- Section 5: Follow-up plan
- Footer: Dentist signature line

#### 4.3: Save & Send
- Save PDF to Supabase Storage (`reports/` bucket)
- Link to patient profile (new `patient_reports` table or use `patient_files`)
- Option to send via existing messaging service

#### 4.4: UI Integration
- "Generate Report" button on consultation completion
- "Download Report" in patient profile
- Voice: "Generate report" via Master AI tool

---

### Phase 5: Voice Response (TTS)
**Priority: LOW — Enhancement layer, not blocking**

#### 5.1: Text-to-Speech Service
**New file:** `lib/services/tts-service.ts`

Use browser's `SpeechSynthesis` API or Deepgram TTS to speak responses back:
- Schedule summaries
- Patient status summaries
- Diagnosis announcements
- Confirmation prompts

#### 5.2: Response Formatting
The Master AI executor formats tool results into speakable text:
- `get_schedule` → "You have 5 patients today. First is Mr. Patel at 9:30 for a root canal follow-up."
- `get_patient_status` → "Patient Sharma has 2 active episodes. Tooth 46: RCT in progress, 2 of 3 visits done."

---

### Phase 6: UI Research & Updates (If Needed)
**Priority: ASSESS FIRST**

Some pages may need UI updates to support the richer context flow:

#### Potential UI Changes to Research
1. **Consultation page** — Should it show a "Patient Context" panel summarizing longitudinal history before recording starts?
2. **AI output display** — Currently shows in tooth dialog. Should there be a dedicated AI results panel showing diagnosis + evidence + gaps in one view?
3. **Patient profile** — Does the Episodes tab need a better visual representation of the treatment journey (e.g., a horizontal progress bar per episode)?
4. **Appointment view** — Should show linked diagnosis/treatment context inline, not just date/time
5. **Report preview** — In-app PDF preview before download?

#### Research Sources
- Existing mockups in `/mockups/` directory
- Current v0.dev prototypes in `/schema ss/temp/`
- PubMed research on clinical decision support UI (from Session 6)
- Look at dental software UIs: Dentrix, Open Dental, Curve Dental for appointment-episode linking patterns

---

## IMPLEMENTATION ORDER (Recommended)

```
Session 10A: Phase 1 (Patient History → AI Pipeline)
  - Build patient-context-assembler.ts
  - Inject into orchestrator + synthesis agent
  - Test: run pipeline with a patient who has previous consultations
  → Result: AI now knows full patient history

Session 10B: Phase 2 (Master AI Function Caller)
  - Define tool registry
  - Build executor mapping tools → server actions
  - Update endoflow-voice-controller to use tool calling
  → Result: Voice can navigate, query, and control

Session 10C: Phase 3 (Appointment Chain)
  - Enrich appointment schema
  - Auto-populate on creation from consultation
  - Auto-load context when appointment opens
  → Result: The loop is fully linked

Session 10D: Phase 4 (PDF Reports)
  - Report assembler + PDF generator
  - Save to storage + patient profile
  - UI: generate button + download
  → Result: Complete output chain

Session 10E: Dark theme remaining (parallel, independent)
  - Fix 12 remaining components using documented cheatsheet
  → Can be done anytime, doesn't block other phases
```

---

## DEPENDENCIES

- Phase 1 is independent — start immediately
- Phase 2 depends on Phase 1 (Master AI's `get_patient_status` tool needs the assembler)
- Phase 3 depends on Phase 1 (enriched appointments need context data)
- Phase 4 is independent (PDF generation doesn't need the other phases)
- Phase 5 (TTS) depends on Phase 2 (needs Master AI tool results to speak)
- Phase 6 (UI) — assess after Phases 1-3 are working

---

## WHAT'S ALREADY BUILT (Leverage, Don't Rebuild)

| Component | Location | Status |
|---|---|---|
| Sync engine (consultation → profile) | `lib/services/consultation-sync-engine.ts` | Working |
| Treatment episodes CRUD | `lib/actions/treatment-episodes.ts` | Working |
| Episode visits + auto-increment | `lib/actions/episode-visits.ts` | Working |
| Tooth timeline events | `lib/actions/tooth-timeline.ts` | Working |
| Full patient timeline query | `getPatientFullTimelineAction()` | Working |
| Consultation mode detection | `lib/types/consultation-modes.ts` | Working |
| N-track diagnosis pipeline | `lib/agents/consultation-ai-orchestrator.ts` | Built, needs testing |
| Conductor agent | `lib/agents/conductor-agent.ts` | Built, needs testing |
| Diagnostic synthesis (persistent sessions) | `lib/agents/diagnostic-synthesis-agent.ts` | Built, needs testing |
| Gap finder + answer parser | `lib/agents/gap-*.ts` | Built, needs testing |
| Voice manager (mic arbitration) | `lib/contexts/voice-manager-context.tsx` | Working |
| Deepgram STT service | `lib/services/deepgram-stt.ts` | Working |
| Master AI voice controller | `components/dentist/endoflow-voice-controller.tsx` | Partial |
| Appointment ↔ consultation linking | `lib/actions/consultation.ts` | Working |
| Messaging service | `lib/actions/simple-messaging.ts` | Working |
| Patient files upload | `lib/actions/patient-files.ts` | Working |

---

## KNOWN RISKS

1. **Token limits:** Injecting full patient history into the synthesis prompt could exceed context limits for patients with many consultations. Solution: summarize older consultations, keep only last 5 in detail.

2. **Latency:** Patient context assembly adds database reads before AI pipeline runs. Solution: parallel fetches, cache assembled context for the session duration.

3. **OpenAI credits:** RAG embeddings require OpenAI API credits which were exhausted in Session 7. Need to verify/replenish before testing full pipeline.

4. **Synthesis session persistence:** In-memory sessions don't survive serverless cold starts. For production, consider Redis or database-backed sessions.

5. **PDF library choice:** Need to evaluate `@react-pdf/renderer` vs `pdfmake` vs `puppeteer` for server-side PDF generation in Next.js.
