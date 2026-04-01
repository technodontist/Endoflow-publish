# EndoFlow MCP Architecture — Complete Visual Map

## How Everything Connects Through Voice

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                         ║
║                    🎤  "HEY ENDOFLOW"  🎤                              ║
║                    (Wake Word Detection)                                ║
║                    Browser Web Speech API                               ║
║                                                                         ║
╚════════════════════════════════╦════════════════════════════════════════╝
                                 ║
                                 ▼
╔══════════════════════════════════════════════════════════════════════════╗
║                  ENDOFLOW MASTER AI ORCHESTRATOR                        ║
║                  lib/services/endoflow-master-ai.ts                     ║
║                                                                         ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  STEP 0: Prompt Refinement Agent (Gemini Flash)                  │   ║
║  │  150+ regex dental STT corrections + LLM cleanup                 │   ║
║  │  "consolation" → "consultation", "pull py this" → "pulpitis"    │   ║
║  └──────────────────────────┬───────────────────────────────────────┘   ║
║                              ▼                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  STEP 1: Intent Classification (Claude LLM)                     │   ║
║  │                                                                   │   ║
║  │  12 Intent Types:                                                 │   ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │   ║
║  │  │ clinical_research│  │appointment_inquir│  │appointment_book│   │   ║
║  │  │ "Find RCT cases" │  │"What's my sched?"│  │"Book tomorrow" │   │   ║
║  │  └─────────────────┘  └─────────────────┘  └────────────────┘   │   ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │   ║
║  │  │treatment_planning│  │  patient_inquiry │  │task_management │   │   ║
║  │  │"How to treat..." │  │"Tell me about X" │  │"Assign task to"│   │   ║
║  │  └─────────────────┘  └─────────────────┘  └────────────────┘   │   ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │   ║
║  │  │   navigation  ✨ │  │consult_start  ✨ │  │consult_stop ✨ │   │   ║
║  │  │"Go to clinical"  │  │"Start consult XY"│  │"Stop recording"│   │   ║
║  │  └─────────────────┘  └─────────────────┘  └────────────────┘   │   ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │   ║
║  │  │patient_status ✨ │  │ general_question │  │  clarification │   │   ║
║  │  │"Status of XYZ?"  │  │"What is MTA?"    │  │"Can you repeat"│   │   ║
║  │  └─────────────────┘  └─────────────────┘  └────────────────┘   │   ║
║  │                        ✨ = Added this session                    │   ║
║  └──────────────────────────┬───────────────────────────────────────┘   ║
║                              ▼                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  STEP 2: Route to Specialized Handler                            │   ║
║  │                                                                   │   ║
║  │  navigation ────────→ switchMode() on dentist page               │   ║
║  │  consultation_start → lookup patient → detect mode → navigate    │   ║
║  │                       → start recording                          │   ║
║  │  consultation_stop ─→ signal GlobalVoiceRecorder to stop         │   ║
║  │                       → existing AI pipeline takes over          │   ║
║  │  patient_status ────→ assemblePatientContext() → format summary  │   ║
║  │  appointment_inquiry→ query Supabase → format schedule           │   ║
║  │  appointment_booking→ NL parser (Gemini) → create appointment   │   ║
║  │  clinical_research ─→ cohort analysis (Gemini) → format results │   ║
║  │  treatment_planning → RAG + Claude → evidence-based suggestions │   ║
║  │  patient_inquiry ───→ query Supabase → format patient info      │   ║
║  │  task_management ───→ NL parser (Gemini) → create/assign task   │   ║
║  └──────────────────────────┬───────────────────────────────────────┘   ║
║                              ▼                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  STEP 3: Response Synthesis (Claude) + TTS ✨                     │   ║
║  │                                                                   │   ║
║  │  Natural language response → formatForSpeech() → speakWithTTS() │   ║
║  │  Dental abbreviation expansion (RCT → "root canal treatment")   │   ║
║  │  Chunked speaking (handles browser 15s limit)                    │   ║
║  │  Voice selection (prefers natural/premium voices)                │   ║
║  │  Hindi translation if language = hi-IN                           │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                         ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## What Happens When You Say "Start Consultation with Patient Sharma"

