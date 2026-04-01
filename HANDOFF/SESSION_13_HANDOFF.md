# Session 13 Handoff — Voice Recovery + Agentic Pipeline Vision

**Date:** 2026-03-31
**Previous:** Session 12 (AI-Native Sidebar + Gap Optimization + Image Upload)

---

## Part 1: What Was Fixed This Session

### Problem: Session 12 broke desktop voice completely
The floating `EndoFlowVoiceController` (800+ lines, battle-tested) was removed from desktop render and replaced with a text-only sidebar chat panel. All voice features were lost.

### Fixes Applied

| Fix | File(s) | What |
|-----|---------|------|
| **Restore floating voice controller** | `app/dentist/page.tsx` | Re-mounted `EndoFlowVoiceController` on desktop with `isFloating={true}` |
| **Revert sidebar to text-only** | `components/dentist/sidebar-chat-panel.tsx` | Stripped all Deepgram/STT/TTS code, back to clean Session 12 text chat |
| **Remove duplicate wake word** | `app/dentist/page.tsx` | Removed `useUnifiedWakeWord` + `useVoiceManager` that conflicted with controller's own wake word |
| **Deepgram auth fix** | `app/api/deepgram/token/route.ts` | Changed from manual cookie-based client to proper SSR `createClient()` from `@/lib/supabase/server` |
| **Echo prevention** | `components/dentist/endoflow-voice-controller.tsx` | Added `isSpeakingRef` guard in main STT `onresult` — ignores ALL mic input while TTS is playing |
| **Wake word infinite loop** | `lib/hooks/use-unified-wake-word.ts` | Added `micDeniedRef` — stops retrying after mic permission denied |
| **Deepgram Aura TTS** | `app/api/deepgram/tts/route.ts` (NEW), `lib/services/tts-service.ts` | New endpoint for Deepgram Aura REST TTS. Service tries Aura first, falls back to browser SpeechSynthesis. Single cached voice profile. |
| **Intent consolidation** | `lib/services/endoflow-master-ai.ts` | Reduced from 18 → 12 core intents with clearer boundaries. Legacy aliases for backward compat. |
| **Prompt refiner fix** | `lib/services/prompt-refinement-agent.ts` | Robust JSON extraction (handles Gemini's "Here is the..." prefix). Rules to preserve patient names and navigation words. Local deduplication of repeated phrases. |
| **Patient auto-search** | `components/shared/PatientSearch.tsx` | Added `initialPatientId` prop for voice-triggered auto-selection. |
| **TTS voice consistency** | `lib/services/tts-service.ts` | Cached `selectBestVoice()` so all agents use the same voice. |

### Current 12 Intents

```
1. navigation         6. appointment_view    11. tooth_command
2. consultation_start  7. appointment_book    12. general_question
3. consultation_stop   8. clinical_question
4. recording_control   9. task_command
5. patient_lookup     10. report_command
```

---

## Part 2: The Agentic Pipeline Vision

### Decision: Sidebar-First, Not Floating Icon

Going forward, ALL AI interactions should be through the **left sidebar** — not the floating EndoFlow icon. The sidebar becomes the AI command center. The floating controller is restored temporarily to keep voice working, but the next session should migrate its voice capabilities INTO the sidebar architecture.

### Complete Flowchart: EndoFlow Agentic Voice Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    DENTIST SPEAKS                             │
│              "Hey EndoFlow, [command]"                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              WAKE WORD DETECTION                             │
│         Browser SpeechRecognition (free, low-power)          │
│         Patterns: "hey endoflow", "endoflow", etc.           │
│                                                              │
│   On detection:                                              │
│   1. TTS: "Yes Dr. Nisarg, how can I help?"                 │
│   2. Expand sidebar AI panel                                 │
│   3. Activate Deepgram STT mic                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              DEEPGRAM STT (nova-2-medical)                   │
│                                                              │
│   - Streaming WebSocket, real-time transcription             │
│   - Medical vocabulary boosting (dental terms)               │
│   - REDUCED keyword boosting (stop converting names)         │
│   - Patient name dictionary added to keywords                │
│   - Interim + final results shown in sidebar                 │
│   - Auto-stop on 2s silence                                  │
│                                                              │
│   ECHO PREVENTION:                                           │
│   - isSpeakingRef guard: ignore ALL input during TTS         │
│   - endoflow:tts_start/end events for component sync         │
│                                                              │
│   OUTPUT: Raw transcript text                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            PROMPT ANALYZER (Light Touch)                      │
│                                                              │
│   Step 1: LOCAL DEDUPLICATION (0ms)                          │
│   - "Start recording Start recording" → "Start recording"   │
│   - removeDuplicatePhrases() — sentence + word level         │
│                                                              │
│   Step 2: LOCAL DENTAL CORRECTIONS (0ms)                     │
│   - "carries" → "caries", "pull py this" → "pulpitis"       │
│   - DOES NOT touch: names, navigation words, commands        │
│                                                              │
│   Step 3: LLM REFINEMENT (Gemini Flash, ~200-400ms)          │
│   - Fixes complex garbles the regex can't catch              │
│   - Classifies query type (clinical/scheduling/task/general) │
│   - PRESERVES: patient names, command words, FDI numbers     │
│   - JSON extraction with regex fallback                      │
│                                                              │
│   OUTPUT: Clean, deduplicated query + type hint              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            AGENT SELECTOR (Conductor)                         │
│            LLM-based intent classification                   │
│                                                              │
│   INPUT: Refined query + conversation history                │
│   MODEL: Gemini Flash (fast, ~200ms) or Claude (complex)     │
│                                                              │
│   CLASSIFIES into 1 of 12 intents                            │
│   DETERMINES: single-step vs multi-step task                 │
│   EXTRACTS: entities (patient name, tooth #, date, etc.)     │
│                                                              │
│   If multi-step detected:                                    │
│   → TTS: "Hold on, let me handle that for you"              │
│   → Route to MCP Orchestrator Agent                          │
│                                                              │
│   If single-step:                                            │
│   → Route directly to specialized agent                      │
└──────────┬──────────────────────────────┬───────────────────┘
           │                              │
     SINGLE-STEP                    MULTI-STEP
           │                              │
           ▼                              ▼
┌─────────────────────┐  ┌───────────────────────────────────┐
│  SPECIALIZED AGENTS  │  │     MCP ORCHESTRATOR AGENT        │
│  (direct execution)  │  │     (the brain / conductor)       │
│                      │  │                                    │
│  Each handles ONE    │  │  Decomposes complex commands into  │
│  type of request:    │  │  sequential steps:                 │
│                      │  │                                    │
│  ┌────────────────┐  │  │  "Start consultation with         │
│  │ Appointment    │  │  │   Popatlal Pandey"                │
│  │ View Agent     │  │  │        │                           │
│  │ - List today's │  │  │        ▼                           │
│  │ - Check avail  │  │  │  Step 1: Search patient DB         │
│  └────────────────┘  │  │  Step 2: Navigate to clinical      │
│                      │  │  Step 3: Auto-select patient        │
│  ┌────────────────┐  │  │  Step 4: Start recording            │
│  │ Appointment    │  │  │  Step 5: Confirm to dentist         │
│  │ Book Agent     │  │  │                                    │
│  │ - Schedule new │  │  │  Each step:                         │
│  │ - Parse date   │  │  │  - Executes via CustomEvent/action │
│  └────────────────┘  │  │  - Verifies success                 │
│                      │  │  - Reports status via TTS            │
│  ┌────────────────┐  │  │  - Moves to next step               │
│  │ Task Command   │  │  │                                    │
│  │ Agent          │  │  │  SUB-AGENTS it can call:            │
│  │ - Create task  │  │  │  ├─ Consultation Agent              │
│  │ - Assign       │  │  │  ├─ PMS Agent                       │
│  │ - List tasks   │  │  │  ├─ Appointment Agent               │
│  └────────────────┘  │  │  ├─ Task Agent                      │
│                      │  │  └─ Report Agent                     │
│  ┌────────────────┐  │  └───────────────────────────────────┘
│  │ Report Agent   │  │
│  │ - Generate PDF │  │
│  │ - Save to file │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │ Navigation     │  │
│  │ Agent          │  │
│  │ - Switch modes │  │
│  │ - Open tabs    │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │ Recording      │  │
│  │ Control Agent  │  │
│  │ - Pause/Resume │  │
│  │ - Read back    │  │
│  │ - Process      │  │
│  └────────────────┘  │
└─────────┬────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              KNOWLEDGE AGENTS (Research Layer)                │
│              Called by other agents when needed               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  MEDICAL LITERATURE AGENT                             │    │
│  │  - RAG hybrid search (Vector + BM25 + RRF)           │    │
│  │  - Evidence-based answers from uploaded PDFs           │    │
│  │  - NO patient context — pure textbook knowledge       │    │
│  │  - "How to treat lateral extrusion?"                  │    │
│  │  - Uses existing rag-service.ts                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  STATUS AGENT                                         │    │
│  │  - Combines: PMS + Consultation + Appointment data    │    │
│  │  - Uses: assemblePatientContext() (already built)     │    │
│  │  - Narrates full patient journey as a story           │    │
│  │  - "Popatlal came in March 15 with pain on 46..."    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  TREATMENT PLAN AGENT                                 │    │
│  │  - Combines: Literature Agent + Status Agent          │    │
│  │  - Runs gap analysis if info missing                  │    │
│  │  - Uses existing N-track diagnosis pipeline           │    │
│  │  - "What should be the plan for Popatlal's 46?"      │    │
│  │  - Considers: patient history + evidence + outcomes   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  CONSULTATION AI AGENT                                │    │
│  │  - The existing N-track diagnostic pipeline           │    │
│  │  - Checklist → Classifier → Gap Finder → Synthesis    │    │
│  │  - Called by MCP Agent during active consultations     │    │
│  │  - Co-diagnosis copilot for real-time clinical work   │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              RESPONSE SYNTHESIS                              │
│                                                              │
│   - Combines results from all agents                         │
│   - Formats for natural spoken delivery                      │
│   - Multilingual support (English, Hindi)                    │
│   - Concise for voice, detailed for sidebar display          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              TTS OUTPUT (Deepgram Aura)                       │
│                                                              │
│   - Single consistent voice profile (aura-asteria-en)        │
│   - Sub-200ms time-to-first-byte                             │
│   - Dental abbreviation expansion before speaking            │
│   - Falls back to browser SpeechSynthesis if needed          │
│   - Dispatches tts_start/tts_end events for echo prevention  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              SIDEBAR UI (Visual Feedback)                     │
│                                                              │
│   ┌─────────────────────────────────────────────────┐        │
│   │  SIDEBAR AI PANEL (replaces floating icon)       │        │
│   │                                                  │        │
│   │  ┌──────────────────────────────────────────┐   │        │
│   │  │ Status Bar: 🟢 Listening / 🔴 Processing │   │        │
│   │  └──────────────────────────────────────────┘   │        │
│   │                                                  │        │
│   │  ┌──────────────────────────────────────────┐   │        │
│   │  │ Live Transcript (what you're saying)      │   │        │
│   │  │ "Start consultation with Popatlal..."     │   │        │
│   │  └──────────────────────────────────────────┘   │        │
│   │                                                  │        │
│   │  ┌──────────────────────────────────────────┐   │        │
│   │  │ Agent Activity                            │   │        │
│   │  │ 🔍 Searching patient database...          │   │        │
│   │  │ ✅ Found: Popatlal Pandey                 │   │        │
│   │  │ 📋 Opening clinical mode...               │   │        │
│   │  │ ✅ Patient selected                       │   │        │
│   │  │ 🎙️ Recording started                     │   │        │
│   │  └──────────────────────────────────────────┘   │        │
│   │                                                  │        │
│   │  ┌──────────────────────────────────────────┐   │        │
│   │  │ Chat History (scrollable)                 │   │        │
│   │  │ You: Start consultation with Popatlal     │   │        │
│   │  │ AI: Found Popatlal Pandey. Opening...     │   │        │
│   │  └──────────────────────────────────────────┘   │        │
│   │                                                  │        │
│   │  ┌──────────────────────────────────────────┐   │        │
│   │  │ [🎤 Mic] [Type here...        ] [Send ➤] │   │        │
│   │  └──────────────────────────────────────────┘   │        │
│   └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Agent Interaction Map

```
                         ┌─────────────┐
                         │   DENTIST    │
                         │   (Voice)    │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │   AGENT     │
                         │  SELECTOR   │
                         └──────┬──────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
     ┌────────▼────────┐ ┌─────▼──────┐ ┌────────▼────────┐
     │  SIMPLE AGENTS   │ │    MCP     │ │ KNOWLEDGE AGENTS │
     │                  │ │ ORCHESTR.  │ │                  │
     │  - Appointment   │ │            │ │  - Medical Lit   │
     │  - Task          │ │  Controls: │ │  - Status        │
     │  - Navigation    │ │  - Search  │ │  - Treatment Plan│
     │  - Recording     │ │  - Navigate│ │  - Consultation  │
     │  - Report        │ │  - Select  │ │    AI Pipeline   │
     └─────────────────┘ │  - Record  │ └────────┬─────────┘
                          │  - Chart   │          │
                          │            │          │
                          │  Calls ────┼──────────┘
                          │  Knowledge │
                          │  Agents    │
                          │  when      │
                          │  needed    │
                          └────────────┘

COMMUNICATION PATTERN:
- Agent Selector → Agents: Direct function call with context
- MCP Orchestrator → Sub-agents: Sequential step execution
- Knowledge Agents → Database: assemblePatientContext(), RAG search
- All Agents → UI: CustomEvent dispatch (endoflow:* events)
- All Agents → TTS: speakWithTTS() for voice responses
```

### What Exists vs What Needs Building

```
EXISTING (built across Sessions 4-12):
✅ Wake word detection (use-unified-wake-word.ts)
✅ Deepgram STT service (deepgram-stt.ts)
✅ Prompt refinement agent (prompt-refinement-agent.ts)
✅ Intent classification (endoflow-master-ai.ts — classifyIntent)
✅ Response synthesis (endoflow-master-ai.ts — synthesizeResponse)
✅ TTS service (tts-service.ts — browser + Deepgram Aura)
✅ Appointment view/book delegates
✅ Task management delegate
✅ Navigation delegate
✅ Patient lookup/status delegate
✅ Report generation (PDF)
✅ N-track consultation AI pipeline (9 agents)
✅ Patient context assembler (5-table parallel fetch)
✅ RAG hybrid search
✅ Gap-filling optimization (batch mode)
✅ Consultation sync engine
✅ Longitudinal tracking (episodes, timeline)
✅ Session memory (master-ai-session.ts)

NEEDS BUILDING:
❌ MCP Orchestrator Agent (multi-step task decomposition)
❌ Treatment Plan Agent (combines Literature + Status + Gap)
❌ Status Agent enhancement (narrative patient journey)
❌ Medical Literature Agent as standalone callable service
❌ Sidebar voice integration (move floating controller into sidebar)
❌ Streaming agent status (SSE for "Searching patient..." updates)
❌ Wake word greeting response ("Yes doctor, how can I help?")
❌ Agent activity panel in sidebar UI
❌ Deepgram keyword dictionary for patient names
❌ Vercel AI SDK integration for streaming
```

---

## Part 3: Optimized Implementation Roadmap

Based on research into LangGraph, OpenAI Agents SDK, Suki AI, Oracle Health, and VISA architectures:

### Session 14: Sidebar Voice Migration + STT Fix (6-8 hours)
1. Move voice capabilities from floating controller INTO the sidebar
2. Add wake word greeting ("Yes Dr. Nisarg, how can I help?")
3. Fix Deepgram keyword boosting (reduce dental term aggression, add patient names)
4. Add live transcript display in sidebar
5. Add agent activity panel in sidebar

### Session 15: MCP Orchestrator Agent (8-10 hours)
1. Build `lib/agents/mcp-orchestrator-agent.ts`
2. Implement step decomposition (single vs composite command detection)
3. Sequential step execution with verification
4. Status streaming via TTS ("Found patient... Opening consultation...")
5. Error recovery (retry, fallback, report failure)

### Session 16: Knowledge Agent Layer (6-8 hours)
1. Standalone Medical Literature Agent (callable from other agents)
2. Enhanced Status Agent (narrative patient journey)
3. Treatment Plan Agent (combines Literature + Status + Gap)
4. Integration with existing N-track pipeline

### Session 17: Streaming + Polish (4-6 hours)
1. Vercel AI SDK integration for SSE streaming
2. Agent activity panel shows real-time step progress
3. Voice command help ("What can I say?")
4. End-to-end testing of full pipeline

---

## Files Modified This Session

| File | Change |
|------|--------|
| `app/dentist/page.tsx` | Restored floating voice controller on desktop, removed duplicate wake word hook, kept all Session 13 handleActionCommand cases |
| `components/dentist/sidebar-chat-panel.tsx` | Reverted to clean text-only Session 12 version |
| `components/dentist/endoflow-voice-controller.tsx` | Added `isSpeakingRef` for echo prevention in main STT |
| `lib/hooks/use-unified-wake-word.ts` | `micDeniedRef` to prevent infinite retry loop |
| `app/api/deepgram/token/route.ts` | Fixed auth to use proper SSR Supabase client |
| `app/api/deepgram/tts/route.ts` | NEW — Deepgram Aura TTS endpoint |
| `lib/services/tts-service.ts` | Deepgram Aura primary + browser fallback, cached voice, tts_start/end events |
| `lib/services/endoflow-master-ai.ts` | Consolidated 18→12 intents, legacy aliases, cleaner classifier prompt |
| `lib/services/prompt-refinement-agent.ts` | Robust JSON extraction, name preservation rules, local deduplication |
| `lib/actions/endoflow-master.ts` | Extended ActionCommand interface with new fields |
| `components/shared/PatientSearch.tsx` | `initialPatientId` prop for voice auto-selection |
| `components/consultation/GlobalVoiceRecorder.tsx` | Pause/resume/process/read-back event listeners, Process+Discard buttons |
| `components/dentist/interactive-dental-chart.tsx` | Voice tooth selection event listener |
| `components/dentist/tooth-diagnosis-dialog-v2.tsx` | Accept/reject/close event listeners |
| `components/dentist/diagnostic-gap-dialog.tsx` | Auto-voice TTS + mic, external event listeners |
| `components/dentist/app-sidebar.tsx` | Dual-function recording button |

## Overall Completion: ~85-88%

Architecture vision is clear. Core agents and pipeline exist. Main gaps: MCP orchestrator for multi-step commands, sidebar voice migration, and STT quality for Indian names.

---

## Quick Start for Next Session

```bash
cd C:\Users\Nisarg\Desktop\Endoflow-publish
pnpm dev
# Login: dr.nisarg@endoflow.com / endoflow123
# Floating EndoFlow button at bottom-right — click to expand
# Say "Hey EndoFlow" for wake word activation
# Sidebar (left) has text chat for typing commands
```

### Key Architecture Files
- **Voice Controller:** `components/dentist/endoflow-voice-controller.tsx` (to be migrated to sidebar)
- **Master AI:** `lib/services/endoflow-master-ai.ts` (conductor/router)
- **Prompt Refiner:** `lib/services/prompt-refinement-agent.ts`
- **TTS:** `lib/services/tts-service.ts` (Deepgram Aura + browser fallback)
- **Patient Context:** `lib/services/patient-context-assembler.ts`
- **Session Memory:** `lib/services/master-ai-session.ts`
- **N-Track Pipeline:** `lib/agents/consultation-ai-orchestrator.ts`
- **Sidebar:** `components/dentist/app-sidebar.tsx` + `sidebar-chat-panel.tsx`
