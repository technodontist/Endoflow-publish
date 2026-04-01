# Session 5 Handoff - 2026-03-28

## What Was Done This Session

### 1. Voice Conversation Context → AI Diagnosis & Treatment (COMPLETED)

Connected the full voice consultation context to the AI Diagnosis and Treatment copilots. Previously, the AI only saw per-tooth symptoms in isolation. Now it receives the complete clinical picture.

**Files Modified:**
1. `lib/services/medical-conversation-parser.ts` — Added `ConversationContext` type
2. `lib/services/gemini-ai.ts` — Enhanced `generateDiagnosisSuggestion()` and `generateTreatmentSuggestion()` prompts with conversation context sections
3. `lib/actions/ai-diagnosis-suggestions.ts` — Enriched RAG query with chief complaint + medical conditions, updated cache key
4. `lib/actions/ai-treatment-suggestions.ts` — Enriched RAG query with comorbidities + allergies
5. `components/dentist/diagnosis-ai-copilot.tsx` — Added `conversationContext` prop passthrough
6. `components/dentist/endo-ai-copilot-live.tsx` — Added `conversationContext` prop passthrough
7. `components/dentist/tooth-diagnosis-dialog-v2.tsx` — Forwarding context to both copilots, fixed hardcoded `age: 35`
8. `components/dentist/enhanced-new-consultation-v3.tsx` — Stores voice context in state, passes to dialog with patient age

**Data Flow After This Change:**
```
Voice → Parsed → voiceConversationContext state
                      ↓
         Click tooth on FDI chart
                      ↓
         ToothDiagnosisDialogV2 receives context + patientAge
                      ↓
         DiagnosisAICopilot & EndoAICopilotLive get full context
                      ↓
         Server actions enrich RAG query with chief complaint,
         medical conditions, allergies
                      ↓
         Claude receives: conversation context + per-tooth data + RAG literature
                      ↓
         Returns diagnosis/treatment with full clinical reasoning
```

**Key Architecture Note:** Claude (via `complexChatCompletion()`) is already the primary AI engine. Gemini is fallback only. Embeddings still use Gemini's embedding model.

---

### 2. Hybrid RAG Search — BM25 + Vector with RRF (COMPLETED + TESTED)

Upgraded the RAG pipeline from pure vector search to hybrid search combining vector similarity (pgvector) with PostgreSQL full-text search (tsvector/tsquery), fused via Reciprocal Rank Fusion (RRF).

**Files Created:**
1. `lib/db/migrations/add_hybrid_search.sql` — Initial migration (tsvector column, trigger, GIN index, RPC function)
2. `lib/db/migrations/fix_hybrid_search_function.sql` — Fixed return type mismatch (FLOAT → DOUBLE PRECISION, disambiguated CTE column names)
3. `app/api/test-hybrid-search/route.ts` — Test endpoint (can be deleted later)

**Files Modified:**
4. `lib/services/rag-service.ts` — Added `searchMode`, `vectorWeight`, `fulltextWeight` params to `RAGQueryParams`. `performRAGQuery()` now tries hybrid first, falls back to vector-only.
5. `lib/actions/ai-diagnosis-suggestions.ts` — Uses hybrid search with 50/50 vector/fulltext weighting. Falls back to vector → text query → no-RAG mode.
6. `lib/actions/ai-treatment-suggestions.ts` — Uses hybrid search with 55/45 vector/fulltext weighting. Falls back gracefully.

**SQL Migrations Run in Supabase:**
- `add_hybrid_search.sql` — RUN and VERIFIED
- `fix_hybrid_search_function.sql` — RUN and VERIFIED

**Test Results (verified live):**
```
Hybrid search: 5 results, all with vector_similarity + fulltext_rank + hybrid_score
Vector-only:   5 results, similarity scores only

Key result: Wolters 2017 "diagnostic system for pulpitis" promoted from rank 5 (vector)
to rank 3 (hybrid) because of strong keyword match for "pulpitis" + "diagnostic system"
```