```
"Start consolation with patient Sharma"
              ↓
    Prompt Refinement: "consolation" → "consultation"
              ↓
    Intent: consultation_start (confidence: 0.95)
    Entities: { patientName: "Sharma" }
              ↓
    Handler: delegateToConsultationStart()
      │
      ├── 1. Search api.patients for "Sharma"
      │      → Found: Rajesh Sharma (ID: abc-123)
      │
      ├── 2. Check treatment_episodes for active episodes
      │      → Found: 1 active (tooth 46, RCT in progress)
      │
      ├── 3. Check previous consultations
      │      → Found: 2 completed consultations
      │
      ├── 4. Auto-detect mode → treatment_visit
      │
      └── 5. Return actionCommand:
             {
               action: 'consultation_start',
               patientId: 'abc-123',
               patientName: 'Rajesh Sharma',
               consultationMode: 'treatment_visit',
               startRecording: true
             }
              ↓
    Frontend: handleActionCommand()
      ├── switchMode('clinical')
      ├── Store patient info in sessionStorage
      └── V5 opens with mode=treatment_visit
              ↓
    TTS speaks: "Starting treatment visit with Rajesh Sharma.
                Recording will begin. You can start talking
                with the patient."
              ↓
    🎤 Recording starts (Deepgram Medical STT)
    Dentist and patient talk for 5-10 minutes
              ↓
    "Stop recording"
              ↓
    Intent: consultation_stop → stop recording signal
              ↓
    ╔═══════════════════════════════════════════════════════════╗
    ║    EXISTING AI PIPELINE TAKES OVER (UNTOUCHED)           ║
    ║                                                           ║
    ║    Transcript → Medical Conversation Parser               ║
    ║         → Distribute to tabs (CC, HOPI, Med Hx, etc.)   ║
    ║         → Extract tooth findings → Color FDI chart       ║
    ║                                                           ║
    ║    Dentist clicks tooth on FDI chart                      ║
    ║         → N-Track Diagnostic Pipeline fires              ║
    ║         → (see below)                                    ║
    ╚═══════════════════════════════════════════════════════════╝
```

## The N-Track Diagnostic Pipeline (Crown Jewel)

```
                     DENTIST CLICKS TOOTH ON FDI CHART
                                   ↓
              ┌────────────────────────────────────────┐
              │     runPipelineAction() called          │
              │     lib/actions/consultation-pipeline.ts│
              └────────────────┬───────────────────────┘
                               ↓
              ┌────────────────────────────────────────┐
              │  ✨ assemblePatientContext() ✨          │
              │  (NEW — Phase 1 this session)           │
              │                                         │
              │  Parallel fetch from 5 Supabase tables: │
              │  ├── patients (demographics, DOB, age)  │
              │  ├── consultations (previous visits)    │
              │  ├── tooth_diagnoses (all teeth status) │
              │  ├── treatment_episodes (active plans)  │
              │  └── tooth_timeline (event history)     │
              │                                         │
              │  Output: FullPatientContext object       │
              └────────────────┬───────────────────────┘
                               ↓
╔══════════════════════════════════════════════════════════════════════╗
║         CONSULTATION AI ORCHESTRATOR                                ║
║         lib/agents/consultation-ai-orchestrator.ts                  ║
║                                                                      ║
║  ┌─── STEP 1 (PARALLEL) ─────────────────────────────────────────┐  ║
║  │                                                                │  ║
║  │  ┌────────────────────┐    ┌────────────────────────────┐     │  ║
║  │  │  AGENT A            │    │  AGENT B                    │     │  ║
║  │  │  Checklist Matcher  │    │  Subspecialty Classifier    │     │  ║
║  │  │                     │    │                              │     │  ║
║  │  │  Maps conversation  │    │  Weighted probabilities:    │     │  ║
║  │  │  to 11 clinical     │    │  ├── pulp_pathology: 52%    │     │  ║
║  │  │  questionnaires     │    │  ├── periapical: 30%        │     │  ║
║  │  │  (AAE, IADT, etc.)  │    │  ├── cracked_tooth: 12%     │     │  ║
║  │  │                     │    │  └── resorption: 6%          │     │  ║
║  │  │  Output: which Qs   │    │                              │     │  ║
║  │  │  answered/missing   │    │  Claude + deterministic      │     │  ║
║  │  │  per questionnaire  │    │                              │     │  ║
║  │  │  (Claude)           │    │                              │     │  ║
║  │  └────────────────────┘    └────────────────────────────┘     │  ║
║  └────────────────────────────┬───────────────────────────────────┘  ║
║                                ▼                                     ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  AGENT C — N-Track Gap Finder                                  │  ║
║  │                                                                │  ║
║  │  6 DIAGNOSIS TRACKS (config-driven):                          │  ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                      │  ║
║  │  │Endodontic│ │Restorative│ │Periodontal│                     │  ║
║  │  └──────────┘ └──────────┘ └──────────┘                      │  ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                      │  ║
║  │  │Prosthodon│ │ Surgical │ │  Trauma  │                      │  ║
║  │  └──────────┘ └──────────┘ └──────────┘                      │  ║
║  │                                                                │  ║
║  │  Activates tracks dynamically based on conversation content.  │  ║
║  │  Finds diagnosis-changing missing questions per active track.  │  ║
║  │  Generates natural-language gap questions for dentist.         │  ║
║  │  (Claude + deterministic scoring)                              │  ║
║  └────────────────────────────┬───────────────────────────────────┘  ║
║                                ▼                                     ║
║  ┌─── STEP 2 (PARALLEL) ─────────────────────────────────────────┐  ║
║  │                                                                │  ║
║  │  ┌───────────────────────┐  ┌───────────────────────────┐     │  ║
║  │  │  RAG HYBRID SEARCH     │  │  CLINICAL DATA CONTEXT     │     │  ║
║  │  │                         │  │                             │     │  ║
║  │  │  Vector (OpenAI 3072d)  │  │  Your clinic's own data:   │     │  ║
║  │  │  + BM25 full-text       │  │  ├── Treatment outcomes    │     │  ║
║  │  │  + RRF fusion           │  │  ├── Success rates          │     │  ║
║  │  │  + Subspecialty boost   │  │  └── Patient demographics  │     │  ║
║  │  │                         │  │                             │     │  ║
║  │  │  Searches medical_      │  │  From api.treatments +     │     │  ║
║  │  │  knowledge table        │  │  tooth_diagnoses tables    │     │  ║
║  │  │  (published literature) │  │                             │     │  ║
║  │  └───────────────────────┘  └───────────────────────────┘     │  ║
║  └────────────────────────────┬───────────────────────────────────┘  ║
║                                ▼                                     ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  DIAGNOSTIC SYNTHESIS AGENT — The Brain                        │  ║
║  │                                                                │  ║
║  │  TWO-PHASE REASONING (Claude, 8192 tokens, temp 0.15):       │  ║
║  │                                                                │  ║
║  │  Phase 1: "Read the conversation. Form YOUR OWN impression.   │  ║
║  │           Don't look at agent reports yet."                    │  ║
║  │                                                                │  ║
║  │  Phase 2: "Now verify against agent reports, RAG evidence,    │  ║
║  │           ✨ patient longitudinal history ✨, and clinic data. │  ║
║  │           Produce final diagnosis + treatment plan."           │  ║
║  │                                                                │  ║
║  │  PERSISTENT MULTI-TURN SESSION:                               │  ║
║  │  ├── First call: ~8000 tokens (full context)                  │  ║
║  │  ├── Gap answer follow-up: ~50 tokens (incremental)           │  ║
║  │  └── 80% token reduction on re-synthesis                      │  ║
║  │                                                                │  ║
║  │  Output: SynthesisOutput {                                    │  ║
║  │    diagnosis, differentials, aae_classification,              │  ║
║  │    treatment_options, evidence_citations, prognosis,          │  ║
║  │    restorative_diagnosis (if applicable),                     │  ║
║  │    combined_treatment_sequence                                │  ║
║  │  }                                                            │  ║
║  └────────────────────────────┬───────────────────────────────────┘  ║
║                                ▼                                     ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  CONDUCTOR AGENT (conditional — only if 2+ tracks active)     │  ║
║  │                                                                │  ║
║  │  Input: Per-track synthesis outputs                           │  ║
║  │  Output:                                                      │  ║
║  │  ├── Unified treatment sequence (correct clinical order)      │  ║
║  │  ├── Cross-domain interaction warnings                        │  ║
║  │  ├── Conflict detection (one says save, another says extract) │  ║
║  │  └── Overall prognosis grade                                  │  ║
║  │                                                                │  ║
║  │  Rules: endo before crown, perio stabilization before         │  ║
║  │  restoration, emergency first, etc.                           │  ║
║  │  (Claude, ~500 tokens)                                        │  ║
║  └────────────────────────────┬───────────────────────────────────┘  ║
║                                ▼                                     ║
║  OUTPUT PRESENTED TO DENTIST:                                        ║
║  ├── Diagnosis + confidence %                                       ║
║  ├── Treatment plan with evidence                                   ║
║  ├── Gap questions (if info missing)                                ║
║  │    ↓ dentist answers ↓                                           ║
║  │    → incremental re-synthesis (50 tokens, same session)          ║
║  │    → updated diagnosis + confidence                              ║
║  ├── Conductor output (if multi-track)                              ║
║  └── Literature citations                                           ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

## The Synchronized Loop (Data Flow)

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                    THE SYNCHRONIZED LOOP                              │
│                                                                       │
│   ┌─────────────────┐          ┌─────────────────────────────┐       │
│   │  CONSULTATION    │          │  PATIENT PROFILE (PMS)      │       │
│   │  (Data INPUT)    │          │  (Data DISPLAY)             │       │
│   │                  │          │                              │       │
│   │  Voice recording │  ✨───→  │  Provides longitudinal      │       │
│   │  AI diagnosis    │  reads   │  history to AI pipeline      │       │
│   │  Treatment plan  │          │                              │       │
│   │  Prescriptions   │          │  5 Tabs:                    │       │
│   │  Follow-up plan  │  writes  │  ├── Overview (stats)       │       │
│   │                  │  ───→ ✨  │  ├── Dental Chart (FDI)    │       │
│   └────────┬────────┘          │  ├── Journey (episodes)     │       │
│            │                    │  ├── Files (X-rays)         │       │
│            │                    │  └── Rx & Appointments      │       │
│            │                    └─────────────────────────────┘       │
│            │                                                          │
│            ▼                                                          │
│   ┌─────────────────┐                                                │
│   │  SYNC ENGINE     │                                                │
│   │  (Auto-fires on  │                                                │
│   │   consultation   │                                                │
│   │   complete)      │                                                │
│   │                  │                                                │
│   │  Creates:        │                                                │
│   │  ├── tooth_timeline events                                       │
│   │  ├── treatment_episodes (auto)                                   │
│   │  ├── episode_visits (auto)                                       │
│   │  ├── tooth_diagnoses upsert ✨ (FDI chart colors — fixed today) │
│   │  ├── prescription_alarms                                         │
│   │  └── follow-up appointments ✨ (with diagnosis chain)            │
│   └────────┬────────┘                                                │
│            │                                                          │
│            ▼                                                          │
│   ┌──────────────────────────────────────────────┐                   │
│   │  APPOINTMENT (enriched ✨)                    │                   │
│   │                                               │                   │
│   │  linked_diagnosis: "Irreversible pulpitis"   │                   │
│   │  linked_treatment_plan: "RCT Visit 2"        │                   │
│   │  linked_episode_id: uuid                      │                   │
│   │  linked_tooth_numbers: ["46"]                 │                   │
│   │                                               │                   │
│   │  When this appointment opens later:           │                   │
│   │  → V5 reads linked context                    │                   │
│   │  → Auto-detects treatment_visit mode          │                   │
│   │  → Shows "Continuing From Previous Visit"     │                   │
│   │  → Recording starts with full history         │                   │
│   │  → AI pipeline receives all previous context  │                   │
│   │  → LOOP CONTINUES                             │                   │
│   └──────────────────────────────────────────────┘                   │
│                                                                       │
│   ┌──────────────────────────────────────────────┐                   │
│   │  TRACKING PIPELINE (for treatment/follow-up) │                   │
│   │                                               │                   │
│   │  Evaluates progress against original plan    │                   │
│   │  Assesses healing (follow-up mode)           │                   │
│   │  Detects new findings                        │                   │
│   │  Human-in-the-loop confirmation              │                   │
│   │  (Claude)                                    │                   │
│   └──────────────────────────────────────────────┘                   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## AI Model Distribution

```
┌──────────────────────────────────────────────────────────┐
│                    AI MODEL MAP                           │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  CLAUDE (Sonnet 4.6) — "The Thinker"                │ │
│  │                                                       │ │
│  │  Used for: EVERYTHING that requires reasoning         │ │
│  │  ├── Intent classification (Master AI)               │ │
│  │  ├── Medical conversation parsing (voice → tabs)     │ │
│  │  ├── Agent A: Checklist matching                      │ │
│  │  ├── Agent B: Subspecialty classification             │ │
│  │  ├── Agent C: Gap finding + question generation      │ │
│  │  ├── Diagnostic synthesis (2-phase reasoning)        │ │
│  │  ├── Conductor (multi-track orchestration)           │ │
│  │  ├── Treatment tracking (progress assessment)        │ │
│  │  ├── Evidence synthesis (RAG → treatment suggestions)│ │
│  │  ├── Response synthesis (Master AI output formatting)│ │
│  │  └── Self-learning research guides                   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  GEMINI (2.5 Flash) — "The Worker"                   │ │
│  │                                                       │ │
│  │  Used for: Fast, structured extraction tasks          │ │
│  │  ├── Prompt refinement (voice STT cleanup)           │ │
│  │  ├── Appointment NL parsing ("tomorrow 3pm")         │ │
│  │  ├── Task NL parsing ("assign to assistant")         │ │
│  │  ├── Gap answer parsing (voice → structured data)    │ │
│  │  ├── NL filter extraction (research dashboard)       │ │
│  │  ├── Patient cohort analysis                         │ │
│  │  └── Hindi translation                               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  OPENAI (text-embedding-3-large) — "The Indexer"    │ │
│  │                                                       │ │
│  │  Used for: RAG vector embeddings ONLY                │ │
│  │  ├── 3072-dimensional embeddings                     │ │
│  │  ├── Medical knowledge document indexing              │ │
│  │  └── Query embedding for hybrid search               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  BROWSER (SpeechSynthesis) — "The Voice" ✨          │ │
│  │                                                       │ │
│  │  Used for: Text-to-Speech output                     │ │
│  │  ├── Smart voice selection (premium voices)          │ │
│  │  ├── Dental abbreviation expansion                   │ │
│  │  ├── Chunked speaking (no browser cutoff)            │ │
│  │  └── Language-aware (en-US, en-IN, hi-IN)            │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## What's Built vs. What's Remaining for Full MCP