**Terminal Logs Confirmed Working:**
```
✅ [AI DIAGNOSIS] Hybrid search found 10 results
🧠 [DIAGNOSIS] Routing to Claude for complex reasoning...
✅ [CLAUDE] Request successful on attempt 1 (tokens: 5890+1172)
✅ [AI DIAGNOSIS] Diagnosis: "Reversible Pulpitis with Deep Caries" — 72-78% confidence

✅ [AI TREATMENT] Hybrid search found 5 results
🧠 [TREATMENT] Routing to Claude for complex reasoning...
✅ [CLAUDE] Request successful on attempt 1 (tokens: 5109+3179)
✅ [AI TREATMENT] Treatment: "Full Pulpotomy with MTA/CEM Cement" — 82% confidence
```

---

### 3. Global Voice Recorder Upgrade — Deepgram + Multi-Segment + Wake/Stop Words (COMPLETED, NEEDS TESTING)

The Global Voice Recorder previously used browser Web Speech API which has a hard ~60-90 second limit enforced by Chrome. Upgraded to use Deepgram as primary STT with multiple improvements.

**File Rewritten:**
- `components/consultation/GlobalVoiceRecorder.tsx` — Full rewrite (~600 lines)

**Changes Made:**

#### 3a. Switched from Web Speech API to Deepgram (Primary STT)
- Uses `DeepgramSTTService` with `nova-2-medical` model and dental vocabulary boosting
- Falls back to browser Web Speech API if Deepgram is unavailable (no API key, connection failure)
- UI badge shows which STT engine is active ("Deepgram Medical" or "Browser STT")

#### 3b. Increased Silence Tolerance: 1.5s → 10s
- `utteranceEndMs: 10000` — dentist can pause for 10 seconds during examination without killing the recording
- Removed auto-submit on silence — recording continues until explicit stop
- Natural conversation pauses (patient thinking, dentist examining) no longer end the session

#### 3c. Multi-Segment Accumulation (No More Overwrite)
- Added `accumulatedTranscriptsRef` array that stores segments across browser STT restarts or Deepgram utterance ends
- When Deepgram fires utterance end (after 10s silence), current transcript saved as segment, recording continues
- When browser STT auto-restarts (Chrome ~60s limit), segment saved, new session starts seamlessly
- If Deepgram WebSocket drops mid-recording, it saves current segment and auto-reconnects after 1 second
- All segments merged on "Stop & Process" — nothing is lost
- Segment count shown in UI badge

#### 3d. Wake Word: "Start consultation" / "Start recording"
- New "Hands-Free" button enables wake word listening via Web Speech API (always English)
- Detected phrases: "start consultation", "start recording", "begin consultation", "begin recording"
- Once detected, recording starts automatically — no need to touch the screen
- Wake word listener auto-restarts if it times out (keeps listening until triggered)

#### 3e. Stop Word: "Stop recording" / "Done recording"
- During recording, Deepgram monitors transcript for stop commands
- Detected phrases: "stop recording", "done recording", "end recording", "stop consultation", "end consultation", "finish recording", "that's all"
- Stop phrase is cleaned from the transcript before processing
- Recording stops and merged transcript is sent to AI pipeline automatically

#### 3f. Auto-Reconnect
- If Deepgram WebSocket drops mid-recording (network blip, server timeout), saves current segment and reconnects after 1 second
- No transcript lost — seamless multi-segment recording