```
STATUS LEGEND: ✅ = Built & Wired  ⚡ = Built, Needs Testing  🔧 = Partial  ❌ = Not Built

═══════════════════════════════════════════════════════════════════
MASTER AI COMMAND LAYER
═══════════════════════════════════════════════════════════════════
✅ Wake word detection ("Hey EndoFlow")
✅ Voice recording via Deepgram Medical STT
✅ Prompt refinement (150+ regex + Gemini)
✅ Intent classification (12 types, Claude LLM)
✅ clinical_research handler
✅ appointment_inquiry handler
✅ appointment_booking handler
✅ treatment_planning handler
✅ patient_inquiry handler
✅ task_management handler
✅ general_question handler
⚡ navigation handler (Phase 2 — code complete, untested in browser)
⚡ consultation_start handler (Phase 2 — looks up patient, detects mode)
⚡ consultation_stop handler (Phase 2 — signals stop recording)
⚡ patient_status handler (Phase 2 — assembles full longitudinal context)
✅ Response synthesis (Claude)
✅ Hindi translation
✅ TTS voice response (Phase 5 — chunked, voice selection, dental abbrev)
✅ Conversation persistence (Supabase)
✅ actionCommand → frontend execution (navigate, start consultation)
❌ accept_diagnosis command (voice: "Accept diagnosis")
❌ generate_report command (voice: "Generate report")
❌ send_to_patient command (voice: "Send report to patient")

═══════════════════════════════════════════════════════════════════
CONSULTATION DIAGNOSTIC PIPELINE
═══════════════════════════════════════════════════════════════════
✅ Voice recording (Deepgram + multi-segment + wake/stop words)
✅ Medical conversation parser (transcript → structured tabs)
✅ Dental voice parser (transcript → FDI tooth findings)
✅ Tab auto-fill (CC, HOPI, Medical Hx, Personal Hx, Clinical Exam)
✅ FDI chart auto-coloring from voice
✅ Patient context assembler (Phase 1 — full longitudinal history)
✅ Agent A: Checklist matcher (11 questionnaire templates)
✅ Agent B: Subspecialty classifier (6 tracks)
✅ Agent C: N-Track gap finder
✅ RAG hybrid search (vector + BM25 + RRF)
✅ Diagnostic synthesis agent (2-phase, persistent sessions)
✅ Conductor agent (multi-track orchestration)
✅ Gap-filling dialog UI
✅ Gap answer parser (voice/text → structured)
✅ Incremental re-synthesis (50 tokens per gap answer)
⚡ Full end-to-end test with real patient data (needs OpenAI credits)
❌ Knowledge base subspecialty tagging
❌ Section-aware document chunking
❌ Investigations/Prescription/Follow-up tabs auto-fill
❌ Pre-compute AI results for all extracted teeth (latency fix)

═══════════════════════════════════════════════════════════════════
LONGITUDINAL TRACKING & SYNC
═══════════════════════════════════════════════════════════════════
✅ Treatment episodes (CRUD + auto-creation)
✅ Episode visits (auto-increment, status transitions)
✅ Tooth timeline (chronological event log)
✅ Consultation sync engine
✅ FDI chart color sync (Gap 1 — fixed this session)
✅ 4 consultation modes (new, treatment, follow-up, emergency)
✅ Mode auto-detection from appointment type
✅ Tracking pipeline AI (progress, healing, new findings)
✅ Human-in-the-loop gate for AI assessments
✅ Patient profile 5-tab layout (Overview, Chart, Journey, Files, Rx&Appt)
✅ Real-time Supabase subscriptions
✅ Appointment ↔ diagnosis chain (Phase 3 — 4 new columns)
✅ Appointment context loading in V5 ("Continuing From Previous Visit")
🔧 Episode → consultation navigation (Gap 4)
🔧 Dental chart tooth click conflict (Gap 2)
🔧 Overview tab active treatments stat (Gap 3)
❌ Old system data migration (Gap 6)
❌ UI save flow end-to-end test (Gap 5)

═══════════════════════════════════════════════════════════════════
OUTPUT & REPORTING
═══════════════════════════════════════════════════════════════════
❌ PDF report generation (Phase 4)
❌ Report: conversation transcript + AI diagnosis + tooth chart
❌ Save PDF to patient profile
❌ Send report to patient via messaging
❌ "Generate report" voice command

═══════════════════════════════════════════════════════════════════
DARK THEME & UI
═══════════════════════════════════════════════════════════════════
✅ Dark theme palette v2 (research-backed)
✅ 5-mode dashboard architecture
✅ Theme toggle (Sun/Moon)
✅ 6 components fixed (150+ replacements)
❌ 12 components still have hardcoded light colors
❌ Patient & assistant dashboards need dark theme
❌ Record button repositioning (prominent, sticky)
❌ FDI chart "This Visit" / "All History" toggle
```

## Effort Estimate for Full MCP Completion

```
┌─────────────────────────────────────────────────────────────┐
│  TASK                                    │ EST. TIME        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HIGH PRIORITY (Core MCP Loop)                              │
│  ─────────────────────────────────────────────────────────  │
│  Run SQL migration 004 in Supabase       │  5 min           │
│  End-to-end pipeline test (needs credits)│  2-3 hours       │
│  Browser test Phase 2 commands           │  1-2 hours       │
│  Fix Gaps 2-5 (chart, overview, nav)     │  2-3 hours       │
│  PDF report generation (Phase 4)         │  4-6 hours       │
│  "Accept diagnosis" voice command        │  1-2 hours       │
│  "Generate report" voice command         │  1 hour          │
│                                          │                  │
│  SUBTOTAL                                │  ~12-18 hours    │
│                                                             │
│  MEDIUM PRIORITY (Quality & Polish)                         │
│  ─────────────────────────────────────────────────────────  │
│  Dark theme: 12 remaining components     │  2-3 hours       │
│  Knowledge base chunking + subspecialty  │  4-6 hours       │
│  Pre-compute AI results (latency fix)    │  2-3 hours       │
│  Record button repositioning             │  1 hour          │
│  FDI chart This Visit/All History toggle │  2-3 hours       │
│  Old data migration script               │  2-3 hours       │
│                                          │                  │
│  SUBTOTAL                                │  ~13-19 hours    │
│                                                             │
│  LOWER PRIORITY (Enhancement)                               │
│  ─────────────────────────────────────────────────────────  │
│  Auto-fill remaining 5 tabs from voice   │  4-6 hours       │
│  Deepgram TTS upgrade (from browser TTS) │  3-4 hours       │
│  Patient/Assistant dashboard dark theme  │  3-4 hours       │
│  Send report to patient messaging        │  2-3 hours       │
│                                          │                  │
│  SUBTOTAL                                │  ~12-17 hours    │
│                                                             │
│  ═══════════════════════════════════════════════════════    │
│  TOTAL TO FULL MCP                       │  ~37-54 hours    │
│  (across ~5-7 sessions)                                     │
│  ═══════════════════════════════════════════════════════    │
│                                                             │
│  CURRENT COMPLETION                      │  ~65-70%         │
│  The core pipeline, agents, sync engine, │                  │
│  voice control, and tracking are built.  │                  │
│  What remains is mostly integration      │                  │
│  testing, PDF output, and UI polish.     │                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