**Build Status:** Compiles cleanly, no TypeScript errors.
**Testing Status:** NOT YET TESTED IN BROWSER (login credentials for dr.nisarg@endoflow.com have changed from what's in CLAUDE.md — `endoflow123` no longer works).

---

## Full Architecture: Enhanced Consultation Voice Pipeline (RESEARCH COMPLETED)

### Complete Data Flow: Recording → Every Tab

```
User presses "Stop & Process" (or says "Stop recording")
    ↓
GlobalVoiceRecorder merges all accumulated segments into one transcript
    ↓
POST /api/voice/process-global-transcript
    ├── FormData: { audio blob, merged transcript, consultationId, language }
    ↓
API Route (app/api/voice/process-global-transcript/route.ts):
    ├── Step 0: refineVoiceQuery() — cleans raw transcript
    ├── Step 1: processTranscriptWithAI() — ONE Gemini/Claude AI call
    │   └── analyzeMedicalConversation() from medical-conversation-parser.ts
    │       Returns: VoiceTranscriptAnalysis {
    │           chiefComplaint, hopi, medicalHistory, personalHistory,
    │           clinicalExamination, confidence (0-100)
    │       }
    ├── Step 2: extractToothDiagnosesFromTranscript() — REGEX-BASED extraction
    │   └── Scans transcript for "tooth 44", "tooth #14", etc.
    │       For each tooth found: extracts 100-char context, maps symptoms,
    │       determines status, assigns diagnosis and treatment
    │       Returns: ToothDiagnosisData[]
    ├── Step 3: Save to database (consultations table)
    └── Return: { processedContent, toothDiagnoses }
    ↓
Frontend receives both objects simultaneously
    ↓
┌─── BRANCH 1: onContentProcessed(processedContent) ───────────────────┐
│                                                                        │
│   distributeContentToTabs(processedContent)                           │
│   [CONFIDENCE CHECK: only auto-fills if confidence >= 60%]            │
│                                                                        │
│   ✅ Chief Complaint tab — primary_complaint, pain_scale,              │
│      location, associated_symptoms mapped to checkboxes               │
│   ✅ HOPI tab — pain quality, duration, intensity, onset details,     │
│      aggravating factors, relieving factors mapped to checkboxes      │
│   ✅ Medical History tab — conditions, medications, allergies,        │
│      dental history mapped to checkboxes                              │
│   ✅ Personal History tab — smoking, alcohol, tobacco, diet,          │
│      oral hygiene mapped to checkboxes                                │
│   ✅ Clinical Examination tab — extraoral findings, intraoral         │
│      findings, gingival condition, occlusion mapped to checkboxes     │
│   ❌ Investigations tab — NOT auto-filled                             │
│   ❌ Diagnosis tab (main) — NOT auto-filled                           │
│   ❌ Treatment Plan tab (main) — NOT auto-filled                      │
│   ❌ Prescription tab — NOT auto-filled                               │
│   ❌ Follow-up tab — NOT auto-filled                                  │
│                                                                        │
│   ALSO: setVoiceConversationContext({                                  │
│     chiefComplaint, hopi, medicalHistory, clinicalExamination          │
│   })                                                                   │
│   → This context is passed to ToothDiagnosisDialogV2                  │
│   → Which forwards it to DiagnosisAICopilot & EndoAICopilotLive       │
│   → So AI Copilots have the FULL patient picture from voice           │
└────────────────────────────────────────────────────────────────────────┘

┌─── BRANCH 2: onToothDiagnosesExtracted(toothDiagnoses) ──────────────┐
│                                                                        │
│   For each tooth in toothDiagnoses:                                    │
│   1. Track as voice-extracted (voiceExtractedTeethRef)                 │
│   2. Store in pendingVoiceToothDiagnoses (for DB save later)           │
│   3. Update toothData state IMMEDIATELY:                               │
│      toothData[toothNumber] = {                                        │
│        status → FDI chart color (caries=red, attention=orange, etc.)   │
│        primaryDiagnosis → pre-selects diagnosis checkboxes in dialog   │
│        recommendedTreatment → pre-selects treatment checkboxes         │
│        symptoms → feeds DiagnosisAICopilot auto-trigger               │
│        painCharacteristics → feeds AI copilot for context             │
│        clinicalFindings → feeds AI copilot                            │
│        isVoiceExtracted: true → flag for dialog to know               │
│      }                                                                 │
│   4. Force FDI chart re-render (setToothDataVersion++)                 │
│                                                                        │
│   ✅ FDI chart teeth auto-colored immediately                          │
│   ✅ Teeth show status icons on chart                                  │
│                                                                        │
│   WHEN USER CLICKS A TOOTH ON FDI CHART:                              │
│   → ToothDiagnosisDialogV2 opens with existingData from toothData     │
│   → Voice-extracted data auto-populates:                               │
│     ✅ Diagnosis checkboxes (selectedDiagnoses) — AUTO-CHECKED         │
│     ✅ Treatment checkboxes (selectedTreatments) — AUTO-CHECKED        │
│     ✅ Status dropdown (healthy/caries/attention/etc.)                 │
│     ✅ Priority level                                                  │
│     ✅ Quick symptom entries (from symptoms array)                     │
│   → DiagnosisAICopilot auto-fires (useEffect on symptoms change)      │
│   → EndoAICopilotLive auto-fires (useEffect on diagnosis change)      │
│   → Both receive voiceConversationContext for full patient context     │
│   → Both use hybrid RAG (vector + BM25) to search literature          │
│   → Claude generates diagnosis/treatment with evidence citations       │
└────────────────────────────────────────────────────────────────────────┘
```

### AI Agents Summary

| Agent | When It Fires | What It Receives | What It Returns |
|-------|--------------|-----------------|-----------------|
| **Gemini/Claude (transcript parsing)** | On "Stop & Process" | Raw merged transcript + language | Structured VoiceTranscriptAnalysis for all tabs |
| **Regex tooth extractor** | On "Stop & Process" (after parsing) | Refined transcript + processedContent | ToothDiagnosisData[] for FDI chart |
| **Claude DiagnosisAICopilot** | Auto on tooth click (symptoms change) | symptoms[], painCharacteristics, clinicalFindings, conversationContext + hybrid RAG literature | Diagnosis + confidence + reasoning + differential diagnoses + recommended tests |
| **Claude EndoAICopilotLive** | Auto on tooth click (diagnosis change) | diagnosis, toothNumber, patientContext, conversationContext + hybrid RAG literature | Treatment + confidence + reasoning + alternatives + contraindications |

**Total AI calls per consultation:**
- 1 call on "Stop & Process" (transcript → structured data)
- 2 calls per tooth clicked (diagnosis + treatment) — these run ONLY when user clicks a tooth

---

## Critical Gaps Identified (For Next Session)

### Gap 1: Quick Symptom Extraction is Context-Blind

**Current:** `extractToothDiagnosesFromTranscript()` uses regex to find tooth numbers, then extracts symptoms from only ~100 characters around the tooth mention.

**Problem:** In real consultations, the dentist asks about a tooth number and the patient describes symptoms a minute later. The 100-char window misses symptoms that aren't spoken immediately next to the tooth number.

**Example:**
```
Doctor: "Which tooth is bothering you?"
Patient: "The last tooth on the bottom left side"
[... 60 seconds of other questions ...]
Doctor: "Does it hurt when you drink cold water?"
Patient: "Yes, a sharp shooting pain"
```
The sharp pain + cold sensitivity is in the HOPI tab (from the AI parsing) but NOT linked to the tooth because the regex only looked at 100 chars around "last tooth on bottom left."

**Fix needed:** After AI parsing, cross-reference the HOPI data (pain characteristics, triggers, symptoms) with any extracted tooth numbers. The AI-parsed `chiefComplaint.primary_complaint` + `hopi.pain_characteristics` should be assigned to the relevant tooth, not just regex-adjacent text.

### Gap 2: AI Copilots Only Run On Tooth Click (Latency)

**Current:** `DiagnosisAICopilot` and `EndoAICopilotLive` fire their `useEffect` only when the tooth dialog opens and symptoms/diagnosis state changes. Each call takes 20-65 seconds (embedding + hybrid search + Claude).

**Problem:** When the dentist clicks a tooth, they wait 20-65 seconds for AI diagnosis + treatment. This is unacceptable clinical latency.

**Fix needed:** After "Stop & Process" returns tooth diagnoses, pre-fire the AI copilot calls in the background for every extracted tooth. Store results in a cache map `precomputedAIResults[toothNumber]`. When user clicks the tooth, results are already ready — instant display. If the user changes symptoms manually, re-fire as today.

**Implementation sketch:**
```typescript
// After onToothDiagnosesExtracted fires:
toothDiagnoses.forEach(async (diag) => {
  const [diagResult, treatResult] = await Promise.all([
    getAIDiagnosisSuggestionAction({ symptoms: diag.symptoms, ... }),
    getAITreatmentSuggestionAction({ diagnosis: diag.primaryDiagnosis, ... })
  ])
  precomputedAIRef.current[diag.toothNumber] = { diagResult, treatResult }
})
```

### Gap 3: No Tooth Number = No Diagnosis Pipeline at All

**Current:** If the patient says "pain in the back of my mouth on the lower left" without a specific tooth number, the regex extraction finds nothing. No tooth is marked on FDI, no diagnosis runs, no treatment is suggested.

**Problem:** In real consultations, patients rarely say FDI numbers. They describe regions. The current system silently drops this information.

**What's needed:** An agentic follow-up system:
1. After transcript parsing, if the AI detects dental symptoms but no specific tooth number, it should flag this as an **incomplete consultation gap**.
2. The system should display a prompt to the dentist: "Symptoms detected but no tooth number specified. Which tooth is the patient referring to?" with a clickable FDI chart for quick selection.
3. Alternatively, the AI could attempt regional inference: "lower left back" → teeth 36, 37, 38 and ask the dentist to confirm.
4. For non-tooth-specific conditions (e.g., generalized sensitivity, periodontal disease affecting multiple teeth, TMJ pain), the system should recognize these as **multi-tooth or non-odontogenic conditions** and route to a different diagnostic pathway.

**Scenarios to handle:**
- "Pain in the back left" → suggest teeth 36/37/38, ask dentist to confirm
- "All my teeth are sensitive" → generalized condition, not per-tooth
- "My jaw hurts when I open my mouth" → TMJ, not odontogenic — different pathway
- "The tooth next to the crown" → relative positioning, needs chart context

### Gap 4: No Gap-Detection in History Taking

**Current:** The system processes whatever transcript it receives. If the dentist forgets to ask about allergies, medications, or medical history, the AI just returns empty fields for those sections.

**What's needed:** After transcript parsing, analyze the `VoiceTranscriptAnalysis` for completeness:
- Missing chief complaint → "Ask: What is the main problem?"
- Missing HOPI → "Ask: When did it start? What makes it worse/better?"
- Missing medical history → "Ask: Any medical conditions? Medications? Allergies?"
- Missing tooth identification → "Ask: Which tooth exactly?"
- Low confidence in any section → "Please clarify: [specific section]"

Display these as a "Consultation Completeness" checklist with suggested follow-up questions the dentist can ask.

### Gap 5: Investigations, Diagnosis, Treatment Plan Tabs Not Auto-Filled

**Current:** Only 5 of 10 tabs get auto-filled. The main Diagnosis tab, Treatment Plan tab, Investigations, Prescription, and Follow-up tabs are always manual.

**What could be done:** After tooth-level AI diagnosis and treatment are computed (from the copilots), aggregate them into the main Diagnosis and Treatment Plan tabs automatically. The prescription could be suggested based on the treatment plan. Follow-up schedule could be suggested based on treatment complexity.

---

## Current State of All Files Modified This Session

| File | Change | Status |
|------|--------|--------|
| `lib/services/medical-conversation-parser.ts` | Added `ConversationContext` type | Done |
| `lib/services/gemini-ai.ts` | Enhanced diagnosis/treatment prompts with conversation context | Done |
| `lib/actions/ai-diagnosis-suggestions.ts` | Hybrid search + conversation context in RAG | Done |
| `lib/actions/ai-treatment-suggestions.ts` | Hybrid search + conversation context in RAG | Done |
| `components/dentist/diagnosis-ai-copilot.tsx` | conversationContext prop | Done |
| `components/dentist/endo-ai-copilot-live.tsx` | conversationContext prop | Done |
| `components/dentist/tooth-diagnosis-dialog-v2.tsx` | Context forwarding + age fix | Done |
| `components/dentist/enhanced-new-consultation-v3.tsx` | voiceConversationContext state + wiring | Done |
| `lib/services/rag-service.ts` | Hybrid search mode in performRAGQuery | Done |
| `lib/db/migrations/add_hybrid_search.sql` | tsvector + trigger + GIN index + RPC | Done, SQL Run |
| `lib/db/migrations/fix_hybrid_search_function.sql` | Fixed DOUBLE PRECISION return type | Done, SQL Run |
| `app/api/test-hybrid-search/route.ts` | Test endpoint (can delete) | Done |
| `components/consultation/GlobalVoiceRecorder.tsx` | Full rewrite: Deepgram + multi-segment + wake/stop words | Done, Needs Testing |

---

## Remaining Tasks (Priority Order for Next Session)

### Immediate Priority: Agentic Voice Pipeline Upgrades
1. **Cross-reference symptoms with teeth** — Use AI-parsed HOPI data to assign symptoms to extracted teeth, not just regex-adjacent text
2. **Pre-compute AI copilot results** — After "Stop & Process", fire diagnosis + treatment AI calls for all extracted teeth in background. Cache results for instant display on tooth click.
3. **Gap detection + follow-up prompts** — After parsing, analyze transcript completeness. Show dentist which questions are missing. Suggest follow-up questions.
4. **Regional tooth inference** — When patient describes region ("lower left back") without FDI number, suggest candidate teeth for dentist confirmation
5. **Multi-tooth / non-odontogenic routing** — Handle generalized conditions and non-tooth-specific pain

### Voice Recording Testing
6. **Test GlobalVoiceRecorder changes** — Login credentials need to be verified (dr.nisarg@endoflow.com password changed)
7. **Test Deepgram integration** — Verify DEEPGRAM_API_KEY is configured, test streaming, verify 10s silence tolerance
8. **Test wake/stop words** — "Start consultation" and "Stop recording" commands
9. **Test multi-segment merge** — Record, let browser STT restart, record more, verify merged transcript

### Other Priority Tasks
10. **Mobile responsive fixes** — 5 remaining issues from Session 3
11. **Section-aware document chunking** — whole docs get one embedding (should chunk by sections for better RAG)
12. **Re-ranking layer** — could add cross-encoder after hybrid search for precision

### Phase 4 Completion (Dentist Dashboard)
13. Voice dictation full Deepgram integration (consultation-specific)
14. Clinical Cockpit tabs completion
15. Dentist calendar view endpoint
16. Assistant Tasks Kanban with real-time updates
17. Clinical documentation templates CRUD

### Phase 5 (Not Started)
18. AI Co-Pilot treatment planning enhancements
19. Clinical Research Assistant chatbot
20. Research Projects module with cohort analysis

### Phase 6 (Not Started)
21. Testing (unit, integration, e2e, load)
22. Security audit & HIPAA compliance
23. CI/CD pipeline & production deployment

### MCP Vision (North Star)
- Rebuild AI layer as MCP application where LLM calls tools to control dashboard

---

## Known Issues
- Login credentials in CLAUDE.md are stale (`endoflow123` no longer works for dr.nisarg@endoflow.com)
- `ai_model` field in cache still says 'gemini-2.5-flash' but actually routes to Claude first
- GlobalVoiceRecorder rewrite not yet tested in browser (build passes, logic verified)
- Tooth symptom extraction uses 100-char regex window (too narrow for real conversations)
- AI copilot calls take 20-65 seconds per tooth (no pre-computation)

---

## Key File Locations Reference

### Voice Pipeline
- `components/consultation/GlobalVoiceRecorder.tsx` — Main voice recorder (REWRITTEN this session)
- `app/api/voice/process-global-transcript/route.ts` — API that processes transcript
- `lib/services/medical-conversation-parser.ts` — AI transcript parsing + ConversationContext type
- `lib/services/deepgram-stt.ts` — Deepgram WebSocket STT service
- `lib/services/deepgram-vocabulary.ts` — 100+ dental keywords for Deepgram boosting
- `lib/hooks/use-deepgram-recognition.ts` — React hook wrapper for Deepgram
- `app/api/deepgram/token/route.ts` — Server-side Deepgram token generation

### AI Engine
- `lib/services/gemini-ai.ts` — Contains `complexChatCompletion()` (Claude first, Gemini fallback), `generateDiagnosisSuggestion()`, `generateTreatmentSuggestion()`, `generateEmbedding()`
- `lib/services/claude-ai.ts` — Claude SDK wrapper (`generateClaudeChatCompletion`)
- `lib/services/ai-provider.ts` — Unified router: diagnosis/treatment → Claude, embedding → Gemini

### RAG Pipeline
- `lib/services/rag-service.ts` — Core RAG functions (now with hybrid search)
- `lib/actions/ai-diagnosis-suggestions.ts` — Diagnosis server action (hybrid search → Claude)
- `lib/actions/ai-treatment-suggestions.ts` — Treatment server action (hybrid search → Claude)
- `lib/db/migrations/add_hybrid_search.sql` — Hybrid search SQL (tsvector + RRF)
- `lib/db/migrations/fix_hybrid_search_function.sql` — Fix for return type

### Consultation UI
- `components/dentist/enhanced-new-consultation-v3.tsx` — Root consultation component (~3100 lines)
  - `distributeContentToTabs()` — Lines ~722-1120
  - `onContentProcessed` callback — Lines ~2499-2510
  - `onToothDiagnosesExtracted` callback — Lines ~2511-2580
- `components/dentist/tooth-diagnosis-dialog-v2.tsx` — Per-tooth dialog with checkboxes + AI copilots
- `components/dentist/interactive-dental-chart.tsx` — FDI chart component
- `components/dentist/diagnosis-ai-copilot.tsx` — AI diagnosis (auto-fires on symptoms)
- `components/dentist/endo-ai-copilot-live.tsx` — AI treatment (auto-fires on diagnosis)
